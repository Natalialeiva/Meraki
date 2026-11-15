const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fallo=(http,mensaje)=>Object.assign(Error(mensaje),{http});
const texto=(v,opcional=false)=>{
 if(opcional&&(v===undefined||v===null||v===''))return null;
 if(typeof v!=='string'||!v.trim()||v.trim().length>500||/[\u0000-\u001f\u007f]/.test(v))throw fallo(400,'Indica un texto de hasta 500 caracteres');
 return v.trim();
};
async function leer(db,id){
 const r=(await db.query(`SELECT r.asistencia_confirmada_en,
 r.fecha_hora_inicio>CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' futura,
 sc.id_solicitud,sc.estado,sc.creada_en,sc.motivo,sc.cerrada_en,sc.respuesta
 FROM reserva r LEFT JOIN solicitud_cancelacion sc USING(id_reserva) WHERE r.id_reserva=$1`,[id])).rows[0];
 return {asistencia_confirmada_en:r.asistencia_confirmada_en,futura:r.futura,
 solicitud:r.id_solicitud?{id_solicitud:r.id_solicitud,estado:r.estado,creada_en:r.creada_en,motivo:r.motivo,cerrada_en:r.cerrada_en,respuesta:r.respuesta}:null};
}
function montar(app,pool,verificarSesion){
 const proteger=(req,res,next)=>{
  res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');
  if(req.get('X-Meraki-Action')!=='1'||req.get('Sec-Fetch-Site')==='cross-site'||(req.get('Origin')&&req.get('Origin')!==req.protocol+'://'+req.get('Host')))return res.status(403).json({mensaje:'Solicitud no autorizada'});
  next();
 };
 for(const accion of ['confirmar-asistencia','solicitud-cancelacion'])app.post('/api/reservas/consulta/:token/'+accion,proteger,async(req,res)=>{
  let db;
  try{
   if(!UUID.test(req.params.token))throw fallo(400,'Enlace no válido');
   const body=req.body||{},campos=accion==='solicitud-cancelacion'?['motivo']:[];
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!campos.includes(k)))throw fallo(400,'Datos no válidos');
   const motivo=accion==='solicitud-cancelacion'?texto(body.motivo,true):null;
   db=await pool.connect();await db.query('BEGIN');
   const r=(await db.query(`SELECT r.id_reserva,r.estado,r.asistencia_confirmada_en,
    r.fecha_hora_inicio>CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' futura,
    EXISTS(SELECT 1 FROM abono WHERE id_reserva=r.id_reserva) tiene_abonos,
    EXISTS(SELECT 1 FROM abono WHERE id_reserva=r.id_reserva AND estado='aprobado') pagada
    FROM reserva r WHERE r.token_consulta=$1 FOR UPDATE OF r`,[req.params.token])).rows[0];
   if(!r)throw fallo(404,'Reserva no encontrada');
   const solicitud=(await db.query('SELECT id_solicitud,estado FROM solicitud_cancelacion WHERE id_reserva=$1',[r.id_reserva])).rows[0];
   if(accion==='solicitud-cancelacion'&&solicitud){await db.query('COMMIT');return res.json({mensaje:'La solicitud ya está registrada',solicitud});}
   if(!r.futura||!['pendiente_abono','confirmada'].includes(r.estado))throw fallo(409,'La reserva no permite esta acción');
   if(accion==='confirmar-asistencia'){
    if(r.estado!=='confirmada'||!r.pagada||solicitud?.estado==='pendiente')throw fallo(409,'No es posible confirmar asistencia');
    await db.query('UPDATE reserva SET asistencia_confirmada_en=COALESCE(asistencia_confirmada_en,CURRENT_TIMESTAMP) WHERE id_reserva=$1',[r.id_reserva]);
   }else{
    if(!r.tiene_abonos)throw fallo(409,'Puedes cancelar directamente esta reserva');
    await db.query('INSERT INTO solicitud_cancelacion(id_reserva,motivo) VALUES($1,$2)',[r.id_reserva,motivo]);
   }
   const detalle=await leer(db,r.id_reserva);await db.query('COMMIT');
   res.json({mensaje:accion==='confirmar-asistencia'?'Asistencia confirmada':'Solicitud registrada. La reserva sigue vigente; el emprendimiento debe revisarla.',...detalle});
  }catch(e){if(db)await db.query('ROLLBACK').catch(()=>{});res.status(e.http||503).json({mensaje:e.http?e.message:'No se pudo registrar la acción'});}
  finally{db?.release();}
 });
 app.get('/api/solicitudes-cancelacion',verificarSesion,async(req,res)=>{
  res.set('Cache-Control','no-store');
  try{res.json((await pool.query(`SELECT sc.*,e.id_emprendimiento FROM solicitud_cancelacion sc
   JOIN reserva r USING(id_reserva) JOIN emprendimiento e USING(id_emprendimiento)
   WHERE e.id_emprendedora=$1 ORDER BY sc.creada_en DESC`,[req.session.idEmprendedora])).rows);}
  catch{res.status(503).json({mensaje:'No se pudieron consultar las solicitudes'});}
 });
 app.patch('/api/solicitudes-cancelacion/:id/cerrar',verificarSesion,proteger,async(req,res)=>{
  let db;
  try{
   const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<=0||!req.body||Object.keys(req.body).some(k=>k!=='respuesta'))throw fallo(400,'Datos no válidos');
   const respuesta=texto(req.body.respuesta);
   db=await pool.connect();await db.query('BEGIN');
   const sc=(await db.query(`SELECT sc.id_solicitud,sc.estado FROM solicitud_cancelacion sc JOIN reserva r USING(id_reserva)
    JOIN emprendimiento e USING(id_emprendimiento) WHERE sc.id_solicitud=$1 AND e.id_emprendedora=$2 FOR UPDATE OF sc`,[id,req.session.idEmprendedora])).rows[0];
   if(!sc)throw fallo(404,'Solicitud no encontrada');
   if(sc.estado==='pendiente')await db.query(`UPDATE solicitud_cancelacion SET estado='cerrada',cerrada_en=CURRENT_TIMESTAMP,cerrada_por=$2,respuesta=$3 WHERE id_solicitud=$1`,[id,req.session.idEmprendedora,respuesta]);
   await db.query('COMMIT');res.json({mensaje:'Solicitud cerrada. La reserva y su abono no se modificaron.'});
  }catch(e){if(db)await db.query('ROLLBACK').catch(()=>{});res.status(e.http||503).json({mensaje:e.http?e.message:'No se pudo cerrar la solicitud'});}
  finally{db?.release();}
 });
}
module.exports={leer,montar,texto};
