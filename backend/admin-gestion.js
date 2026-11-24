// Gestión administrativa local. No importa SDK, correo ni adaptadores financieros.
const {createHash,timingSafeEqual}=require('node:crypto');
const {PLAN}=require('./suscripcion-plan');
const fallo=(estado,mensaje)=>Object.assign(Error(mensaje),{estado});
const fecha=col=>`to_char(${col},'YYYY-MM-DD')`;
const cuentasSQL=`SELECT a.id_emprendedora,a.nombre AS responsable_nombre,a.apellido AS responsable_apellido,a.correo AS responsable_correo,a.estado AS estado_cuenta,
 e.id_emprendimiento,e.nombre,e.estado AS emprendimiento_activo,s.id_suscripcion,s.estado AS estado_suscripcion,s.monto_mensual,
 ${fecha('s.fecha_inicio')} AS fecha_inicio,${fecha('s.fecha_fin_prueba')} AS fecha_fin_prueba,${fecha('s.acceso_hasta')} AS acceso_hasta,${fecha('s.fecha_proximo_cobro')} AS fecha_proximo_cobro,s.renovacion_automatica,
 COALESCE(s.acceso_hasta>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date,FALSE) AS acceso_vigente,
 CASE WHEN s.id_suscripcion IS NULL THEN 'sin_suscripcion' WHEN s.acceso_hasta IS NULL OR s.acceso_hasta<=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date THEN 'vencida' WHEN s.fecha_fin_prueba>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date THEN 'gratuito' ELSE 'activa' END AS periodo,
 (SELECT i.estado FROM inscripcion_suscripcion i WHERE i.id_suscripcion=s.id_suscripcion ORDER BY i.id_inscripcion DESC LIMIT 1) AS estado_inscripcion,
 EXISTS(SELECT 1 FROM pago_suscripcion p WHERE p.id_suscripcion=s.id_suscripcion AND p.estado='pendiente') AS pago_pendiente
 FROM emprendedora a LEFT JOIN emprendimiento e USING(id_emprendedora) LEFT JOIN suscripcion s USING(id_emprendedora)`;
