const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Dinero separa montos por profesional y servicio con etiquetas reales',()=>{
 class Nodo{constructor(){this.children=[];this.style={};}append(...n){this.children.push(...n);}replaceChildren(){this.children=[];}setAttribute(){} }
 const host=new Nodo(),doc={getElementById:id=>id==='contenidoDashboard'?host:null,createElement:()=>new Nodo()};
 const contexto={};vm.runInNewContext(fs.readFileSync(require.resolve('../../frontend/back-office/dashboard-dinero.js'),'utf8'),contexto);
 const api=require('../../frontend/back-office/dashboard-graficos');
 const filas=[{id_reserva:1,id_servicio:1,servicio:'Manicure',id_trabajadora:1,trabajadora:'Camila',estado:'confirmada',fecha_hora_inicio:'2026-11-01T09:00:00',precio_servicio:'20000',monto_abono:'5000'},{id_reserva:2,id_servicio:2,servicio:'Soft gel',id_trabajadora:5,trabajadora:'Claudia',estado:'pendiente_abono',fecha_hora_inicio:'2026-11-02T09:00:00',precio_servicio:'18000',monto_abono:'5000'}];
 contexto.MerakiDineroVisual.dibujar(doc,api.calcularMensual(filas,'2026-11'),filas,api);
 const texto=n=>[n.textContent||'',...n.children.map(texto)].join(' ');const t=texto(host);
 assert.match(t,/Camila/);assert.match(t,/Claudia/);assert.match(t,/Soft gel/);assert.match(t,/18\.000/);assert.match(t,/20\.000/);
});
