const {test}=require('node:test');const assert=require('node:assert/strict');const {montar}=require('../../frontend/back-office/horarios');
class Elemento{constructor(){this.children=[];this.value='';this.disabled=false;this.textContent='';}append(...h){this.children.push(...h);}replaceChildren(){this.children=[];this.value='';this.textContent='';}querySelectorAll(){return this.children.flatMap(h=>[...(h.onclick?[h]:[]),...h.querySelectorAll()]);}focus(){}}
const persona={id_trabajadora:1,id_emprendimiento:1,nombre:'Camila',activa:true};
const horario={id_horario:5,id_trabajadora:1,id_emprendimiento:1,dia_semana:'lunes',hora_inicio:'09:00:00',hora_fin:'12:00:00',activo:true};
function pantalla(responder,confirmar=()=>true,puedeConfigurar=()=>true){
 const elementos=Object.fromEntries(['trabajadoraHorario','actualizarHorarios','estadoHorarios','listaHorarios','listaBloqueos','tituloEdicionHorario','nuevoHorario'].map(id=>['#'+id,new Elemento()]));
 function formulario(campos){const entradas=Object.fromEntries(campos.map(k=>[k,new Elemento()])),grupo=new Elemento();return{entradas,grupo,elements:{namedItem:k=>entradas[k]},querySelector:()=>grupo,reportValidity:()=>true,reset(){for(const e of Object.values(entradas))e.value='';}};}
 const form=formulario(['dia_semana','hora_inicio','hora_fin']),bloqueo=formulario(['fecha_inicio','fecha_fin','motivo']);elementos['#horarioGestion']=form;elementos['#bloqueoGestion']=bloqueo;
 const llamadas=[];const api=async(url,method,datos)=>{
  llamadas.push({url,method,datos});if(responder){const r=await responder(url,method,datos);if(r!==undefined)return r;}
  if(url==='/api/mis-trabajadoras')return[persona,{...persona,id_trabajadora:2,id_emprendimiento:2,nombre:'Otra'}];
  if(url==='/api/mis-horarios')return[horario];if(url==='/api/mis-bloqueos')return[{id_bloqueo:7,id_trabajadora:1,id_emprendimiento:1,fecha_inicio:'2030-11-04T10:00:00',fecha_fin:'2030-11-04T11:00:00',motivo:'Ausencia'}];return{};
 };
 const selector=new Elemento();const gestion=montar({contenedor:{querySelector:s=>elementos[s]},selectorNegocio:selector,api,documento:{createElement:()=>new Elemento()},confirmar,puedeConfigurar});
 return{gestion,elementos,form,bloqueo,llamadas,selector,guardar:()=>form.onsubmit({preventDefault(){}}),bloquear:()=>bloqueo.onsubmit({preventDefault(){}}),completar(){form.entradas.dia_semana.value='martes';form.entradas.hora_inicio.value='09:00';form.entradas.hora_fin.value='12:00';}};
}
test('Horarios carga solo el negocio elegido y deshabilita sin trabajadora',async()=>{
 const p=pantalla();await p.gestion.cargar(1);assert.equal(p.elementos['#listaHorarios'].children.length,1);assert.equal(p.form.grupo.disabled,false);
 await p.gestion.cargar(2);assert.equal(p.elementos['#listaHorarios'].children.length,0);assert.equal(p.elementos['#listaBloqueos'].children.length,0);
 await p.gestion.cargar(null);assert.equal(p.form.grupo.disabled,true);
});
test('Horarios crea y edita horas sin desplazamiento de zona horaria',async()=>{
 const p=pantalla();await p.gestion.cargar(1);p.completar();await p.guardar();assert.deepEqual(p.llamadas.find(x=>x.method==='POST').datos,{id_trabajadora:1,dia_semana:'martes',hora_inicio:'09:00',hora_fin:'12:00'});
 p.elementos['#listaHorarios'].children[0].children[0].onclick();assert.equal(p.form.entradas.hora_inicio.value,'09:00:00');await p.guardar();assert.equal(p.llamadas.find(x=>x.method==='PATCH').url,'/api/horarios/5');
});
test('Horarios rechaza rango invertido y conserva formulario ante error',async()=>{
 const p=pantalla(async(url,method)=>{if(method)throw Error('Horario superpuesto');});await p.gestion.cargar(1);p.completar();p.form.entradas.hora_fin.value='08:00';await p.guardar();assert(!p.llamadas.some(x=>x.method));
 p.form.entradas.hora_fin.value='12:00';await p.guardar();assert.equal(p.form.entradas.hora_inicio.value,'09:00');assert.match(p.elementos['#estadoHorarios'].textContent,/superpuesto/);
});
test('Bloqueos envía fechas locales literales y valida orden',async()=>{
 const p=pantalla();await p.gestion.cargar(1);const c=p.bloqueo.entradas;c.fecha_inicio.value='2030-11-04T10:00';c.fecha_fin.value='2030-11-04T09:00';await p.bloquear();assert(!p.llamadas.some(x=>x.method));
 c.fecha_fin.value='2030-11-04T11:00';c.motivo.value=' Ausencia ';await p.bloquear();assert.deepEqual(p.llamadas.find(x=>x.method==='POST').datos,{id_trabajadora:1,fecha_inicio:'2030-11-04T10:00',fecha_fin:'2030-11-04T11:00',motivo:'Ausencia'});
});
test('Horarios y bloqueos solicitan confirmación antes de retirar',async()=>{
 let aceptar=false;const p=pantalla(undefined,()=>aceptar);await p.gestion.cargar(1);await p.elementos['#listaHorarios'].children[0].children[1].onclick();assert(!p.llamadas.some(x=>x.method));
 aceptar=true;await p.elementos['#listaHorarios'].children[0].children[1].onclick();assert.equal(p.llamadas.find(x=>x.method).url,'/api/horarios/5/desactivar');
 await p.elementos['#listaBloqueos'].children[0].children[0].onclick();assert(p.llamadas.some(x=>x.method==='DELETE'&&x.url==='/api/bloqueos/7'));
});
test('Horarios conserva gestión de bajas pero no permite altas en trabajadora inactiva',async()=>{
 const p=pantalla(url=>url==='/api/mis-trabajadoras'?[{...persona,activa:false}]:undefined);await p.gestion.cargar(1);assert.equal(p.form.grupo.disabled,true);assert.equal(p.bloqueo.grupo.disabled,true);
 assert.equal(p.elementos['#listaHorarios'].children[0].children.length,1);assert.equal(p.elementos['#listaHorarios'].children[0].children[0].textContent,'Desactivar horario');
 p.completar();await p.guardar();assert(!p.llamadas.some(x=>x.method));
});
test('Horarios bloquea doble envío y distingue recarga fallida del guardado',async()=>{
 let terminar,guardado=false;const p=pantalla((url,method)=>{if(method)return new Promise(resolve=>{terminar=()=>{guardado=true;resolve({});};});if(guardado)throw Error('Sin conexión');});
 await p.gestion.cargar(1);p.completar();const pendiente=p.guardar();assert.equal(p.selector.disabled,true);await p.guardar();assert.equal(p.llamadas.filter(x=>x.method).length,1);
 terminar();await pendiente;assert.match(p.elementos['#estadoHorarios'].textContent,/registrado correctamente/);assert.match(p.elementos['#estadoHorarios'].textContent,/No se pudo actualizar/);
});
test('Horarios ignora una carga antigua al cambiar de negocio',async()=>{
 let terminar,primera=true;const p=pantalla(url=>{if(url==='/api/mis-horarios'&&primera){primera=false;return new Promise(resolve=>{terminar=resolve;});}});
 const anterior=p.gestion.cargar(1);await p.gestion.cargar(2);terminar([horario]);await anterior;assert.equal(p.elementos['#listaHorarios'].children.length,0);assert.equal(p.elementos['#trabajadoraHorario'].value,'2');
});
test('Horarios y bloqueos se consultan pero no se cambian sin suscripción vigente',async()=>{
 const p=pantalla(undefined,()=>true,()=>false);await p.gestion.cargar(1);assert.equal(p.form.grupo.disabled,true);assert.equal(p.bloqueo.grupo.disabled,true);
 assert.equal(p.elementos['#listaHorarios'].children.length,1);p.completar();await p.guardar();await p.elementos['#listaBloqueos'].children[0].children[0].onclick();assert(!p.llamadas.some(x=>x.method));
});
