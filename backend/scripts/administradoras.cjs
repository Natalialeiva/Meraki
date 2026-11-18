// Aprovisionamiento exclusivamente local. Nunca recibe contraseñas por argumentos o archivos.
const bcrypt=require('bcrypt');
const {normalizarCorreo}=require('../administracion');
function argumentos(args){
 const [accion,...resto]=args,ci=resto.indexOf('--correo');
 if(!['crear','desactivar'].includes(accion)||ci<0||!resto.includes('--autorizar')||resto.length!==3||!normalizarCorreo(resto[ci+1]))throw Error('Uso: node scripts/administradoras.cjs crear|desactivar --correo cuenta@dominio --autorizar');
 return {accion,correo:normalizarCorreo(resto[ci+1])};
}
async function aprovisionar(pool,{accion,correo,password}){
 correo=normalizarCorreo(correo);if(!correo||!['crear','desactivar'].includes(accion))throw Error('Datos no válidos');
 if(accion==='crear'&&(typeof password!=='string'||password.length<12||Buffer.byteLength(password)>72))throw Error('Usa una contraseña de al menos 12 caracteres y hasta 72 bytes');
 const db=await pool.connect();try{
  await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'");
  await db.query('SELECT pg_advisory_xact_lock(714,14)');
  if(accion==='crear'){
   const hash=await bcrypt.hash(password,12);
   const r=await db.query('INSERT INTO administradora(correo,password_hash) VALUES($1,$2) RETURNING id_administradora,correo,activa',[correo,hash]);
   await db.query('COMMIT');return r.rows[0];
  }
  const r=await db.query('SELECT id_administradora,activa FROM administradora WHERE correo=$1 FOR UPDATE',[correo]);
  if(!r.rows.length)throw Error('Cuenta no encontrada');
  if(r.rows[0].activa&&(await db.query('SELECT count(*)::int AS n FROM administradora WHERE activa=TRUE')).rows[0].n<=1)throw Error('No se puede desactivar la última administradora activa; crea y comprueba primero la nueva cuenta');
  await db.query('UPDATE administradora SET activa=FALSE WHERE id_administradora=$1',[r.rows[0].id_administradora]);
  await db.query('COMMIT');return {id_administradora:r.rows[0].id_administradora,correo,activa:false};
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
}
function secreto(pregunta){
 return new Promise((resolve,reject)=>{
  const entrada=process.stdin;let valor='';process.stdout.write(pregunta);entrada.setRawMode(true);entrada.resume();entrada.setEncoding('utf8');
  const terminar=(error)=>{entrada.off('data',leer);entrada.setRawMode(false);entrada.pause();process.stdout.write('\n');error?reject(error):resolve(valor);};
  function leer(s){for(const ch of s){if(ch==='\u0003'){valor='';terminar(Error('Cancelado'));return;}if(ch==='\r'||ch==='\n'){terminar();return;}if(ch==='\u007f'||ch==='\b')valor=Array.from(valor).slice(0,-1).join('');else if(ch>=' '&&ch!=='\u001b')valor+=ch;}}
  entrada.on('data',leer);
 });
}
async function main(){
 const opts=argumentos(process.argv.slice(2));if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Requiere una terminal local interactiva; no se aceptan entradas redirigidas');
 require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
 if(!['localhost','127.0.0.1','::1'].includes(process.env.DB_HOST))throw Error('Solo se permite una instancia PostgreSQL local');
 const {Pool}=require('pg');const pool=new Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
 try{
  const destino=(await pool.query('SELECT current_database() AS base,inet_server_port() AS puerto')).rows[0];
  const rl=require('node:readline/promises').createInterface({input:process.stdin,output:process.stdout});
  let confirma;try{confirma=await rl.question(`Operación ${opts.accion} en ${destino.base}:${destino.puerto}. Escribe AUTORIZAR para continuar: `);}finally{rl.close();}
  if(confirma.trim().toUpperCase()!=='AUTORIZAR')throw Error('Operación cancelada');
  let password;
  if(opts.accion==='crear'){password=await secreto('Contraseña nueva (no se muestra): ');const repetida=await secreto('Repite la contraseña (no se muestra): ');if(password!==repetida)throw Error('Las contraseñas no coinciden');}
  const r=await aprovisionar(pool,{...opts,password});password=undefined;
  console.log(`Cuenta administrativa #${r.id_administradora}: ${r.activa?'creada':'desactivada'}. No se modificaron cuentas de emprendedoras ni suscripciones.`);
 }finally{await pool.end();}
}
if(require.main===module)main().catch(e=>{console.error(e.code?'No se pudo completar la operación; revisa la instalación o un correo duplicado.':e.message);process.exitCode=1;});
module.exports={argumentos,aprovisionar};
