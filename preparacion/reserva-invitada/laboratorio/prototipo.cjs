// Laboratorio desconectado de producción. No monta rutas ni inicia pagos/correos.
const {randomBytes,randomUUID,createHmac,createHash,timingSafeEqual}=require('node:crypto');
const sha=valor=>createHash('sha256').update(valor).digest('hex');
const error=(http,codigo)=>Object.assign(Error(codigo),{http,codigo});
function normalizar(body){
    const objeto=v=>v&&typeof v==='object'&&!Array.isArray(v);
    const exacto=(v,claves)=>objeto(v)&&Object.keys(v).every(k=>claves.includes(k));
    if(!exacto(body,['contacto','id_servicio','id_trabajadora','fecha','hora'])||
        !exacto(body.contacto,['nombre','correo','telefono']))throw error(400,'DATOS_INVALIDOS');
    const c=body.contacto;
    if(typeof c.nombre!=='string'||!c.nombre.trim()||c.nombre.trim().length>100||
        typeof c.correo!=='string'||c.correo.trim().length>150||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.correo.trim())||
        c.telefono!=null&&(typeof c.telefono!=='string'||c.telefono.trim().length>20))throw error(400,'DATOS_INVALIDOS');
    if(![body.id_servicio,body.id_trabajadora].every(n=>Number.isSafeInteger(n)&&n>0&&n<=2147483647)||
        typeof body.fecha!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.fecha)||
        typeof body.hora!=='string'||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.hora))throw error(400,'DATOS_INVALIDOS');
    const dia=new Date(body.fecha+'T00:00:00Z');
    if(!Number.isFinite(dia.getTime())||dia.toISOString().slice(0,10)!==body.fecha)throw error(400,'DATOS_INVALIDOS');
    return {contacto:{nombre:c.nombre.trim(),correo:c.correo.trim().toLowerCase(),telefono:c.telefono?.trim()||null},
        id_servicio:body.id_servicio,id_trabajadora:body.id_trabajadora,fecha:body.fecha,hora:body.hora};
}
function crearLaboratorio({pool,secreto,consultarTurno,ahora=Date.now,trasContacto=async()=>{}}){
    if(typeof secreto!=='string'||secreto.length<32)throw Error('Se requiere clave de laboratorio fuerte');
    const hmac=(uso,texto)=>createHmac('sha256',secreto).update('meraki:invitada:lab:v1:'+uso+'\0'+texto).digest('hex');
    function emitirContexto(){
        const cuerpo=ahora()+'.'+randomBytes(32).toString('base64url');
        return cuerpo+'.'+hmac('cookie',cuerpo);
    }
    function contextoValido(valor){
        if(typeof valor!=='string'||!/^\d{13}\.[A-Za-z0-9_-]{43}\.[a-f0-9]{64}$/.test(valor))return false;
        const [fecha,nonce,firma]=valor.split('.');
        return Number(fecha)<=ahora()&&ahora()-Number(fecha)<7*86400000&&
            timingSafeEqual(Buffer.from(firma,'hex'),Buffer.from(hmac('cookie',fecha+'.'+nonce),'hex'));
    }
    async function respuestaCreada(db,intento,repetida){
        const r=(await db.query(`SELECT id_reserva,token_consulta,estado,monto_abono,
          TO_CHAR(fecha_hora_inicio,'YYYY-MM-DD"T"HH24:MI:SS') inicio,
          TO_CHAR(fecha_hora_fin,'YYYY-MM-DD"T"HH24:MI:SS') fin FROM reserva WHERE id_reserva=$1`,[intento.id_reserva])).rows[0];
        if(!r||sha(r.token_consulta||'')!==intento.token_hash)throw error(409,'ENLACE_REQUIERE_REVISION');
        return {http:repetida?200:201,cuerpo:{reserva:{id_reserva:r.id_reserva,token_consulta:r.token_consulta,
            estado:r.estado,monto_abono:r.monto_abono,fecha_hora_inicio_civil:r.inicio,fecha_hora_fin_civil:r.fin,zona_horaria:'America/Santiago'}}};
    }
    async function crear({contexto,clave,body}){
        if(!contextoValido(contexto))throw error(401,'CONTEXTO_NO_DISPONIBLE');
        if(typeof clave!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(clave))throw error(400,'CLAVE_INVALIDA');
        const d=normalizar(body),scope=hmac('contexto',contexto),key=sha(clave.toLowerCase());
        const contenido=JSON.stringify([d.contacto.nombre,d.contacto.correo,d.contacto.telefono,d.id_servicio,d.id_trabajadora,d.fecha,d.hora]);
        const huella=hmac('contenido',contenido);
        const db=await pool.connect();
        try{
            await db.query('BEGIN');await db.query('SET LOCAL synchronous_commit=on');
            // Colisiones de este candado solo serializan; la identidad está en la PK completa.
            await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[scope+key]);
            const existente=(await db.query('SELECT *,vence>CURRENT_TIMESTAMP vigente FROM intento_reserva_invitada WHERE contexto_hash=$1 AND clave_hash=$2',[scope,key])).rows[0];
            if(existente){
                if(existente.huella!==huella)throw error(409,'CLAVE_CONTENIDO_DISTINTO');
                if(!existente.vigente)throw error(410,'INTENTO_VENCIDO');
                if(existente.estado==='rechazada'){await db.query('COMMIT');return {http:409,cuerpo:{codigo:existente.codigo}};}
                if(existente.estado!=='creada')throw error(409,'INTENTO_EN_REVISION');
                const r=await respuestaCreada(db,existente,true);await db.query('COMMIT');return r;
            }
            const n=(await db.query("SELECT count(*)::int n FROM intento_reserva_invitada WHERE contexto_hash=$1 AND fecha>CURRENT_TIMESTAMP-interval '15 minutes'",[scope])).rows[0].n;
            if(n>=20)throw error(429,'LIMITE_INTENTOS');
            await db.query("INSERT INTO intento_reserva_invitada(contexto_hash,clave_hash,huella,estado) VALUES($1,$2,$3,'en_proceso')",[scope,key,huella]);
            await db.query('SELECT pg_advisory_xact_lock(117,$1)',[d.id_trabajadora]);
            const turno=await consultarTurno(db,d);
            if(!turno){
                await db.query("UPDATE intento_reserva_invitada SET estado='rechazada',codigo='HORARIO_NO_DISPONIBLE' WHERE contexto_hash=$1 AND clave_hash=$2",[scope,key]);
                await db.query('COMMIT');return {http:409,cuerpo:{codigo:'HORARIO_NO_DISPONIBLE'}};
            }
            const token=randomUUID();
            const r=(await db.query(`INSERT INTO reserva(id_emprendimiento,id_servicio,id_trabajadora,id_clienta,
              fecha_hora_inicio,fecha_hora_fin,estado,precio_servicio,monto_abono,token_consulta,nombre_clienta,correo_confirmacion)
              VALUES($1,$2,$3,NULL,$4,$5,'pendiente_abono',$6,$7,$8,$9,$10) RETURNING id_reserva`,
              [turno.id_emprendimiento,d.id_servicio,d.id_trabajadora,turno.fecha_hora_inicio,turno.fecha_hora_fin,
                  turno.precio,turno.monto_abono,token,d.contacto.nombre,d.contacto.correo])).rows[0];
            await db.query('INSERT INTO contacto_reserva_invitada(id_reserva,nombre,correo,telefono) VALUES($1,$2,$3,$4)',
                [r.id_reserva,d.contacto.nombre,d.contacto.correo,d.contacto.telefono]);
            await trasContacto(); // Inyección de fallo en pruebas, nunca un proveedor.
            const intento={id_reserva:r.id_reserva,token_hash:sha(token)};
            await db.query("UPDATE intento_reserva_invitada SET estado='creada',id_reserva=$3,token_hash=$4 WHERE contexto_hash=$1 AND clave_hash=$2",
                [scope,key,r.id_reserva,intento.token_hash]);
            const salida=await respuestaCreada(db,intento,false);await db.query('COMMIT');return salida;
        }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}
        finally{db.release();}
    }
    return {crear,emitirContexto,contextoValido};
}
module.exports={crearLaboratorio,normalizar};
