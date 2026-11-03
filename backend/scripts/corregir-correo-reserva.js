const path=require('path');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const pool=require('../db');
const {corregirCorreoReserva}=require('../correccion-correo');
const {crearNotificaciones}=require('../notificaciones');
(async()=>{
    const id=Number(process.argv[2]),correo=process.argv[3];
    try{
        const r=await corregirCorreoReserva(pool,id,correo);
        if(!r.corregida){console.log(JSON.stringify(r));return;}
        const envio=await crearNotificaciones(pool).notificar(id);
        const n=(await pool.query('SELECT estado,intentos,id_mensaje FROM notificacion_correo WHERE id_notificacion=$1',[r.idNotificacion])).rows[0];
        console.log(JSON.stringify({...r,enviado:envio.enviado,estadoCorreo:n.estado,intentos:n.intentos,idMensaje:n.id_mensaje}));
        if(!envio.enviado)process.exitCode=2;
    }catch(error){console.error(JSON.stringify({corregida:false,codigo:error.code||'REVISION_REQUERIDA'}));process.exitCode=1;}
    finally{await pool.end();}
})();
