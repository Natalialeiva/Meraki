const express=require('express');
const bcrypt=require('bcrypt');
const session=require('express-session');
const path=require('node:path');
const {randomBytes,createHash}=require('node:crypto');
const correoValido=v=>typeof v==='string'&&v.length<=150&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const normalizarCorreo=v=>correoValido(v)?v.trim().toLowerCase():null;

// No consulta proveedores ni tablas de abonos. Las fechas DATE no se desplazan.
const negociosSQL=`SELECT e.id_emprendimiento,e.nombre,e.estado AS emprendimiento_activo,
 a.id_emprendedora,a.nombre AS responsable_nombre,a.apellido AS responsable_apellido,a.correo AS responsable_correo,a.estado AS estado_cuenta,
 s.id_suscripcion,s.estado AS estado_suscripcion,
 to_char(s.fecha_inicio,'YYYY-MM-DD') AS fecha_inicio,to_char(s.fecha_fin_prueba,'YYYY-MM-DD') AS fecha_fin_prueba,
 to_char(s.acceso_hasta,'YYYY-MM-DD') AS acceso_hasta,to_char(s.fecha_proximo_cobro,'YYYY-MM-DD') AS fecha_proximo_cobro,
 s.renovacion_automatica,
 (SELECT i.estado FROM inscripcion_suscripcion i WHERE i.id_suscripcion=s.id_suscripcion ORDER BY i.id_inscripcion DESC LIMIT 1) AS estado_inscripcion,
 CASE WHEN s.id_suscripcion IS NULL THEN 'sin_suscripcion'
 WHEN s.acceso_hasta IS NULL OR s.acceso_hasta<=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date THEN 'vencida'
 WHEN s.fecha_fin_prueba>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date THEN 'gratuito'
 ELSE 'activa' END AS periodo,
 COALESCE(s.acceso_hasta>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date,FALSE) AS acceso_vigente
 FROM emprendimiento e JOIN emprendedora a USING(id_emprendedora)
 LEFT JOIN suscripcion s USING(id_emprendedora)`;
