const {randomUUID} = require('node:crypto');

const PLAZO_WEBPAY_MS = 15000;
const REVISION_MS = 60000;
const tokenValido = token => typeof token === 'string' && /^[a-zA-Z0-9]{64}$/.test(token);
const importe = valor => {
    if (typeof valor !== 'number' && (typeof valor !== 'string' || !/^\d+(?:\.\d+)?$/.test(valor))) return null;
    const numero = Number(valor);
    return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
};
const requiereRevision = a => a.estado_proceso_webpay === 'incierto' ||
    (a.estado_proceso_webpay === 'en_proceso' && Date.now() - new Date(a.fecha_operacion_webpay).getTime() >= REVISION_MS);
const respuesta = (codigo, mensaje, campos = {}) => ({codigo, cuerpo: {mensaje, ...campos}});

function identidadCoincide(a, r) {
    const monto = importe(a.monto);
    return typeof a.buy_order === 'string' && a.buy_order.trim() !== '' &&
        r?.buy_order === a.buy_order && monto !== null &&
        importe(r.amount) === monto && importe(a.monto_abono) === monto;
}

function clasificar(a, r) {
    if (!identidadCoincide(a, r)) return 'incierto';
    if (r.status === 'INITIALIZED') return 'iniciado';
    if (!Number.isSafeInteger(r.response_code)) return 'incierto';
    if (r.status === 'AUTHORIZED' && r.response_code === 0 &&
        typeof r.authorization_code === 'string' && r.authorization_code.trim() &&
        r.authorization_code.length <= 100) return 'aprobado';
    if (r.response_code !== 0 && ['FAILED', 'AUTHORIZED'].includes(r.status)) return 'rechazado';
    return 'incierto';
}

