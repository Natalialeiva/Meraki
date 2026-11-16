const {test}=require('node:test'),assert=require('node:assert/strict');
const modulo=import('../../frontend/front-office/mapa-configuracion.mjs');
const config={habilitado:true,autorizado:true,apiKey:'CLAVE_FICTICIA_TEST',mapId:'mapa_test',entorno:'produccion'};
test('Configuración local diferida, compartida y sin datos personales',async()=>{
 const {crearLectorConfiguracion}=await modulo;let llamadas=0;
 const leer=crearLectorConfiguracion({mundo:{},solicitar:async(url,opciones)=>{llamadas++;assert.equal(url.pathname.endsWith('/mapas-config.local.json'),true);assert.equal(opciones.cache,'no-store');assert.equal(opciones.credentials,'omit');return {ok:true,json:async()=>config};}});
 assert.equal(llamadas,0);const datos=await Promise.all([leer(),leer()]);assert.equal(llamadas,1);assert.equal(datos[0].mapId,'mapa_test');
});
test('Ausencia, fallo, archivo inválido y configuración deshabilitada conservan alternativa',async()=>{
 const {crearLectorConfiguracion}=await modulo;
 for(const solicitar of [async()=>{throw Error('red simulada')},async()=>({ok:false}),async()=>({ok:true,json:async()=>{throw Error('JSON')}}),async()=>({ok:true,json:async()=>({...config,habilitado:false})})])assert.equal(await crearLectorConfiguracion({mundo:{},solicitar})(),null);
});
test('Configuración explícita por memoria conserva compatibilidad sin fetch',async()=>{
 const {crearLectorConfiguracion}=await modulo;const leer=crearLectorConfiguracion({mundo:{MERAKI_MAPAS_CONFIG:config},solicitar:()=>{throw Error('No consultar')}});assert.equal((await leer()).mapId,'mapa_test');
});