// Un solo cobro por período conocido. Los antiguos sin período no se fusionan sin evidencia.
const cobrosSQL=`WITH candidatos AS (
 SELECT p.*,(fecha_pago AT TIME ZONE current_setting('TimeZone') AT TIME ZONE 'America/Santiago') AS pago_santiago,
 row_number() OVER(PARTITION BY id_suscripcion,periodo_inicio,
 CASE WHEN periodo_inicio IS NULL THEN id_pago_suscripcion END ORDER BY id_pago_suscripcion) AS repeticion
 FROM pago_suscripcion p WHERE estado='aprobado' AND proceso='finalizado'
), contabilizados AS (SELECT * FROM candidatos WHERE repeticion=1)`;
const asyncRuta=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
function montarAdministracion(app,{pool,Store,limites={ip:30,cuenta:8},ahora=()=>Date.now()}){
 const api=express.Router(),paginas=express.Router();
 const guardarSesion=new Store({pool,tableName:'sesion_meraki',createTableIfMissing:true,pruneSessionInterval:false});
 const middleware=session({name:'meraki.admin.sid',secret:createHash('sha256').update('meraki-admin-v1:'+process.env.SESSION_SECRET).digest('hex'),
  store:guardarSesion,resave:false,saveUninitialized:false,rolling:true,
  cookie:{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:30*60*1000}});
 const cabeceras=(req,res,next)=>{res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});next();};
 api.use(cabeceras,middleware);paginas.use(cabeceras,middleware);
 const origen=(req,res,next)=>{
  if(req.get('X-Meraki-Action')!=='1'||req.get('Sec-Fetch-Site')==='cross-site'||(req.get('Origin')&&req.get('Origin')!==req.protocol+'://'+req.get('Host')))return res.status(403).json({mensaje:'Solicitud no autorizada'});
  next();
 };
 async function autorizar(req,res,next){
  if(!Number.isSafeInteger(req.session?.idAdministradora))return res.status(401).json({mensaje:'Inicia sesión administrativa'});
  if(!Number.isFinite(req.session.adminInicio)||ahora()-req.session.adminInicio>8*60*60*1000){await new Promise(resolve=>req.session.destroy(()=>resolve()));return res.status(401).json({mensaje:'La sesión administrativa venció. Inicia sesión nuevamente.'});}
  const r=await pool.query('SELECT id_administradora,correo FROM administradora WHERE id_administradora=$1 AND activa=TRUE',[req.session.idAdministradora]);
  if(!r.rows.length){await new Promise(resolve=>req.session.destroy(()=>resolve()));return res.status(401).json({mensaje:'Sesión administrativa no disponible'});}
  req.administradora=r.rows[0];next();
 }
 const intentos=new Map();
 function permitir(ip,correo){
  const t=ahora(),plazo=15*60*1000;
  for(const [k,v]of intentos)if(t-v.inicio>=plazo)intentos.delete(k);
  if(intentos.size>=5000)return false;
  let permitido=true;
  for(const [k,max]of [['ip:'+ip,limites.ip],['cuenta:'+createHash('sha256').update(correo||'invalida').digest('hex'),limites.cuenta]]){
   const v=intentos.get(k)||{inicio:t,n:0};v.n++;intentos.set(k,v);if(v.n>max)permitido=false;
  }return permitido;
 }
 let hashSimulado;
 api.post('/auth/login',origen,asyncRuta(async(req,res)=>{
  const correo=normalizarCorreo(req.body?.correo),password=req.body?.password;
  if(!permitir(req.ip,correo)){res.set('Retry-After','900');return res.status(429).json({mensaje:'Demasiados intentos. Espera 15 minutos antes de volver a ingresar.'});}
  if(!correo||typeof password!=='string'||Buffer.byteLength(password)>72||Object.keys(req.body||{}).some(k=>!['correo','password'].includes(k)))return res.status(401).json({mensaje:'Correo o contraseña no válidos'});
  const r=await pool.query('SELECT id_administradora,password_hash,activa FROM administradora WHERE correo=$1',[correo]);
  if(!hashSimulado)hashSimulado=bcrypt.hash(randomBytes(32).toString('hex'),12);
  const cuenta=r.rows[0],correcta=await bcrypt.compare(password,cuenta?.password_hash||await hashSimulado);
  if(!cuenta?.activa||!correcta)return res.status(401).json({mensaje:'Correo o contraseña no válidos'});
  await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
  req.session.idAdministradora=cuenta.id_administradora;
  req.session.adminInicio=ahora();req.session.adminCSRF=randomBytes(32).toString('hex');
  await new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
  res.json({mensaje:'Sesión administrativa iniciada'});
 }));
 api.post('/auth/logout',origen,asyncRuta(async(req,res)=>{
  await new Promise((resolve,reject)=>req.session.destroy(e=>e?reject(e):resolve()));
  res.clearCookie('meraki.admin.sid',{path:'/'}).json({mensaje:'Sesión administrativa cerrada'});
 }));
 api.use(asyncRuta(autorizar));
 api.get('/auth/yo',(req,res)=>res.json({...req.administradora,csrf:req.session.adminCSRF}));
 api.get('/emprendimientos',asyncRuta(async(req,res)=>{
  const q=String(req.query.q||'').trim(),estado=String(req.query.estado||''),cuenta=String(req.query.cuenta||''),pagina=Number(req.query.pagina||1);
  if(q.length>150||!['','sin_suscripcion','gratuito','activa','vencida','cancelada'].includes(estado)||!['','activa','inactiva'].includes(cuenta)||!Number.isSafeInteger(pagina)||pagina<1||pagina>100000)return res.status(400).json({mensaje:'Filtros no válidos'});
  const r=await pool.query(`WITH negocios AS (${negociosSQL}) SELECT *,count(*) OVER()::int AS total FROM negocios
   WHERE ($1='' OR position(lower($1) in lower(nombre||' '||responsable_nombre||' '||responsable_apellido))>0)
   AND ($2='' OR ($2='cancelada' AND estado_suscripcion='cancelada') OR ($2<>'cancelada' AND periodo=$2))
   AND ($3='' OR estado_cuenta::text=$3) ORDER BY id_emprendimiento LIMIT 50 OFFSET $4`,[q,estado,cuenta,(pagina-1)*50]);
  res.json({emprendimientos:r.rows.map(({total,...n})=>n),total:r.rows[0]?.total||0,pagina,por_pagina:50,zona_horaria:'America/Santiago'});
 }));
 api.get('/emprendimientos/:id',asyncRuta(async(req,res)=>{
  const id=Number(req.params.id),pagina=Number(req.query.pagina_cobros||1);
  if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(pagina)||pagina<1||pagina>100000)return res.status(400).json({mensaje:'Identificador o página no válidos'});
  const n=await pool.query(negociosSQL+' WHERE e.id_emprendimiento=$1',[id]);if(!n.rows.length)return res.status(404).json({mensaje:'Emprendimiento no encontrado'});
  const pagos=await pool.query(`SELECT id_pago_suscripcion,monto,estado,proceso,intento,
   to_char(periodo_inicio,'YYYY-MM-DD') AS periodo_inicio,to_char(periodo_fin,'YYYY-MM-DD') AS periodo_fin,
   to_char(fecha_creacion AT TIME ZONE current_setting('TimeZone') AT TIME ZONE 'America/Santiago','YYYY-MM-DD HH24:MI:SS') AS fecha_creacion,
   to_char(fecha_pago AT TIME ZONE current_setting('TimeZone') AT TIME ZONE 'America/Santiago','YYYY-MM-DD HH24:MI:SS') AS fecha_pago,
   count(*) OVER()::int AS total FROM pago_suscripcion WHERE id_suscripcion=$1 ORDER BY id_pago_suscripcion DESC LIMIT 50 OFFSET $2`,[n.rows[0].id_suscripcion,(pagina-1)*50]);
  res.json({emprendimiento:n.rows[0],cobros:pagos.rows.map(({total,...p})=>p),total_cobros:pagos.rows[0]?.total||0,pagina_cobros:pagina,zona_horaria:'America/Santiago'});
 }));
 api.get('/resumen',asyncRuta(async(req,res)=>{
  const partes=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const mes=req.query.mes||(partes.find(p=>p.type==='year').value+'-'+partes.find(p=>p.type==='month').value);
  if(typeof mes!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(mes))return res.status(400).json({mensaje:'Mes no válido'});
  const r=await pool.query(cobrosSQL+` SELECT COALESCE(sum(monto),0)::text AS total_registrado,
   COALESCE(sum(monto) FILTER(WHERE pago_santiago>=($1||'-01')::date AND pago_santiago<($1||'-01')::date+interval '1 month'),0)::text AS mensual_registrado,
   count(*)::int AS cobros_contabilizados,count(*) FILTER(WHERE fecha_pago IS NULL)::int AS aprobados_sin_fecha,
   (SELECT count(*)::int FROM candidatos WHERE repeticion>1) AS duplicados_excluidos,
   current_setting('TimeZone') AS zona_origen_fechas FROM contabilizados`,[mes]);
  res.json({mes,zona_horaria:'America/Santiago',moneda:'CLP',...r.rows[0],criterio:'Cobros de suscripción aprobados y finalizados; un registro por período conocido. No incluye abonos de reservas. Fechas convertidas desde la zona PostgreSQL a Santiago; si cambió históricamente, revisar su procedencia. No acredita liquidaciones bancarias.'});
 }));
 require('./admin-gestion').montarGestionAdministrativa(api,{pool,asyncRuta,origen,cobrosSQL});
 api.use((req,res,next)=>{if(!['GET','HEAD'].includes(req.method))return res.status(405).set('Allow','GET, HEAD').json({mensaje:'Operación administrativa no permitida'});next();});
 const carpeta=path.join(__dirname,'../frontend/admin');
 paginas.get('/login',(req,res)=>res.sendFile(path.join(carpeta,'login.html')));
 paginas.get(['/admin.css','/admin.js'],(req,res)=>res.sendFile(path.join(carpeta,req.path)));
 paginas.use(asyncRuta(async(req,res,next)=>{
  if(!Number.isSafeInteger(req.session?.idAdministradora))return res.redirect(303,'/admin/login');
  return autorizar(req,res,next);
 }));
 paginas.get('/',(req,res)=>res.sendFile(path.join(carpeta,'index.html')));
 const fallo=(e,req,res,next)=>{if(res.headersSent)return next(e);res.status(e.estado||503).json({mensaje:e.estado?e.message:'Administración no disponible. Comprueba su instalación y vuelve a intentar.'});};
 api.use(fallo);paginas.use(fallo);
 app.use('/api/admin',api);app.use('/admin',paginas);
 return {store:guardarSesion};
}
module.exports={montarAdministracion,normalizarCorreo,negociosSQL,cobrosSQL};
