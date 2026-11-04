const {randomUUID}=require('node:crypto');
const {PLAN,siguienteMes,cifrar,descifrar,hash,validarPago,urlRetorno}=require('./suscripcion-plan');
const {crearOneclick}=require('./oneclick');
const fechas=`SELECT s.*,TO_CHAR(fecha_inicio,'YYYY-MM-DD') AS fecha_inicio,
 TO_CHAR(fecha_fin_prueba,'YYYY-MM-DD') AS fecha_fin_prueba,TO_CHAR(fecha_proximo_cobro,'YYYY-MM-DD') AS fecha_proximo_cobro,
 TO_CHAR(acceso_hasta,'YYYY-MM-DD') AS acceso_hasta FROM suscripcion s`;
const error=(estado,mensaje)=>Object.assign(new Error(mensaje),{estado});

function crearSuscripciones({pool,proveedor=crearOneclick(),secreto=process.env.SESSION_SECRET,
 hoy=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),
 base=process.env.PUBLIC_BASE_URL||'http://localhost:3000'}={}){
    if(proveedor.ambiente!=='integracion')throw Error('Suscripciones habilitadas únicamente en integración');
    let ultimaSuscripcionRevisada=0;
    async function evento(db,id,tipo,detalle={}){await db.query('INSERT INTO evento_suscripcion(id_suscripcion,tipo,detalle) VALUES($1,$2,$3)',[id,tipo,JSON.stringify(detalle)]);}
    // El candado sobre la cuenta se mantiene entre el registro durable y la llamada al proveedor.
    // Una cancelación espera al cobro en curso y ningún cobro posterior puede ignorarla.
    async function exclusivo(cuenta,accion){
        const db=await pool.connect();let bloqueado=false,destruir=false;
        try{await db.query('SELECT pg_advisory_lock(509,$1)',[cuenta]);bloqueado=true;return await accion(db);}
        finally{
            await db.query('ROLLBACK').catch(()=>{});
            if(bloqueado)await db.query('SELECT pg_advisory_unlock(509,$1)',[cuenta]).catch(()=>{destruir=true;});
            db.release(destruir);
        }
    }
    async function obtener(cuenta){
        const s=(await pool.query(fechas+' WHERE id_emprendedora=$1',[cuenta])).rows[0];
        if(!s)return {plan:PLAN,suscripcion:null,pagos:[],capacidades:{crear_reservas:false,configurar:false}};
        const pagos=(await pool.query(`SELECT id_pago_suscripcion,monto,estado,proceso,intento,codigo_respuesta,
         TO_CHAR(periodo_inicio,'YYYY-MM-DD') AS periodo_inicio,TO_CHAR(periodo_fin,'YYYY-MM-DD') AS periodo_fin,fecha_pago
         FROM pago_suscripcion WHERE id_suscripcion=$1 ORDER BY id_pago_suscripcion DESC LIMIT 12`,[s.id_suscripcion])).rows;
        const inscripcion=(await pool.query(`SELECT CASE WHEN estado IN ('iniciando','pendiente') AND fecha_creacion<CURRENT_TIMESTAMP-INTERVAL '20 minutes' THEN 'expirada' ELSE estado END AS estado
         FROM inscripcion_suscripcion WHERE id_suscripcion=$1 ORDER BY id_inscripcion DESC LIMIT 1`,[s.id_suscripcion])).rows[0];
        const vigente=Boolean(s.acceso_hasta&&s.acceso_hasta>hoy());
        return {plan:PLAN,capacidades:{crear_reservas:vigente,configurar:vigente},suscripcion:{id_suscripcion:s.id_suscripcion,
            estado:s.estado==='cancelada'?'cancelada':s.acceso_hasta&&s.acceso_hasta>hoy()?s.estado:'vencida',
            fecha_inicio:s.fecha_inicio,fecha_fin_prueba:s.fecha_fin_prueba,fecha_proximo_cobro:s.fecha_proximo_cobro,
            acceso_hasta:s.acceso_hasta,acceso_vigente:Boolean(s.acceso_hasta&&s.acceso_hasta>hoy()),
            renovacion_automatica:s.renovacion_automatica,tarjeta_ultimos4:s.tarjeta_ultimos4,tarjeta_tipo:s.tarjeta_tipo,
            inscripcion:inscripcion?.estado||null},pagos};
    }
    function consentimiento(datos){
        if(datos?.acepta_renovacion!==true||datos?.version_plan!==PLAN.version||Object.keys(datos).some(k=>!['acepta_renovacion','version_plan'].includes(k)))
            throw error(400,'Debes aceptar el plan de $9.990 mensuales y su renovación automática');
    }
    async function inscribir(cuenta,datos,origenSolicitado){
        consentimiento(datos);
        const retorno=urlRetorno(base,origenSolicitado);
        return exclusivo(cuenta,async db=>{
            const persona=(await db.query("SELECT correo FROM emprendedora WHERE id_emprendedora=$1 AND estado='activa'",[cuenta])).rows[0];
            if(!persona)throw error(403,'La cuenta no está habilitada');
            await db.query('BEGIN');
            await db.query(`INSERT INTO suscripcion(id_emprendedora,fecha_inicio,monto_mensual,estado)
             VALUES($1,$2,$3,'cancelada') ON CONFLICT(id_emprendedora) DO NOTHING`,[cuenta,hoy(),PLAN.monto]);
            const s=(await db.query(fechas+' WHERE id_emprendedora=$1 FOR UPDATE',[cuenta])).rows[0];
            if(s.renovacion_automatica&&s.tarjeta_cifrada)throw error(409,'Ya tienes una tarjeta inscrita y renovación habilitada');
            const pendiente=(await db.query(`SELECT id_inscripcion FROM inscripcion_suscripcion WHERE id_suscripcion=$1
             AND (estado IN ('confirmando','revision') OR (estado IN ('iniciando','pendiente') AND fecha_creacion>CURRENT_TIMESTAMP-INTERVAL '20 minutes'))`,[s.id_suscripcion])).rows[0];
            if(pendiente)throw error(409,'Existe una inscripción en curso o en revisión; termina ese proceso antes de iniciar otro');
            const usuario='meraki-'+randomUUID().replaceAll('-','');
            const i=(await db.query(`INSERT INTO inscripcion_suscripcion(id_suscripcion,usuario_oneclick,estado) VALUES($1,$2,'iniciando') RETURNING id_inscripcion`,[s.id_suscripcion,usuario])).rows[0];
            await evento(db,s.id_suscripcion,'consentimiento_inscripcion',{version:PLAN.version,monto:PLAN.monto,meses_gratis:1});
            await db.query('COMMIT');
            let respuesta;
            try{
                respuesta=await proveedor.iniciar(usuario,persona.correo,retorno);
                const url=new URL(respuesta.url_webpay);
                if(url.protocol!=='https:'||url.hostname!=='webpay3gint.transbank.cl'||url.username||url.password||typeof respuesta.token!=='string'||!respuesta.token||respuesta.token.length>255)throw Error('Respuesta inválida');
                await db.query("UPDATE inscripcion_suscripcion SET token_hash=$1,estado='pendiente' WHERE id_inscripcion=$2",[hash(respuesta.token),i.id_inscripcion]);
            }catch(e){await db.query("UPDATE inscripcion_suscripcion SET estado='rechazada',fecha_resolucion=CURRENT_TIMESTAMP WHERE id_inscripcion=$1",[i.id_inscripcion]);throw error(502,'No se pudo iniciar la inscripción; no se realizó un cobro');}
            return {token:respuesta.token,url:respuesta.url_webpay,ambiente:'integracion'};
        });
    }
    async function finalizar(token){
        if(typeof token!=='string'||!token||token.length>255)throw error(400,'Retorno de inscripción inválido');
        const i=(await pool.query(`SELECT i.*,s.id_emprendedora FROM inscripcion_suscripcion i JOIN suscripcion s USING(id_suscripcion) WHERE token_hash=$1`,[hash(token)])).rows[0];
        if(!i)throw error(404,'La inscripción no existe');
        return exclusivo(i.id_emprendedora,async db=>{
            const actual=(await db.query('SELECT estado,fecha_creacion>CURRENT_TIMESTAMP-INTERVAL \'20 minutes\' AS vigente FROM inscripcion_suscripcion WHERE id_inscripcion=$1',[i.id_inscripcion])).rows[0];
            if(actual.estado==='completada')return;
            if(actual.estado!=='pendiente'||!actual.vigente)throw error(409,'La inscripción no está disponible para confirmar');
            // Se persiste antes de finish: si se pierde su respuesta no se repite a ciegas.
            await db.query("UPDATE inscripcion_suscripcion SET estado='confirmando' WHERE id_inscripcion=$1",[i.id_inscripcion]);
            let r;
            try{r=await proveedor.finalizar(token);}catch(e){await db.query("UPDATE inscripcion_suscripcion SET estado='revision' WHERE id_inscripcion=$1",[i.id_inscripcion]);throw error(502,'El resultado de la inscripción requiere revisión. No se activaron cobros');}
            if(r.response_code!==0){await db.query("UPDATE inscripcion_suscripcion SET estado='rechazada',fecha_resolucion=CURRENT_TIMESTAMP WHERE id_inscripcion=$1",[i.id_inscripcion]);throw error(409,'La inscripción fue rechazada; no se realizó un cobro');}
            if(typeof r.tbk_user!=='string'||!r.tbk_user||r.tbk_user.length>255||!/^\d{4}$/.test(String(r.card_number))||typeof r.credit_card_type!=='string'||r.credit_card_type.length>100){
                await db.query("UPDATE inscripcion_suscripcion SET estado='revision' WHERE id_inscripcion=$1",[i.id_inscripcion]);throw error(502,'La inscripción requiere revisión; no se activaron cobros');
            }
            await db.query('BEGIN');
            const s=(await db.query(fechas+' WHERE id_suscripcion=$1 FOR UPDATE',[i.id_suscripcion])).rows[0];
            const primera=!s.fecha_fin_prueba,fin=primera?siguienteMes(hoy()):s.fecha_fin_prueba;
            const vigente=(s.acceso_hasta||fin)>hoy();
            await db.query(`UPDATE suscripcion SET fecha_inicio=CASE WHEN $1 THEN $2::date ELSE fecha_inicio END,
             fecha_fin_prueba=$3,fecha_proximo_cobro=COALESCE(fecha_proximo_cobro,$3::date),acceso_hasta=COALESCE(acceso_hasta,$3::date),
             dia_cobro=COALESCE(dia_cobro,$4),usuario_oneclick=$5,tarjeta_cifrada=$6,tarjeta_ultimos4=$7,tarjeta_tipo=$8,
             renovacion_automatica=TRUE,consentimiento_fecha=CURRENT_TIMESTAMP,consentimiento_version=$9,
             estado=$10,reintento_autorizado=TRUE,cancelada_fecha=NULL WHERE id_suscripcion=$11`,
             [primera,hoy(),fin,Number((primera?hoy():s.fecha_inicio).slice(8,10)),i.usuario_oneclick,cifrar(r.tbk_user,secreto),String(r.card_number),r.credit_card_type,PLAN.version,vigente?(primera||hoy()<fin?'prueba':'activa'):'vencida',s.id_suscripcion]);
            await db.query("UPDATE inscripcion_suscripcion SET estado='completada',fecha_resolucion=CURRENT_TIMESTAMP WHERE id_inscripcion=$1",[i.id_inscripcion]);
            await evento(db,s.id_suscripcion,'tarjeta_inscrita',{version:PLAN.version,primera_prueba:primera});await db.query('COMMIT');
        });
    }
    async function cancelar(cuenta){
        return exclusivo(cuenta,async db=>{
            await db.query('BEGIN');const s=(await db.query(fechas+' WHERE id_emprendedora=$1 FOR UPDATE',[cuenta])).rows[0];
            if(!s)throw error(404,'No tienes una suscripción registrada');
            await db.query("UPDATE suscripcion SET renovacion_automatica=FALSE,reintento_autorizado=FALSE,estado='cancelada',cancelada_fecha=CURRENT_TIMESTAMP WHERE id_suscripcion=$1",[s.id_suscripcion]);
            await db.query("UPDATE inscripcion_suscripcion SET estado='cancelada' WHERE id_suscripcion=$1 AND estado IN ('iniciando','pendiente','confirmando','revision')",[s.id_suscripcion]);
            await evento(db,s.id_suscripcion,'renovacion_cancelada');await db.query('COMMIT');
            if(s.tarjeta_cifrada){
                try{await proveedor.eliminar(descifrar(s.tarjeta_cifrada,secreto),s.usuario_oneclick);await db.query('UPDATE suscripcion SET tarjeta_cifrada=NULL WHERE id_suscripcion=$1',[s.id_suscripcion]);}
                catch(e){await evento(db,s.id_suscripcion,'revocacion_tarjeta_pendiente');}
            }
            return {mensaje:'Renovación cancelada. Se conserva el acceso hasta el fin del período vigente'};
        });
    }
    async function reintentar(cuenta,datos){
        consentimiento(datos);
        return exclusivo(cuenta,async db=>{
            const s=(await db.query(fechas+' WHERE id_emprendedora=$1',[cuenta])).rows[0];
            if(!s||!s.renovacion_automatica||!s.tarjeta_cifrada)throw error(409,'No hay una renovación habilitada');
            const p=(await db.query('SELECT estado,proceso FROM pago_suscripcion WHERE id_suscripcion=$1 AND periodo_inicio=$2 ORDER BY intento DESC LIMIT 1',[s.id_suscripcion,s.fecha_proximo_cobro])).rows[0];
            if(!p||p.estado!=='rechazado'||p.proceso!=='finalizado')throw error(409,'Solo se puede autorizar otro intento de un cobro rechazado y resuelto');
            await db.query('BEGIN');await db.query('UPDATE suscripcion SET reintento_autorizado=TRUE WHERE id_suscripcion=$1',[s.id_suscripcion]);
            await evento(db,s.id_suscripcion,'reintento_autorizado',{version:PLAN.version,monto:PLAN.monto});await db.query('COMMIT');
            return {mensaje:'Reintento de $9.990 autorizado para el próximo ciclo del procesador'};
        });
    }
    async function resolver(db,p,r){
        const resultado=validarPago(r,p);
        if(resultado==='incierto'){await db.query("UPDATE pago_suscripcion SET proceso='revision' WHERE id_pago_suscripcion=$1 AND estado='pendiente'",[p.id_pago_suscripcion]);return 'revision';}
        await db.query('BEGIN');
        const actualizado=await db.query(`UPDATE pago_suscripcion SET estado=$1::text::estado_pago_suscripcion,proceso='finalizado',codigo_respuesta=$2,
         codigo_autorizacion=$3,fecha_pago=CASE WHEN $1::text='aprobado' THEN CURRENT_TIMESTAMP ELSE NULL END
         WHERE id_pago_suscripcion=$4 AND estado='pendiente' RETURNING id_pago_suscripcion`,[resultado,r.details[0].response_code,resultado==='aprobado'?r.details[0].authorization_code:null,p.id_pago_suscripcion]);
        if(actualizado.rows.length){
            if(resultado==='aprobado')await db.query(`UPDATE suscripcion SET fecha_proximo_cobro=$1,acceso_hasta=GREATEST(acceso_hasta,$1::date),dia_cobro=$2,
             estado=CASE WHEN estado='cancelada' THEN estado ELSE 'activa' END,reintento_autorizado=FALSE WHERE id_suscripcion=$3`,[p.periodo_fin,p.dia_cobro,p.id_suscripcion]);
            else await db.query("UPDATE suscripcion SET estado=CASE WHEN estado='cancelada' THEN estado ELSE 'vencida' END,reintento_autorizado=FALSE WHERE id_suscripcion=$1",[p.id_suscripcion]);
            await evento(db,p.id_suscripcion,'cobro_'+resultado,{id_pago:p.id_pago_suscripcion,monto:Number(p.monto)});
        }
        await db.query('COMMIT');return resultado;
    }
    async function procesar(cuenta){
        return exclusivo(cuenta,async db=>{
            const s=(await db.query(fechas+' WHERE id_emprendedora=$1',[cuenta])).rows[0];if(!s)return 'omitida';
            // Se resuelven cobros inciertos aun después de cancelar; consultar no vuelve a cobrar.
            const pendiente=(await db.query(`SELECT p.*,TO_CHAR(periodo_fin,'YYYY-MM-DD') AS periodo_fin FROM pago_suscripcion p
             WHERE id_suscripcion=$1 AND estado='pendiente' ORDER BY id_pago_suscripcion DESC LIMIT 1`,[s.id_suscripcion])).rows[0];
            if(pendiente){
                if(!pendiente.orden_compra)return 'revision';
                try{return await resolver(db,pendiente,await proveedor.consultar(pendiente.orden_compra));}catch(e){return 'revision';}
            }
            if(!s.renovacion_automatica||!s.tarjeta_cifrada||!s.fecha_proximo_cobro||s.fecha_proximo_cobro>hoy())return 'omitida';
            const anterior=(await db.query('SELECT estado,intento FROM pago_suscripcion WHERE id_suscripcion=$1 AND periodo_inicio=$2 ORDER BY intento DESC LIMIT 1',[s.id_suscripcion,s.fecha_proximo_cobro])).rows[0];
            if(anterior&&(anterior.estado==='aprobado'||!s.reintento_autorizado))return 'omitida';
            const tarde=s.fecha_proximo_cobro<hoy(),dia=tarde?Number(hoy().slice(8,10)):s.dia_cobro;
            const fin=siguienteMes(tarde?hoy():s.fecha_proximo_cobro,dia),orden='M'+randomUUID().replaceAll('-','').slice(0,24);
            // No se cobra deuda acumulada: un proceso tardío concede un mes desde hoy.
            await db.query('BEGIN');
            const p=(await db.query(`INSERT INTO pago_suscripcion(id_suscripcion,monto,periodo_inicio,periodo_fin,orden_compra,orden_tienda,codigo_comercio,intento,proceso,dia_cobro)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,'enviando',$9) RETURNING *,TO_CHAR(periodo_fin,'YYYY-MM-DD') AS periodo_fin`,
             [s.id_suscripcion,PLAN.monto,s.fecha_proximo_cobro,fin,orden,'T'+orden.slice(1),proveedor.codigoComercio,(anterior?.intento||0)+1,dia])).rows[0];
            await db.query('UPDATE suscripcion SET reintento_autorizado=FALSE WHERE id_suscripcion=$1',[s.id_suscripcion]);
            await evento(db,s.id_suscripcion,'cobro_iniciado',{id_pago:p.id_pago_suscripcion,monto:PLAN.monto});await db.query('COMMIT');
            try{return await resolver(db,p,await proveedor.autorizar(s.usuario_oneclick,descifrar(s.tarjeta_cifrada,secreto),p));}
            catch(e){console.error('MERAKI: cobro de suscripción requiere revisión',e.code||'ERROR');await db.query('ROLLBACK').catch(()=>{});await db.query("UPDATE pago_suscripcion SET proceso='revision' WHERE id_pago_suscripcion=$1 AND estado='pendiente'",[p.id_pago_suscripcion]);return 'revision';}
        });
    }
    async function ciclo(){
        // Avanza por lotes: los pagos inciertos del primer lote no bloquean otras cuentas.
        const cuentas=(await pool.query(`SELECT s.id_emprendedora,s.id_suscripcion FROM suscripcion s WHERE s.id_suscripcion>$2 AND (
         (renovacion_automatica AND fecha_proximo_cobro<=$1::date)
         OR EXISTS(SELECT 1 FROM pago_suscripcion p WHERE p.id_suscripcion=s.id_suscripcion AND p.estado='pendiente')) ORDER BY s.id_suscripcion LIMIT 50`,[hoy(),ultimaSuscripcionRevisada])).rows;
        ultimaSuscripcionRevisada=cuentas.length===50?cuentas[cuentas.length-1].id_suscripcion:0;
        const resultados=[];for(const c of cuentas){try{resultados.push(await procesar(c.id_emprendedora));}catch(e){resultados.push('error');}}return resultados;
    }
    return {obtener,inscribir,finalizar,cancelar,reintentar,procesar,ciclo};
}
function montarRutasSuscripcion(app,servicio,verificarSesion){
    const manejar=accion=>async(req,res)=>{res.set('Cache-Control','no-store');try{res.json(await accion(req));}catch(e){res.status(e.estado||503).json({mensaje:e.estado?e.message:'Suscripciones temporalmente no disponibles'});}};
    const accion=(req,res,next)=>req.get('X-Meraki-Action')==='1'?next():res.status(403).json({mensaje:'Acción de suscripción no autorizada'});
    app.get('/api/suscripcion',verificarSesion,manejar(req=>servicio.obtener(req.session.idEmprendedora)));
    app.post('/api/suscripcion/inscribir',verificarSesion,accion,manejar(req=>servicio.inscribir(req.session.idEmprendedora,req.body,req.protocol+'://'+req.get('host'))));
    app.post('/api/suscripcion/cancelar',verificarSesion,accion,manejar(req=>servicio.cancelar(req.session.idEmprendedora)));
    app.post('/api/suscripcion/reintentar',verificarSesion,accion,manejar(req=>servicio.reintentar(req.session.idEmprendedora,req.body)));
    const retorno=async(req,res)=>{
        res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');
        try{await servicio.finalizar(req.method==='POST'?req.body?.TBK_TOKEN:req.query.TBK_TOKEN);res.redirect(303,'/back-office/#tituloSuscripcion');}
        catch(e){res.status(e.estado||503).send('No se pudo completar la inscripción. Vuelve al Back Office para revisar su estado.');}
    };
    app.get('/api/suscripcion/retorno',retorno);app.post('/api/suscripcion/retorno',retorno);
}
function iniciarPlanificador(servicio,{intervalo=60000}={}){
    let ejecutando=false;
    const ejecutar=async()=>{if(ejecutando)return;ejecutando=true;try{await servicio.ciclo();}catch(e){console.error('MERAKI: no se pudo revisar el ciclo de suscripciones');}finally{ejecutando=false;}};
    const temporizador=setInterval(ejecutar,intervalo);temporizador.unref();ejecutar();return()=>clearInterval(temporizador);
}
module.exports={crearSuscripciones,montarRutasSuscripcion,iniciarPlanificador};
