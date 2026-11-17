// Usa la aplicación original; no simula ni altera resultados financieros.
const {leer}=require('./configuracion-evaluacion.cjs');
async function main(){
 const env=leer();
 Object.assign(process.env,env,{MERAKI_PROVEEDORES_EXTERNOS:'0',MERAKI_SUSCRIPCIONES_AUTOMATICAS:'0',TZ:'America/Santiago',PGOPTIONS:'-c timezone=America/Santiago'});
 const pool=require('../db');
 try{
  const r=await pool.query('SELECT current_database() nombre,to_regclass('public.reserva') IS NOT NULL esquema');
  if(r.rows[0].nombre!==env.DB_NAME||!r.rows[0].esquema)throw Error('La base no fue preparada para evaluación.');
  const app=require('../index');
  const server=app.listen(Number(env.PORT),'127.0.0.1',()=>console.log('Meraki evaluación: http://localhost:'+env.PORT+'/front-office/ — proveedores y renovaciones bloqueados.'));
  server.on('error',()=>{console.error('No se pudo abrir el puerto. Cierra tu otra instancia o cambia PORT y las URLs en .env.');process.exit(1);});
 }catch(error){await pool.end();throw error;}
}
main().catch(e=>{console.error('No se inició la evaluación: '+(e.code||e.message));process.exitCode=1;});
