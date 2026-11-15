// Crea y elimina solo una base nueva de esta ejecución. Nunca prueba en DB_NAME.
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {spawn}=require('node:child_process'),{Client}=require('pg');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
async function main(){
 if(process.argv[2]!=='--ejecutar')throw Error('Usa --ejecutar para autorizar la base efímera');
 const host=process.env.DB_HOST;if(!['localhost','127.0.0.1','::1'].includes(host))throw Error('Solo PostgreSQL local');
 const nombre='meraki_mvp_ejecucion_'+Date.now()+'_'+randomUUID().replaceAll('-','').slice(0,8);
 const config={host,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD};
 const admin=new Client({...config,database:'postgres'});let creada=false,oid;
 await admin.connect();
 try{
  await admin.query('CREATE DATABASE '+nombre+' TEMPLATE template0');creada=true;
  oid=(await admin.query('SELECT oid FROM pg_database WHERE datname=$1',[nombre])).rows[0].oid;
  const setup=new Client({...config,database:nombre});await setup.connect();
  try{await setup.query('CREATE EXTENSION btree_gist');}finally{await setup.end();}
  console.log('Base exclusiva de prueba: '+nombre);
  const files=fs.readdirSync(path.join(__dirname,'../test')).filter(f=>f.endsWith('.test.js')).map(f=>'test/'+f);
  const child=spawn(process.execPath,['--test',...files],{cwd:path.join(__dirname,'..'),stdio:'inherit',env:{...process.env,DB_NAME:nombre,MERAKI_DB_TEST:'1',MERAKI_MVP_DB_TEST:'1',MERAKI_SUSCRIPCIONES_AUTOMATICAS:'0'}});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  if(code!==0)process.exitCode=1;
 }finally{
  if(creada){
   const actual=(await admin.query('SELECT oid FROM pg_database WHERE datname=$1',[nombre])).rows[0];
   if(actual?.oid!==oid)throw Error('Identidad cambió: no eliminar');
   // No FORCE ni terminar sesiones ajenas: si quedaron conexiones, informar y conservar.
   await admin.query('DROP DATABASE '+nombre);console.log('Base efímera eliminada: '+nombre);
  }
  await admin.end();
 }
}
main().catch(e=>{console.error('Prueba aislada interrumpida: '+(e.code||e.message));process.exitCode=1;});
