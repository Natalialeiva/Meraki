const {enviarConfirmacionReserva, enlacePrivado} = require('./correo');
function crearNotificaciones(pool, enviar = enviarConfirmacionReserva) {
 async function registrar(id, db = pool) {
  await db.query(`INSERT INTO notificacion_correo (id_reserva,tipo,estado)
   SELECT id_reserva,'confirmacion_reserva','pendiente' FROM reserva WHERE id_reserva=$1 AND estado='confirmada'
   ON CONFLICT (id_reserva,tipo) DO NOTHING`, [id]);
 }
 async function notificar(id) {
  const reclamo = await pool.query(`UPDATE notificacion_correo n SET estado='enviando', intentos=intentos+1,
   fecha_inicio_envio=CURRENT_TIMESTAMP, ultimo_error=NULL FROM reserva r
   WHERE n.id_reserva=r.id_reserva AND n.id_reserva=$1 AND n.tipo='confirmacion_reserva'
   AND n.estado='pendiente' AND n.intentos<3 AND r.estado='confirmada' RETURNING n.id_notificacion,n.intentos`, [id]);
  if (!reclamo.rows.length) return {enviado:false};
  const intento = reclamo.rows[0];
  let resultado;
  try {
   const datos = await pool.query(`SELECT c.nombre AS nombre_clienta,c.correo,e.nombre AS emprendimiento,
    s.nombre AS servicio,TO_CHAR(r.fecha_hora_inicio,'DD/MM/YYYY') AS fecha,
    TO_CHAR(r.fecha_hora_inicio,'HH24:MI') AS hora,r.token_consulta FROM reserva r
    JOIN clienta c ON c.id_clienta=r.id_clienta JOIN emprendimiento e ON e.id_emprendimiento=r.id_emprendimiento
    JOIN servicio s ON s.id_servicio=r.id_servicio WHERE r.id_reserva=$1 AND r.estado='confirmada'`,[id]);
   const d = datos.rows[0];
   if (!d?.correo || !d.token_consulta) { const e = new Error('Datos incompletos'); e.code='ECONFIG'; throw e; }
   resultado = await enviar({...d,nombreClienta:d.nombre_clienta,enlaceConsulta:enlacePrivado(d.token_consulta)});
  } catch (error) {
   // Timeout, desconexión o error desconocido: el SMTP pudo aceptar el mensaje.
   const seguro = ['EAUTH','EENVELOPE','ECONFIG','EDNS'].includes(error.code) || /^Falta configurar|^MAIL_PROVIDER|^PUBLIC_BASE_URL|^Enlace privado/.test(error.message);
   if (seguro) await pool.query(`UPDATE notificacion_correo SET estado='fallido',ultimo_error=$3
    WHERE id_notificacion=$1 AND intentos=$2 AND estado='enviando'`,[intento.id_notificacion,intento.intentos,error.code || 'ECONFIG']);
   return {enviado:false,requiereRevision:!seguro};
  }
  // Si falla este registro después del SMTP, conservar 'enviando' para revisión manual.
  try {
   await pool.query(`UPDATE notificacion_correo SET estado='enviado',fecha_envio=CURRENT_TIMESTAMP,
    id_mensaje=$3,ultimo_error=NULL WHERE id_notificacion=$1 AND intentos=$2 AND estado='enviando'`,
    [intento.id_notificacion,intento.intentos,resultado.idMensaje]);
   return {enviado:true};
  } catch { return {enviado:false,requiereRevision:true}; }
 }
 return {registrar,notificar: async id => { try {return await notificar(id);} catch {return {enviado:false,requiereRevision:true};} }};
}
function montarRutas(app,pool,verificarSesion,notificar) {
 const proteger = (req,res,next) => req.get('X-Meraki-Action') === '1' ? next() : res.status(403).json({mensaje:'Falta cabecera de operación'});
 app.get('/api/notificaciones',verificarSesion,async(req,res)=>{
  try { const r=await pool.query(`SELECT n.id_notificacion,n.id_reserva,n.estado,n.intentos,n.fecha_inicio_envio,n.fecha_envio,
   n.id_mensaje,(n.estado='enviando' AND n.fecha_inicio_envio<CURRENT_TIMESTAMP-INTERVAL '10 minutes') AS requiere_revision
   FROM notificacion_correo n JOIN reserva r ON r.id_reserva=n.id_reserva
   JOIN emprendimiento e ON e.id_emprendimiento=r.id_emprendimiento WHERE e.id_emprendedora=$1 AND n.tipo='confirmacion_reserva' ORDER BY n.id_notificacion DESC`,[req.session.idEmprendedora]); res.json(r.rows);
  } catch {res.status(500).json({mensaje:'No se pudieron obtener las notificaciones'});}
 });
 app.post('/api/notificaciones/:id/:accion',verificarSesion,proteger,async(req,res)=>{
  const id=Number(req.params.id), accion=req.params.accion;
  const {decision,evidencia}=req.body || {};
  if (!Number.isSafeInteger(id) || id<1 || !['reintentar','revisar'].includes(accion) || typeof evidencia!=='string' || evidencia.trim().length<10 || evidencia.length>500 || (accion==='revisar' && !['entregado','no_entregado'].includes(decision))) return res.status(400).json({mensaje:'Indica una decisión y evidencia de 10 a 500 caracteres'});
  let db;
  try {
   db=await pool.connect(); await db.query('BEGIN');
   const r=await db.query(`SELECT n.*,r.estado AS estado_reserva,
    (n.fecha_inicio_envio<CURRENT_TIMESTAMP-INTERVAL '10 minutes') AS vencido
    FROM notificacion_correo n JOIN reserva r ON r.id_reserva=n.id_reserva
    JOIN emprendimiento e ON e.id_emprendimiento=r.id_emprendimiento
    WHERE n.id_notificacion=$1 AND e.id_emprendedora=$2 AND n.tipo='confirmacion_reserva' FOR UPDATE OF n,r`,[id,req.session.idEmprendedora]);
   const n=r.rows[0];
   if (!n) {await db.query('ROLLBACK'); return res.status(404).json({mensaje:'Notificación no encontrada'});}
   const reintento=accion==='reintentar';
   if (reintento ? (!['fallido','pendiente'].includes(n.estado) || n.intentos>=3 || n.estado_reserva!=='confirmada') : (n.estado!=='enviando' || !n.vencido)) {
    await db.query('ROLLBACK'); return res.status(409).json({mensaje:'La notificación no cumple las condiciones de la operación'});
   }
   const estado=reintento?'pendiente':decision==='entregado'?'enviado':'fallido';
   await db.query(`UPDATE notificacion_correo SET estado=$2::varchar,
    fecha_envio=CASE WHEN $2::varchar='enviado' THEN CURRENT_TIMESTAMP ELSE fecha_envio END WHERE id_notificacion=$1`,[id,estado]);
   await db.query(`INSERT INTO revision_notificacion(id_notificacion,id_emprendedora,decision,evidencia) VALUES($1,$2,$3,$4)`,[id,req.session.idEmprendedora,reintento?'reintento':decision,evidencia.trim()]);
   await db.query('COMMIT'); db.release(); db=null;
   const resultado=reintento?await notificar(n.id_reserva):{revisado:true};
   res.json(resultado);
  } catch {if(db) await db.query('ROLLBACK').catch(()=>{}); res.status(500).json({mensaje:'No se pudo completar la operación'});}
  finally {if(db) db.release();}
 });
}
module.exports={crearNotificaciones,montarRutas};
