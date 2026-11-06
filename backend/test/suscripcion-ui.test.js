const {test}=require('node:test'),assert=require('node:assert/strict');
const {montar}=require('../../frontend/back-office/suscripcion');
class Elemento{
 constructor(){this.children=[];this.checked=false;this.disabled=false;this.hidden=false;this.textContent='';}
 append(...h){this.children.push(...h);}replaceChildren(){this.children=[];}submit(){this.enviado=true;}
}
const plan={version:'meraki-9990-mes-v1'};
const activa={estado:'prueba',renovacion_automatica:true,fecha_fin_prueba:'2026-12-04',fecha_proximo_cobro:'2026-12-04',acceso_hasta:'2026-12-04',tarjeta_ultimos4:'6623',tarjeta_tipo:'Visa'};
function pantalla(responder){
 const elementos=Object.fromEntries(['estadoSuscripcion','detalleSuscripcion','pagosSuscripcion','consentimientoSuscripcion','inscribirSuscripcion','cancelarSuscripcion','reintentarSuscripcion','actualizarSuscripcion','consentimientoPlan'].map(id=>['#'+id,new Elemento()]));
 const cuerpo=new Elemento(),llamadas=[];let confirmar=true;
 const gestion=montar({contenedor:{querySelector:s=>elementos[s]},documento:{body:cuerpo,createElement:()=>new Elemento()},confirmar:()=>confirmar,
  api:async(url,method,datos)=>{llamadas.push({url,method,datos});return responder?responder(url,method,datos):{plan,suscripcion:null,pagos:[]};}});
 return {gestion,elementos,cuerpo,llamadas,confirmar:v=>{confirmar=v;},aceptar(){elementos['#consentimientoSuscripcion'].checked=true;elementos['#consentimientoSuscripcion'].onchange();}};
}
test('Suscripción UI solo consulta al cargar y exige consentimiento para inscribir',async()=>{
 const p=pantalla();await p.gestion.cargar();assert.equal(p.llamadas.length,1);assert.equal(p.llamadas[0].method,undefined);assert.equal(p.elementos['#inscribirSuscripcion'].disabled,true);
 p.aceptar();assert.equal(p.elementos['#inscribirSuscripcion'].disabled,false);
});
test('Suscripción UI inicia inscripción con el plan exacto y envía solo TBK_TOKEN a Transbank',async()=>{
 const p=pantalla((url,method)=>method?{url:'https://webpay3gint.transbank.cl/webpayserver/bp_multicode_inscription.cgi',token:'token-inscripcion-simulado'}:{plan,suscripcion:null,pagos:[]});
 await p.gestion.cargar();p.aceptar();await p.elementos['#inscribirSuscripcion'].onclick();
 assert.deepEqual(p.llamadas[1].datos,{acepta_renovacion:true,version_plan:plan.version});assert.equal(p.cuerpo.children.length,1);
 const form=p.cuerpo.children[0];assert.equal(form.method,'POST');assert.equal(form.enviado,true);assert.equal(form.children[0].name,'TBK_TOKEN');
});
test('Suscripción UI rechaza redirecciones fuera del proveedor y muestra error',async()=>{
 const p=pantalla((url,method)=>method?{url:'https://otro.example/inscribir',token:'token'}:{plan,suscripcion:null,pagos:[]});
 await p.gestion.cargar();p.aceptar();await p.elementos['#inscribirSuscripcion'].onclick();assert.equal(p.cuerpo.children.length,0);assert.match(p.elementos['#estadoSuscripcion'].textContent,/validar/);
});
test('Suscripción UI no ofrece otra prueba gratuita ni otra alta con tarjeta activa',async()=>{
 const p=pantalla(()=>({plan,suscripcion:activa,pagos:[]}));await p.gestion.cargar();p.aceptar();assert.equal(p.elementos['#inscribirSuscripcion'].disabled,true);
 assert.equal(p.elementos['#inscribirSuscripcion'].hidden,true);assert.equal(p.elementos['#consentimientoPlan'].hidden,true);assert.match(p.elementos['#inscribirSuscripcion'].textContent,/Tarjeta inscrita/);assert.equal(p.elementos['#cancelarSuscripcion'].hidden,false);
});
test('Suscripción UI distingue un pago incierto y no ofrece repetir el cargo',async()=>{
 const p=pantalla(()=>({plan,suscripcion:activa,pagos:[{estado:'pendiente',proceso:'revision',monto:9990,periodo_inicio:'2026-12-04',periodo_fin:'2027-01-04'}]}));
 await p.gestion.cargar();assert.match(p.elementos['#pagosSuscripcion'].children[0].textContent,/no se repetirá/);assert.equal(p.elementos['#reintentarSuscripcion'].hidden,true);
});
test('Suscripción UI cancela con confirmación y conserva éxito si falla la recarga',async()=>{
 let cancelada=false;const p=pantalla((url,method)=>{if(method){cancelada=true;return{mensaje:'Renovación cancelada'};}if(cancelada)throw Error('Sin conexión');return{plan,suscripcion:activa,pagos:[]};});
 await p.gestion.cargar();p.confirmar(false);await p.elementos['#cancelarSuscripcion'].onclick();assert.equal(p.llamadas.length,1);
 p.confirmar(true);await p.elementos['#cancelarSuscripcion'].onclick();assert.equal(p.llamadas[1].url,'/api/suscripcion/cancelar');assert.match(p.elementos['#estadoSuscripcion'].textContent,/Renovación cancelada/);
});
test('Suscripción UI exige aceptación y confirmación nuevas para reintentar un rechazo',async()=>{
 const p=pantalla((url,method)=>method?{mensaje:'Reintento autorizado'}:{plan,suscripcion:activa,pagos:[{estado:'rechazado',proceso:'finalizado',monto:9990}]});
 await p.gestion.cargar();assert.equal(p.elementos['#reintentarSuscripcion'].hidden,false);assert.equal(p.elementos['#reintentarSuscripcion'].disabled,true);assert.equal(p.elementos['#consentimientoPlan'].hidden,false);
 p.aceptar();p.confirmar(false);await p.elementos['#reintentarSuscripcion'].onclick();assert.equal(p.llamadas.length,1);
 p.confirmar(true);await p.elementos['#reintentarSuscripcion'].onclick();assert.equal(p.llamadas[1].url,'/api/suscripcion/reintentar');assert.equal(p.elementos['#consentimientoSuscripcion'].checked,false);
});
test('Suscripción UI bloquea doble inscripción mientras espera respuesta',async()=>{
 let terminar;const p=pantalla((url,method)=>method?new Promise(resolve=>{terminar=resolve;}):{plan,suscripcion:null,pagos:[]});await p.gestion.cargar();p.aceptar();
 const primero=p.elementos['#inscribirSuscripcion'].onclick();await p.elementos['#inscribirSuscripcion'].onclick();assert.equal(p.llamadas.filter(x=>x.method).length,1);
 terminar({url:'https://webpay3gint.transbank.cl/inscribir',token:'token'});await primero;assert.equal(p.cuerpo.children.length,1);
});
