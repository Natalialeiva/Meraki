const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {randomBytes}=require('node:crypto'),{Client}=require('pg');
const {cargarDatosAcademicos}=require('./datos-academicos.cjs');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
async function main(){
 const activar=process.argv.includes('--activar-cuenta-importada');
 if(!activar&&!process.argv.includes('--crear-nuevo-autorizado'))throw Error('Requiere autorización para crear datos académicos nuevos');
 if(process.env.DB_NAME!=='meraki_db'||!['localhost','127.0.0.1','::1'].includes(process.env.DB_HOST))throw Error('Solo base principal local');
 const carpeta=path.join(os.homedir(),'AppData/Local/Meraki/acceso-academico');fs.mkdirSync(carpeta,{recursive:true});
 const archivo=path.join(carpeta,'luna-estudio.json');
 if(fs.existsSync(archivo))throw Error('Ya existe un acceso privado: no sobrescribir');
 const c=new Client({host:process.env.DB_HOST,port:+process.env.DB_PORT,database:'meraki_db',user:process.env.DB_USER,password:process.env.DB_PASSWORD});
 let creado=false;
 try{
  await c.connect();await c.query('BEGIN');
  const clave=randomBytes(24).toString('base64url');
  let datos;
  if(activar){
   const fila=(await c.query("SELECT e.id_emprendedora cuenta,n.id_emprendimiento negocio,e.correo,n.nombre FROM emprendedora e JOIN emprendimiento n USING(id_emprendedora) WHERE e.correo='valentina@luna.example.test' AND e.rut='ACADEMICO-LUNA' AND e.password_hash='!CUENTA_ACADEMICA_SIN_ACTIVAR!' AND n.nombre='Luna Estudio' FOR UPDATE OF e")).rows;
   if(fila.length!==1)throw Error('Solo se activa la cuenta académica importada y todavía bloqueada');
   datos=fila[0];await c.query('UPDATE emprendedora SET password_hash=$1 WHERE id_emprendedora=$2',[await require('bcrypt').hash(clave,12),datos.cuenta]);
   await c.query("UPDATE suscripcion SET fecha_inicio=CURRENT_DATE,fecha_fin_prueba=(CURRENT_DATE+interval '1 month')::date,acceso_hasta=(CURRENT_DATE+interval '1 month')::date WHERE id_emprendedora=$1 AND estado='prueba' AND renovacion_automatica=false",[datos.cuenta]);
  }else datos=await cargarDatosAcademicos(c,{clave});
  fs.writeFileSync(archivo,JSON.stringify({...datos,clave},null,2),{flag:'wx',mode:0o600});creado=true;
  await c.query('COMMIT');creado=false;
  console.log(JSON.stringify({...datos,accesoPrivado:archivo,pagosCreados:0,correosEnviados:0},null,2));
 }catch(e){await c.query('ROLLBACK').catch(()=>{});if(creado)fs.unlinkSync(archivo);throw e;}
 finally{await c.end();}
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
