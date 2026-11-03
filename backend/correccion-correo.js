const crypto=require('crypto');
async function corregirCorreoReserva(pool,idReserva,correo) {
    correo=typeof correo==='string'?correo.trim().toLowerCase():'';
    if(!Number.isSafeInteger(idReserva)||idReserva<1||correo.length>150||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(correo))throw new Error('Reserva o correo inválido');
    const db=await pool.connect();
    try{
        await db.query('BEGIN');
        const r=(await db.query(`SELECT r.id_reserva,r.estado,r.correo_confirmacion,
            EXISTS(SELECT 1 FROM abono a WHERE a.id_reserva=r.id_reserva AND a.estado='aprobado'
              AND a.monto=r.monto_abono AND a.fecha_pago IS NOT NULL) AS pago_verificado
            FROM reserva r WHERE r.id_reserva=$1 FOR UPDATE`,[idReserva])).rows[0];
        if(!r||r.estado!=='confirmada'||!r.pago_verificado)throw new Error('Se requiere una reserva confirmada con abono aprobado');
        if(r.correo_confirmacion===correo){await db.query('ROLLBACK');return{corregida:false,motivo:'El correo ya estaba corregido; no se reenvía automáticamente'};}
        const n=(await db.query("SELECT id_notificacion,estado FROM notificacion_correo WHERE id_reserva=$1 AND tipo='confirmacion_reserva' FOR UPDATE",[idReserva])).rows[0];
        if(n?.estado==='enviando')throw new Error('Hay un envío incierto o en curso; revisarlo antes de corregir');
        if(n)await db.query("UPDATE notificacion_correo SET tipo='confirmacion_anterior_'||id_notificacion WHERE id_notificacion=$1",[n.id_notificacion]);
        await db.query('UPDATE reserva SET correo_confirmacion=$2,token_consulta=$3 WHERE id_reserva=$1',[idReserva,correo,crypto.randomUUID()]);
        const nueva=(await db.query("INSERT INTO notificacion_correo(id_reserva,tipo,estado) VALUES($1,'confirmacion_reserva','pendiente') RETURNING id_notificacion",[idReserva])).rows[0];
        await db.query('INSERT INTO correccion_correo_reserva(id_reserva,id_notificacion_anterior,id_notificacion_nueva) VALUES($1,$2,$3)',[idReserva,n?.id_notificacion||null,nueva.id_notificacion]);
        await db.query('COMMIT');
        return{corregida:true,idReserva,idNotificacion:nueva.id_notificacion,enlaceAnteriorInvalidado:true};
    }catch(error){await db.query('ROLLBACK');throw error;}
    finally{db.release();}
}
module.exports={corregirCorreoReserva};