function crearProcesamientoWebpay({pool, webpay, registrar, notificar, plazoMs = PLAZO_WEBPAY_MS}) {
    async function transaccion(operar) {
        const db = await pool.connect();
        let errorConexion;
        try {
            await db.query('BEGIN');
            await db.query('SET LOCAL synchronous_commit = on');
            const resultado = await operar(db);
            if ((await db.query('COMMIT')).command !== 'COMMIT') throw Error('Confirmación local incierta');
            return resultado;
        } catch (error) {
            errorConexion = error;
            await db.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            db.release(errorConexion);
        }
    }

    async function buscar(db, acceso, bloquear = false) {
        const retorno = acceso.tipo === 'commit';
        const filtro = retorno ? 'a.token_transaccion = $1' : 'a.id_abono = $1 AND e.id_emprendedora = $2';
        const parametros = retorno ? [acceso.token] : [acceso.id, acceso.propietaria];
        if (bloquear) {
            const {rows} = await db.query(`
                SELECT a.id_reserva FROM abono a
                JOIN reserva r USING (id_reserva) JOIN emprendimiento e USING (id_emprendimiento)
                WHERE ${filtro}
            `, parametros);
            if (!rows.length) return;
            await db.query('SELECT id_reserva FROM reserva WHERE id_reserva=$1 FOR UPDATE', [rows[0].id_reserva]);
            parametros.push(rows[0].id_reserva);
        }
        const {rows} = await db.query(`
            SELECT a.*, r.estado AS estado_reserva, r.monto_abono
            FROM abono a JOIN reserva r USING (id_reserva) JOIN emprendimiento e USING (id_emprendimiento)
            WHERE ${filtro} ${bloquear ? 'AND a.id_reserva=$'+parametros.length+' FOR UPDATE OF a' : ''}
        `, parametros);
        return rows[0];
    }

    function elegible(a) {
        return a.estado === 'pendiente' && a.estado_reserva === 'pendiente_abono' &&
            tokenValido(a.token_transaccion) && typeof a.buy_order === 'string' && a.buy_order.trim() !== '' &&
            importe(a.monto) !== null && importe(a.monto) === importe(a.monto_abono);
    }

    async function reclamar(acceso) {
        return transaccion(async db => {
            const a = await buscar(db, acceso, true);
            if (!a) return respuesta(404, 'No se encontró el abono');
            if (!elegible(a)) return respuesta(409, 'El abono no reúne las condiciones para procesarse');
            const revisar = requiereRevision(a);
            if ((a.estado_proceso_webpay === 'en_proceso' && !revisar) ||
                (acceso.tipo === 'commit' && (a.commit_webpay_reclamado_en || revisar))) {
                return respuesta(409, revisar ? 'El abono requiere revisión' : 'El abono ya está en proceso o requiere verificación');
            }
            const operacion = randomUUID();
            const guardado = await db.query(`
                UPDATE abono SET operacion_webpay=$2, tipo_operacion_webpay=$3::varchar,
                    estado_proceso_webpay='en_proceso', fecha_operacion_webpay=clock_timestamp(),
                    commit_webpay_reclamado_en=CASE WHEN $3::varchar='commit' THEN clock_timestamp() ELSE commit_webpay_reclamado_en END
                WHERE id_abono=$1
            `, [a.id_abono, operacion, acceso.tipo]);
            if (guardado.rowCount !== 1) throw Error('No se guardó el reclamo');
            return {a, operacion, revisar};
        });
    }

    async function finalizar(acceso, reclamo, remoto) {
        return transaccion(async db => {
            const a = await buscar(db, acceso, true);
            if (!a || a.operacion_webpay !== reclamo.operacion || a.estado_proceso_webpay !== 'en_proceso') {
                return respuesta(409, 'La operación dejó de estar vigente');
            }
            const coincide = elegible(a) && a.token_transaccion === reclamo.a.token_transaccion &&
                a.buy_order === reclamo.a.buy_order && a.monto === reclamo.a.monto;
            const resultado = coincide ? clasificar(a, remoto) : 'incierto';
            const otro = ['aprobado','rechazado'].includes(resultado) && (await db.query(
                "SELECT 1 FROM abono WHERE id_reserva=$1 AND estado='aprobado' AND id_abono<>$2",
                [a.id_reserva,a.id_abono])).rowCount > 0;
            const campos = {id_abono:a.id_abono,id_reserva:a.id_reserva};
            if (otro || !['aprobado','rechazado'].includes(resultado)) {
                if (resultado === 'iniciado' && acceso.tipo === 'status' && !a.commit_webpay_reclamado_en && !reclamo.revisar) {
                    await db.query(`
                        UPDATE abono SET operacion_webpay=NULL,tipo_operacion_webpay=NULL,
                          estado_proceso_webpay=NULL,fecha_operacion_webpay=NULL WHERE id_abono=$1
                    `, [a.id_abono]);
                    return respuesta(200,'El pago todavía no ha sido completado',{...campos,estado_transbank:'INITIALIZED',estado_abono:'pendiente'});
                }
                await db.query("UPDATE abono SET estado_proceso_webpay='incierto' WHERE id_abono=$1",[a.id_abono]);
                if (resultado === 'iniciado' && acceso.tipo === 'status') {
                    return respuesta(200,'El pago todavía no ha sido completado y sigue en revisión',{
                        ...campos,estado_transbank:'INITIALIZED',estado_abono:'pendiente',
                        estado_proceso_webpay:'incierto',requiere_revision:true
                    });
                }
                return respuesta(409,'El resultado del abono requiere revisión',campos);
            }
            const aprobado = resultado === 'aprobado';
            const abono = await db.query(`
                UPDATE abono SET estado=$2::estado_abono, estado_proceso_webpay='resuelto',
                    codigo_autorizacion=CASE WHEN $2::estado_abono='aprobado' THEN $3 ELSE codigo_autorizacion END,
                    fecha_pago=CASE WHEN $2::estado_abono='aprobado' THEN CURRENT_TIMESTAMP ELSE fecha_pago END
                WHERE id_abono=$1 AND estado='pendiente' AND operacion_webpay=$4
            `, [a.id_abono,resultado,aprobado?remoto.authorization_code:null,reclamo.operacion]);
            if(abono.rowCount!==1)throw Error('El abono cambió');
            if(aprobado){
                const reserva=await db.query("UPDATE reserva SET estado='confirmada' WHERE id_reserva=$1 AND estado='pendiente_abono'",[a.id_reserva]);
                if(reserva.rowCount!==1)throw Error('La reserva cambió');
                await registrar(a.id_reserva,db);
            }
            return respuesta(200,aprobado?'Abono aprobado y reserva confirmada':'El abono no fue aprobado',{
                ...campos,estado_abono:resultado,estado_reserva:aprobado?'confirmada':a.estado_reserva
            });
        });
    }

    async function procesar(acceso) {
        let reclamo;
        let timer;
        try {
            reclamo = await reclamar(acceso);
            if (!reclamo.operacion) return reclamo;
            const limite = new Promise((_, reject) => {
                timer = setTimeout(() => reject(Error('Tiempo de Webpay agotado')), plazoMs);
            });
            const remoto = await Promise.race([
                Promise.resolve().then(() => webpay[acceso.tipo](reclamo.a.token_transaccion)), limite
            ]).finally(() => clearTimeout(timer));
            const resultado = await finalizar(acceso,reclamo,remoto);
            if(resultado.cuerpo.estado_abono==='aprobado'){
                await Promise.resolve().then(() => notificar(reclamo.a.id_reserva)).catch(() => {});
            }
            return resultado;
        } catch (error) {
            const codigo = typeof error?.code === 'string' && /^[A-Z0-9_]{1,32}$/.test(error.code) ? error.code : 'SIN_CODIGO';
            console.warn('Webpay: operación sin confirmar', {tipo:acceso.tipo,abono:reclamo?.a?.id_abono,codigo});
            if(reclamo?.operacion){
                await pool.query(`
                    UPDATE abono SET estado_proceso_webpay='incierto'
                    WHERE id_abono=$1 AND operacion_webpay=$2 AND estado_proceso_webpay='en_proceso'
                `,[reclamo.a.id_abono,reclamo.operacion]).catch(() => {});
            }
            return respuesta(502,'No se pudo verificar el pago. Su estado requiere revisión.');
        }
    }

    return {procesar, buscar, elegible};
}

