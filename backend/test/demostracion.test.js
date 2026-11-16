const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {crearProveedorDemo}=require('../scripts/proveedor-demo.cjs');
test('Proveedor demo conserva orden/monto y solo aprueba después del formulario local',async()=>{
 const p=crearProveedorDemo('http://127.0.0.1:3002'),a=await p.create('orden-ficticia','sesion',5000,'http://127.0.0.1:3002/api/abonos/retorno/navegador');
 assert.match(a.token,/^[a-f0-9]{64}$/);assert.equal(new URL(a.url).protocol,'https:');
 assert.equal((await p.status(a.token)).status,'INITIALIZED');assert.equal(p.leer(a.token).monto,5000);
 const retorno=new URL(p.aprobar(a.token));assert.equal(retorno.origin,'http://127.0.0.1:3002');assert.equal(retorno.searchParams.get('token_ws'),a.token);
 const r=await p.commit(a.token);assert.equal(r.status,'AUTHORIZED');assert.equal(r.response_code,0);assert.equal(r.buy_order,'orden-ficticia');assert.equal(r.amount,5000);
});
test('Proveedor demo rechaza otros orígenes, retornos externos y operaciones desconocidas',async()=>{
 assert.throws(()=>crearProveedorDemo('https://otro.example'));
 const p=crearProveedorDemo('http://127.0.0.1:3002');
 await assert.rejects(p.create('orden','sesion',5000,'https://otro.example/api/abonos/retorno/navegador'));
 await assert.rejects(p.status('desconocida'));assert.throws(()=>p.aprobar('desconocida'));
});
test('Lanzador referencia SQL existente hasta 012 y conserva bloqueos externos',()=>{
 const script=fs.readFileSync(path.join(__dirname,'../scripts/demostracion-local-segura.cjs'),'utf8');
 for(const [,nombre]of script.matchAll(/'([^']+\.sql)'/g))assert.ok(fs.existsSync(path.join(__dirname,'../../database',nombre)),nombre);
 assert.match(script,/012_gestiones_reserva/);assert.match(script,/MERAKI_SUSCRIPCIONES_AUTOMATICAS:'0'/);assert.match(script,/crearOneclick:\(\)=>/);assert.match(script,/DROP DATABASE '\+base/);
});
test('Resumen académico omite identificadores y enlaces de la evidencia histórica',()=>{
 const text=fs.readFileSync(path.join(__dirname,'../../docs/recuperacion-gmail-academica.json'),'utf8'),j=JSON.parse(text);
 assert.equal(j.version,1);assert.ok(!('idMensaje' in j));assert.ok(!('urlBase' in j));assert.doesNotMatch(text,/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);assert.doesNotMatch(text,/https?:\/\//);
});
