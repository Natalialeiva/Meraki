const fs=require('fs');const path=require('path');
require('dotenv').config({path:process.env.MERAKI_ENV_FILE||path.join(__dirname,'../.env'),quiet:true});
const {Pool}=require('pg');
(async()=>{
 const pool=new Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
 const archivo=path.join(__dirname,'../../docs/recuperacion-gmail-real.json');const evidencia=JSON.parse(fs.readFileSync(archivo,'utf8'));
 try{
  const candidatas=(await pool.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'meraki_mail_test_%'")).rows;
  const verificadas=[];
  for(const {nspname} of candidatas){
   if(!/^meraki_mail_test_[0-9a-f]{16}$/.test(nspname))continue;
   const r=await pool.query('SELECT 1 FROM "'+nspname+'".notificacion_correo WHERE id_mensaje=$1',[evidencia.idMensaje]);
   if(r.rows.length===1)verificadas.push(nspname);
  }
  if(verificadas.length>1)throw Error('Más de un esquema coincide; se requiere revisión');
  for(const nombre of verificadas)await pool.query('DROP SCHEMA "'+nombre+'" CASCADE');
  evidencia.consultaDisponible=false;evidencia.fechaCierre=new Date().toISOString();evidencia.limpiezaComprobada=true;
  fs.writeFileSync(archivo,JSON.stringify(evidencia,null,2));console.log(JSON.stringify({pruebaCerrada:true,esquemasEliminados:verificadas.length,datosRealesSinCambios:true}));
 }finally{await pool.end();}
})().catch(e=>{console.error(JSON.stringify({pruebaCerrada:false,codigo:e.code||'ERROR'}));process.exitCode=1;});
