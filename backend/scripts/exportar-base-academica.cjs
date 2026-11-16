// Genera una instalación sintética; nunca exporta meraki_db ni el sandbox histórico.
const fs=require('node:fs'),path=require('node:path');
const {randomUUID,createHash}=require('node:crypto'),{spawnSync}=require('node:child_process'),{Client}=require('pg');
const {cargarDatosAcademicos}=require('./datos-academicos.cjs');
const raiz=path.resolve(__dirname,'../..');
const env=require('dotenv').parse(fs.readFileSync(path.join(raiz,'backend/.env')));
const config={host:env.DB_HOST,port:+env.DB_PORT,user:env.DB_USER,password:env.DB_PASSWORD};
const migraciones=['schema.sql','migracion_abonos_reintentos.sql','002_agregar_token_consulta.sql','003_notificaciones_correo.sql','004_fecha_inicio_envio.sql','005_revision_notificaciones.sql','006_correccion_correo_reserva.sql','007_nombre_reserva.sql','008_suscripcion_oneclick.sql','009_intentos_webpay.sql','010_procesamiento_webpay.sql','011_reserva_invitada.sql','012_gestiones_reserva.sql'];
function pg(nombre,args){
 const bin=process.env.MERAKI_PG_BIN||'C:/Program Files/PostgreSQL/18/bin';
 const p=spawnSync(path.join(bin,nombre+(process.platform==='win32'?'.exe':'')),['-h',config.host,'-p',String(config.port),'-U',config.user,...args],{env:{...process.env,PGPASSWORD:config.password},encoding:'utf8',windowsHide:true});
 if(p.error||p.status!==0)throw Error('Falló '+nombre+' (salida privada omitida)');
}
async function main(){
 if(!process.argv.includes('--generar'))throw Error('Usar --generar');
 if(!['localhost','127.0.0.1','::1'].includes(config.host))throw Error('Solo PostgreSQL local');
 const carpeta=path.join(raiz,'database/academica');fs.mkdirSync(carpeta,{recursive:true});
 const archivo=path.join(carpeta,'meraki_db.sql');
 if(fs.existsSync(archivo))throw Error('Ya existe entrega académica: no sobrescribir');
 const admin=new Client({...config,database:'postgres'});const creadas=[];let c;
 try{
  await admin.connect();
  for(const uso of ['origen','restauracion']){
   const nombre='meraki_academica_'+uso+'_'+Date.now()+'_'+randomUUID().replaceAll('-','').slice(0,8);
   await admin.query('CREATE DATABASE '+nombre+' TEMPLATE template0');
   const oid=(await admin.query('SELECT oid FROM pg_database WHERE datname=$1',[nombre])).rows[0].oid;creadas.push({nombre,oid});
  }
  c=new Client({...config,database:creadas[0].nombre});await c.connect();
  for(const m of migraciones)await c.query(fs.readFileSync(path.join(raiz,'database',m),'utf8'));
  await c.query('BEGIN');await cargarDatosAcademicos(c);await c.query('COMMIT');await c.end();c=null;
  pg('pg_dump',['-d',creadas[0].nombre,'--no-owner','--no-acl','--file',archivo]);
  pg('psql',['-X','-v','ON_ERROR_STOP=1','--single-transaction','-d',creadas[1].nombre,'-f',archivo]);
  c=new Client({...config,database:creadas[1].nombre});await c.connect();
  const cuentas=(await c.query("SELECT count(*)::int n FROM emprendedora WHERE correo='valentina@luna.example.test' AND password_hash='!CUENTA_ACADEMICA_SIN_ACTIVAR!'")).rows[0].n;
  if(cuentas!==1)throw Error('Cuenta sintética no restaurada correctamente');
  for(const tabla of ['abono','reserva','notificacion_correo','inscripcion_suscripcion','pago_suscripcion','contacto_reserva_invitada','intento_reserva_invitada','solicitud_cancelacion']){
   if((await c.query('SELECT count(*)::int n FROM '+tabla)).rows[0].n!==0)throw Error('La entrega contiene operaciones no permitidas');
  }
  const comprobacion=(await c.query('SELECT (SELECT count(*) FROM servicio)::int servicios,(SELECT count(*) FROM trabajadora)::int trabajadoras,(SELECT count(*) FROM horario_atencion)::int horarios')).rows[0];
  if(comprobacion.servicios!==2||comprobacion.trabajadoras!==2||comprobacion.horarios!==12)throw Error('Catálogo incompleto');
  const recibo={archivo:'meraki_db.sql',sha256:createHash('sha256').update(fs.readFileSync(archivo)).digest('hex'),restauracionVerificada:true,baseDestino:'meraki_db',migracionesHasta:'012',...comprobacion,datos:'Inventados; sin pagos, sesiones, tokens privados ni credenciales activas'};
  fs.writeFileSync(path.join(carpeta,'verificacion.json'),JSON.stringify(recibo,null,2));console.log(JSON.stringify(recibo,null,2));
 }finally{
  if(c)await c.end().catch(()=>{});
  for(const {nombre,oid}of creadas.reverse()){
   if((await admin.query('SELECT oid FROM pg_database WHERE datname=$1',[nombre])).rows[0]?.oid!==oid)throw Error('Identidad temporal cambió; conservar');
   await admin.query('DROP DATABASE '+nombre);
  }
  await admin.end();console.log('Recursos temporales propios eliminados.');
 }
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
