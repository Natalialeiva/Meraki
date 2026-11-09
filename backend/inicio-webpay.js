const {randomUUID} = require('node:crypto');

const conflicto = mensaje => ({codigo: 409, cuerpo: {mensaje}});
const revision = 'El intento de pago requiere revisión. No inicies otro pago.';

function conPlazo(operacion, plazo) {
    let timer;
    const limite = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Tiempo de Webpay agotado')), plazo);
    });
    return Promise.race([Promise.resolve().then(operacion), limite])
        .finally(() => clearTimeout(timer));
}

function crearInicioWebpay({pool, webpay, plazoMs = 20000}) {
    async function reserva(db, acceso, bloquear = false) {
        const porSesion = acceso.propietaria !== undefined;
        const filtro = porSesion
            ? 'r.id_reserva = $1 AND e.id_emprendedora = $2'
            : 'r.token_consulta = $1';
        const parametros = porSesion ? [acceso.idReserva, acceso.propietaria] : [acceso.token];
        const resultado = await db.query(`
            SELECT r.id_reserva, r.estado, r.monto_abono
            FROM reserva r JOIN emprendimiento e USING (id_emprendimiento)
            WHERE ${filtro} ${bloquear ? 'FOR UPDATE OF r' : ''}
        `, parametros);
        return resultado.rows[0];
    }

    async function historial(db, id) {
        return (await db.query(`
            SELECT id_abono, monto, estado, token_transaccion, buy_order, fase_webpay
            FROM abono WHERE id_reserva = $1 ORDER BY id_abono
        `, [id])).rows;
    }

    function validar(datos) {
        if (!datos) return {codigo: 404, cuerpo: {mensaje: 'No se encontró la reserva'}};
        if (datos.estado !== 'pendiente_abono') return conflicto('La reserva no está pendiente de abono');
        const monto = Number(datos.monto_abono);
        if (!Number.isSafeInteger(monto) || monto <= 0) {
            return {codigo: 400, cuerpo: {mensaje: 'El monto del abono no es válido'}};
        }
    }

    async function reservarIntento(acceso, datos, anteriores, orden, sesion) {
        const db = await pool.connect();
        let confirmada = false;
        let liberarConError;
        try {
            await db.query('BEGIN');
            await db.query('SET LOCAL synchronous_commit = on');
            const actual = await reserva(db, acceso, true);
            const invalida = validar(actual);
            if (invalida) return invalida;
            if (actual.id_reserva !== datos.id_reserva || actual.monto_abono !== datos.monto_abono ||
                JSON.stringify(await historial(db, actual.id_reserva)) !== JSON.stringify(anteriores)) {
                return conflicto('La reserva o sus abonos cambiaron. Revisa su estado antes de continuar.');
            }
            const intento = await db.query(`
                INSERT INTO abono (id_reserva, monto, estado, buy_order, sesion_webpay, fase_webpay, fecha_fase_webpay)
                VALUES ($1, $2, 'pendiente', $3, $4, 'creacion_en_curso', clock_timestamp())
                RETURNING id_abono
            `, [actual.id_reserva, actual.monto_abono, orden, sesion]);
            if ((await db.query('COMMIT')).command !== 'COMMIT') {
                throw new Error('No se confirmó el intento');
            }
            confirmada = true;
            return {idAbono: intento.rows[0].id_abono};
        } catch (error) {
            if (error.code === '23505') return conflicto('Ya existe un intento de pago. Revisa su estado.');
            liberarConError = error;
            throw error;
        } finally {
            if (!confirmada) {
                try { await db.query('ROLLBACK'); } catch (error) { liberarConError = error; }
            }
            db.release(liberarConError);
        }
    }

    async function guardarToken(idAbono, token) {
        const db = await pool.connect();
        let errorConexion;
        try {
            await db.query('BEGIN');
            await db.query('SET LOCAL synchronous_commit = on');
            const guardado = await db.query(`
                UPDATE abono SET token_transaccion = $2, fase_webpay = 'pendiente_respuesta_pago',
                    fecha_fase_webpay = clock_timestamp()
                WHERE id_abono = $1 AND estado = 'pendiente'
                  AND fase_webpay = 'creacion_en_curso' AND token_transaccion IS NULL
            `, [idAbono, token]);
            if (guardado.rowCount !== 1 || (await db.query('COMMIT')).command !== 'COMMIT') {
                throw new Error('No se pudo confirmar el token');
            }
        } catch (error) {
            errorConexion = error;
            await db.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            db.release(errorConexion);
        }
    }

    return async function iniciar(acceso, retorno) {
        let idAbono;
        try {
            const datos = await reserva(pool, acceso);
            const invalida = validar(datos);
            if (invalida) return invalida;
            const anteriores = await historial(pool, datos.id_reserva);
            if (anteriores.some(a => a.estado === 'pendiente' || a.estado === 'aprobado')) {
                return conflicto('La reserva tiene un pago pendiente o aprobado. Revisa su estado.');
            }
            for (const anterior of anteriores) {
                if (!anterior.token_transaccion || !anterior.buy_order) return conflicto(revision);
                const estado = await conPlazo(() => webpay.status(anterior.token_transaccion), plazoMs);
                if (estado?.buy_order !== anterior.buy_order || estado.amount == null ||
                    Number(estado.amount) !== Number(anterior.monto) ||
                    !['FAILED', 'REVERSED'].includes(estado.status)) return conflicto(revision);
            }
            if (!retorno) throw new Error('Falta configurar el retorno de Webpay');

            const orden = 'M' + randomUUID().replaceAll('-', '').slice(0, 25);
            const sesion = 'MERAKI-' + randomUUID();
            const intento = await reservarIntento(acceso, datos, anteriores, orden, sesion);
            if (!intento.idAbono) return intento;
            idAbono = intento.idAbono;

            const monto = Number(datos.monto_abono);
            const transaccion = await conPlazo(() => webpay.create(orden, sesion, monto, retorno), plazoMs);
            const token = transaccion?.token;
            const url = new URL(transaccion?.url);
            if (typeof token !== 'string' || !/^[a-zA-Z0-9]{64}$/.test(token) ||
                url.protocol !== 'https:' || url.username || url.password) {
                throw new Error('Respuesta de Webpay inválida');
            }
            await guardarToken(idAbono, token);
            return {codigo: 201, cuerpo: {
                mensaje: 'Transacción iniciada correctamente', id_reserva: datos.id_reserva,
                id_abono: idAbono, monto, url: url.href, token
            }};
        } catch {
            if (idAbono) {
                // Una escritura de token que sí se confirmó conserva su fase y su token.
                await pool.query(`
                    UPDATE abono SET fase_webpay = 'resultado_incierto', fecha_fase_webpay = clock_timestamp()
                    WHERE id_abono = $1 AND estado = 'pendiente' AND fase_webpay = 'creacion_en_curso'
                `, [idAbono]).catch(() => {});
                return {codigo: 502, cuerpo: {mensaje: revision, id_abono: idAbono}};
            }
            return {codigo: 502, cuerpo: {mensaje: 'No se pudo iniciar el abono. Consulta su estado antes de continuar.'}};
        }
    };
}

module.exports = {crearInicioWebpay};