function montarProcesamientoWebpay(app, {pool, webpay, registrar, notificar, verificarSesion}) {
    const servicio = crearProcesamientoWebpay({pool, webpay, registrar, notificar});

    async function retorno(req, res) {
        const parametros = {...req.query, ...req.body};
        if (parametros.TBK_TOKEN || parametros.TBK_ORDEN_COMPRA || parametros.TBK_ID_SESION) {
            return res.json({
                mensaje:'El pago fue interrumpido o terminó sin confirmación. Consulta su estado antes de intentar nuevamente.',
                estado:'requiere_verificacion'
            });
        }
        const token = parametros.token_ws;
        if (!tokenValido(token) || (req.query.token_ws && req.body?.token_ws && req.query.token_ws !== req.body.token_ws)) {
            return res.status(400).json({mensaje:'No se recibió un token válido de pago'});
        }
        const r = await servicio.procesar({tipo:'commit',token});
        return res.status(r.codigo).json(r.cuerpo);
    }

    app.get('/api/abonos/retorno', retorno);
    app.post('/api/abonos/retorno', retorno);

    function accesoPrivado(req) {
        const id = Number(req.params.id);
        if (Number.isSafeInteger(id) && id > 0) return {tipo:'status',id,propietaria:req.session.idEmprendedora};
    }

    app.get('/api/abonos/:id/estado', verificarSesion, async (req, res) => {
        const acceso = accesoPrivado(req);
        if (!acceso) return res.status(400).json({mensaje:'El identificador del abono no es válido'});
        try {
            const a = await servicio.buscar(pool,acceso);
            if (!a) return res.status(404).json({mensaje:'No se encontró el abono'});
            const base = {id_abono:a.id_abono,id_reserva:a.id_reserva,monto:a.monto,estado_local:a.estado};
            const revisar = requiereRevision(a);
            const token = tokenValido(a.token_transaccion);
            if (a.fase_webpay && !a.estado_proceso_webpay && !token) {
                return res.json({...base,fase_webpay:a.fase_webpay,
                    requiere_revision:a.fase_webpay === 'resultado_incierto' ||
                        Date.now() - new Date(a.fecha_fase_webpay).getTime() >= REVISION_MS,
                    puede_recuperar:false
                });
            }
            if (a.estado_proceso_webpay === 'en_proceso' || revisar || !token) {
                return res.json({...base,estado_proceso_webpay:a.estado_proceso_webpay,
                    requiere_revision:revisar || !token,revision_manual:!token,
                    puede_recuperar:false,puede_reconciliar:revisar && servicio.elegible(a)
                });
            }
            if (a.fase_webpay && req.query.verificar !== '1') {
                return res.json({...base,fase_webpay:a.fase_webpay,puede_recuperar:false,
                    puede_consultar_webpay:servicio.elegible(a)});
            }
            const remoto = await webpay.status(a.token_transaccion);
            const actual = await servicio.buscar(pool,acceso);
            if (!actual) return res.status(404).json({mensaje:'No se encontró el abono'});
            if (['operacion_webpay','estado_proceso_webpay','estado','estado_reserva',
                'token_transaccion','buy_order','monto','monto_abono'].some(campo=>actual[campo]!==a[campo])) {
                return res.status(409).json({mensaje:'El abono cambió durante la consulta. Actualiza su estado.'});
            }
            return res.json({...base,estado_transbank:remoto?.status,datos_coinciden:identidadCoincide(actual,remoto),
                puede_recuperar:servicio.elegible(actual) && clasificar(actual,remoto)==='aprobado'});
        } catch {
            return res.status(502).json({mensaje:'No se pudo consultar el estado en Transbank'});
        }
    });

    app.post('/api/abonos/:id/recuperar', verificarSesion, async (req, res) => {
        const acceso = accesoPrivado(req);
        if (!acceso) return res.status(400).json({mensaje:'El identificador del abono no es válido'});
        const r = await servicio.procesar(acceso);
        return res.status(r.codigo).json(r.cuerpo);
    });
}

module.exports = {crearProcesamientoWebpay, montarProcesamientoWebpay, PLAZO_WEBPAY_MS};