function pagina(valor){const n=Number(valor||1);if(!Number.isSafeInteger(n)||n<1||n>100000)throw fallo(400,'Página no válida');return n;}
function id(valor){const n=Number(valor);if(!Number.isSafeInteger(n)||n<1)throw fallo(400,'Identificador no válido');return n;}
function verificarCSRF(req){const token=req.get('X-Meraki-CSRF'),guardado=req.session.adminCSRF;if(typeof token!=='string'||typeof guardado!=='string'||!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(token),Buffer.from(guardado)))throw fallo(403,'Actualiza la página antes de confirmar la acción.');}
const camposEstado=['estado','renovacion_automatica','reintento_autorizado','acceso_hasta','fecha_proximo_cobro'];
const instantanea=s=>Object.fromEntries(camposEstado.map(k=>[k,s[k]]));
async function cancelar(pool,{administradora,suscripcion,motivo,clave}){
 if(!Number.isSafeInteger(administradora)||administradora<1)throw fallo(401,'Inicia sesión administrativa');
 suscripcion=id(suscripcion);
 if(typeof motivo!=='string'||motivo.trim().length<10||motivo.trim().length>500)throw fallo(400,'Escribe un motivo entre 10 y 500 caracteres.');
 motivo=motivo.trim();
 if(typeof clave!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(clave))throw fallo(400,'La solicitud necesita una clave válida. Actualiza el detalle.');
 const huella=createHash('sha256').update(JSON.stringify({suscripcion,motivo})).digest('hex');
 const db=await pool.connect();
 try{
  await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'");await db.query("SET LOCAL statement_timeout='15s'");
  // Serializa la misma clave antes de obtener el candado compartido con Oneclick.
  await db.query('SELECT pg_advisory_xact_lock(715,hashtext($1))',[administradora+':'+clave]);
  const previa=(await db.query('SELECT id_suscripcion,huella FROM historial_administrativo WHERE id_administradora=$1 AND clave=$2',[administradora,clave])).rows[0];
  if(previa){if(previa.huella!==huella)throw fallo(409,'La clave ya se utilizó para otra solicitud. Actualiza el detalle.');await db.query('COMMIT');return {cancelada:true,recuperada:true,inscripcion_oneclick:'sin_modificar',mensaje:'Cancelación local ya registrada. No se repitió la operación.'};}
  const referencia=(await db.query('SELECT id_emprendedora FROM suscripcion WHERE id_suscripcion=$1',[suscripcion])).rows[0];
  if(!referencia)throw fallo(404,'Suscripción no encontrada');
  const candado=(await db.query('SELECT pg_try_advisory_xact_lock(509,$1) AS disponible',[referencia.id_emprendedora])).rows[0].disponible;
  if(!candado)throw fallo(409,'Existe una operación de suscripción en curso. Espera y actualiza antes de cancelar.');
  const s=(await db.query(`SELECT id_suscripcion,estado,renovacion_automatica,reintento_autorizado,${fecha('acceso_hasta')} AS acceso_hasta,${fecha('fecha_proximo_cobro')} AS fecha_proximo_cobro FROM suscripcion WHERE id_suscripcion=$1 FOR UPDATE`,[suscripcion])).rows[0];
  if(s.estado==='cancelada'&&!s.renovacion_automatica&&!s.reintento_autorizado){await db.query('COMMIT');return {cancelada:true,ya_cancelada:true,inscripcion_oneclick:'sin_modificar',mensaje:'Las renovaciones ya están canceladas. No se modificó ningún registro.'};}
  if((await db.query("SELECT 1 FROM pago_suscripcion WHERE id_suscripcion=$1 AND estado='pendiente' LIMIT 1",[suscripcion])).rowCount)throw fallo(409,'Hay un cobro pendiente de resolución. Debe revisarse antes de cancelar; no se consultó al proveedor.');
  const posterior={...s,estado:'cancelada',renovacion_automatica:false,reintento_autorizado:false};
  await db.query("UPDATE suscripcion SET estado='cancelada',renovacion_automatica=FALSE,reintento_autorizado=FALSE,cancelada_fecha=CURRENT_TIMESTAMP WHERE id_suscripcion=$1",[suscripcion]);
  await db.query("UPDATE inscripcion_suscripcion SET estado='cancelada' WHERE id_suscripcion=$1 AND estado IN('iniciando','pendiente','confirmando','revision')",[suscripcion]);
  await db.query(`INSERT INTO historial_administrativo(id_administradora,id_suscripcion,operacion,motivo,resultado,clave,huella,anterior,posterior) VALUES($1,$2,'cancelar_renovacion_local',$3,'cancelada_localmente',$4,$5,$6,$7)`,[administradora,suscripcion,motivo,clave,huella,JSON.stringify(instantanea(s)),JSON.stringify(instantanea(posterior))]);
  await db.query("INSERT INTO evento_suscripcion(id_suscripcion,tipo,detalle) VALUES($1,'cancelacion_administrativa_local',$2)",[suscripcion,JSON.stringify({id_administradora:administradora,inscripcion_oneclick:'sin_modificar'})]);
  await db.query('COMMIT');
  return {cancelada:true,inscripcion_oneclick:'sin_modificar',acceso_hasta:s.acceso_hasta,mensaje:'Renovaciones canceladas en Meraki. Se conserva el período vigente y el historial. No se eliminó la inscripción en Oneclick ni se efectuaron reembolsos.'};
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
}
function montarGestionAdministrativa(api,{pool,asyncRuta,origen,cobrosSQL}){
 api.get('/emprendedoras',asyncRuta(async(req,res)=>{
  const q=String(req.query.q||'').trim(),estado=String(req.query.estado||''),cuenta=String(req.query.cuenta||''),p=pagina(req.query.pagina);
  if(q.length>150||!['','sin_suscripcion','gratuito','activa','vencida','cancelada'].includes(estado)||!['','activa','inactiva'].includes(cuenta))throw fallo(400,'Filtros no válidos');
  const where=`WHERE ($1='' OR position(lower($1) in lower(COALESCE(nombre,'')||' '||responsable_nombre||' '||responsable_apellido))>0) AND ($2='' OR ($2='cancelada' AND estado_suscripcion='cancelada') OR ($2<>'cancelada' AND periodo=$2 AND estado_suscripcion IS DISTINCT FROM 'cancelada')) AND ($3='' OR estado_cuenta::text=$3)`;
  const params=[q,estado,cuenta];const total=(await pool.query(`WITH cuentas AS (${cuentasSQL}) SELECT count(*)::int n FROM cuentas ${where}`,params)).rows[0].n;
  const filas=(await pool.query(`WITH cuentas AS (${cuentasSQL}) SELECT * FROM cuentas ${where} ORDER BY id_emprendedora LIMIT 50 OFFSET $4`,[...params,(p-1)*50])).rows;
  res.json({emprendedoras:filas,total,pagina:p,por_pagina:50});
 }));
 api.get('/emprendedoras/:id',asyncRuta(async(req,res)=>{
  const cuenta=id(req.params.id),p=pagina(req.query.pagina_cobros);
  const n=(await pool.query(cuentasSQL+' WHERE a.id_emprendedora=$1',[cuenta])).rows[0];if(!n)throw fallo(404,'Emprendedora no encontrada');
  const pagos=(await pool.query(`SELECT id_pago_suscripcion,monto,estado,proceso,intento,codigo_respuesta,${fecha('periodo_inicio')} AS periodo_inicio,${fecha('periodo_fin')} AS periodo_fin,to_char(fecha_pago AT TIME ZONE current_setting('TimeZone') AT TIME ZONE 'America/Santiago','YYYY-MM-DD HH24:MI:SS') AS fecha_pago FROM pago_suscripcion WHERE id_suscripcion=$1 ORDER BY id_pago_suscripcion DESC LIMIT 50 OFFSET $2`,[n.id_suscripcion,(p-1)*50])).rows;
  const total=(await pool.query('SELECT count(*)::int n FROM pago_suscripcion WHERE id_suscripcion=$1',[n.id_suscripcion])).rows[0].n;
  res.json({emprendimiento:n,plan:PLAN.version,cobros:pagos,total_cobros:total,pagina_cobros:p,inscripcion_oneclick:'no se consulta ni modifica desde este panel'});
 }));
 api.get('/indicadores',asyncRuta(async(req,res)=>{
  const n=(await pool.query(`SELECT (SELECT count(*)::int FROM emprendedora) emprendedoras,
   count(*) FILTER(WHERE estado='activa' AND acceso_hasta>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date)::int activas,
   count(*) FILTER(WHERE estado='prueba' AND fecha_fin_prueba>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date AND acceso_hasta>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date)::int gratuitas,
   count(*) FILTER(WHERE estado='cancelada')::int canceladas,
   count(*) FILTER(WHERE EXISTS(SELECT 1 FROM pago_suscripcion p WHERE p.id_pago_suscripcion=(SELECT max(u.id_pago_suscripcion) FROM pago_suscripcion u WHERE u.id_suscripcion=s.id_suscripcion) AND (p.estado='rechazado' OR p.estado='pendiente')))::int problemas_pago,
   (${cobrosSQL} SELECT count(*)::int FROM contabilizados) pagos_aprobados
   FROM suscripcion s`)).rows[0];res.json(n);
 }));
 api.get('/historial',asyncRuta(async(req,res)=>{
  const p=pagina(req.query.pagina);const total=(await pool.query('SELECT count(*)::int n FROM historial_administrativo')).rows[0].n;
  const filas=(await pool.query(`SELECT h.id_accion,a.correo administradora,h.id_suscripcion,e.nombre emprendimiento,h.operacion,h.motivo,h.resultado,to_char(h.fecha AT TIME ZONE 'America/Santiago','YYYY-MM-DD HH24:MI:SS') fecha FROM historial_administrativo h JOIN administradora a USING(id_administradora) JOIN suscripcion s USING(id_suscripcion) LEFT JOIN emprendimiento e USING(id_emprendedora) ORDER BY h.id_accion DESC LIMIT 50 OFFSET $1`,[(p-1)*50])).rows;
  res.json({acciones:filas,total,pagina:p,por_pagina:50});
 }));
 api.post('/suscripciones/:id/cancelar',origen,asyncRuta(async(req,res)=>{
  verificarCSRF(req);
  if(Object.keys(req.body||{}).some(k=>!['motivo','clave'].includes(k)))throw fallo(400,'Datos no válidos');
  res.json(await cancelar(pool,{administradora:req.administradora.id_administradora,suscripcion:req.params.id,motivo:req.body?.motivo,clave:req.body?.clave}));
 }));
}
module.exports={montarGestionAdministrativa,cancelar,cuentasSQL};
