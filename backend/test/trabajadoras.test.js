const {test}=require('node:test');const assert=require('node:assert/strict');
const {montar}=require('../../frontend/back-office/trabajadoras');
class Elemento{
 constructor(){this.children=[];this.value='';this.disabled=false;this.textContent='';}
 append(...h){this.children.push(...h);if(!this.value&&h[0]?.value)this.value=String(h[0].value);}
 replaceChildren(){this.children=[];this.value='';this.textContent='';}
 querySelectorAll(){return this.children.flatMap(h=>[...(h.onclick?[h]:[]),...h.querySelectorAll()]);}focus(){}
}
const trabajadora={id_trabajadora:1,id_emprendimiento:1,nombre:'Camila',apellido:'Prueba',descripcion:null,activa:true};
function pantalla(responder,confirmar=()=>true,puedeConfigurar=()=>true){
 const campos=Object.fromEntries(['nombre','apellido','descripcion'].map(k=>[k,new Elemento()]));
 const grupo=new Elemento(),titulo=new Elemento(),nueva=new Elemento(),lista=new Elemento(),estado=new Elemento(),selector=new Elemento(),actualizar=new Elemento(),asignados=new Elemento(),tituloAsignacion=new Elemento(),grupoAsignacion=new Elemento(),servicio=new Elemento();
 const form={elements:{namedItem:k=>campos[k]},querySelector:s=>s==='fieldset'?grupo:s==='[data-titulo-trabajadora]'?titulo:nueva,reset(){for(const e of Object.values(campos))e.value='';},reportValidity:()=>true};
 const asignacion={elements:{namedItem:()=>servicio},querySelector:()=>grupoAsignacion,reportValidity:()=>true};
 const llamadas=[];const api=async(url,method,datos)=>{
  llamadas.push({url,method,datos});if(responder){const r=await responder(url,method,datos);if(r!==undefined)return r;}
  if(url==='/api/mis-trabajadoras')return [trabajadora,{...trabajadora,id_trabajadora:2,id_emprendimiento:2,nombre:'Otra'}];
  if(url==='/api/mis-servicios')return [{id_servicio:1,id_emprendimiento:1,servicio:'Manicure',activo:true},{id_servicio:2,id_emprendimiento:1,servicio:'Pedicure',activo:false},{id_servicio:3,id_emprendimiento:2,servicio:'Ajeno',activo:true}];
  if(!method&&url.endsWith('/servicios'))return [];
  return {};
 };
 const gestion=montar({form,lista,estado,selector,actualizar,asignacion,asignados,tituloAsignacion,api,documento:{createElement:()=>new Elemento()},confirmar,puedeConfigurar});
 return{gestion,campos,lista,estado,grupo,selector,grupoAsignacion,servicio,asignados,llamadas,nueva,
  guardar:()=>form.onsubmit({preventDefault(){}}),asignar:()=>asignacion.onsubmit({preventDefault(){}}),ver:()=>lista.children[0].children[3].onclick()};
}
test('Trabajadoras muestra solo su negocio y deshabilita sin selección',async()=>{
 const p=pantalla();assert.equal(p.grupo.disabled,true);await p.gestion.cargar(1);assert.equal(p.lista.children.length,1);assert.equal(p.lista.children[0].children[0].textContent,'Camila Prueba');
 await p.gestion.cargar(null);assert.equal(p.grupo.disabled,true);assert.equal(p.lista.children.length,0);
});
test('Trabajadoras crea, edita y normaliza opcionales sin campos protegidos',async()=>{
 const p=pantalla();await p.gestion.cargar(1);p.campos.nombre.value=' Renata ';await p.guardar();
 assert.deepEqual(p.llamadas.find(x=>x.method==='POST').datos,{nombre:'Renata',apellido:null,descripcion:null,id_emprendimiento:1});
 p.lista.children[0].children[2].onclick();assert.equal(p.campos.nombre.value,'Camila');p.campos.apellido.value='';await p.guardar();
 const edicion=p.llamadas.find(x=>x.method==='PATCH');assert.equal(edicion.url,'/api/trabajadoras/1');assert.equal(edicion.datos.apellido,null);assert(!('activa'in edicion.datos));assert(!('id_emprendimiento'in edicion.datos));
});
test('Trabajadoras valida nombre y conserva edición ante error',async()=>{
 const p=pantalla(async(url,method)=>{if(method)throw Error('No se pudo guardar');});await p.gestion.cargar(1);p.campos.nombre.value=' ';await p.guardar();assert(!p.llamadas.some(x=>x.method));
 p.campos.nombre.value='Renata';await p.guardar();assert.equal(p.campos.nombre.value,'Renata');assert.match(p.estado.textContent,/No se pudo guardar/);assert.equal(p.grupo.disabled,false);
});
test('Asignaciones ofrece solo servicios activos propios sin asignar',async()=>{
 const p=pantalla();await p.gestion.cargar(1);await p.ver();assert.equal(p.servicio.children.length,1);assert.equal(p.servicio.children[0].textContent,'Manicure');
 await p.asignar();const envio=p.llamadas.find(x=>x.method==='POST');assert.equal(envio.url,'/api/trabajadoras/1/servicios');assert.deepEqual(envio.datos,{id_servicio:1});assert.match(p.estado.textContent,/asignado correctamente/);
});
test('Asignaciones permite retirar con confirmación y bloquea alta en trabajadora inactiva',async()=>{
 let aceptar=false;const p=pantalla(async(url,method)=>{
  if(url==='/api/mis-trabajadoras')return [{...trabajadora,activa:false}];
  if(!method&&url==='/api/trabajadoras/1/servicios')return [{id_servicio:1,nombre:'Manicure',activo:true}];
 },()=>aceptar);
 await p.gestion.cargar(1);await p.ver();assert.equal(p.grupoAsignacion.disabled,true);await p.asignar();assert(!p.llamadas.some(x=>x.method));
 await p.asignados.children[0].children[0].onclick();assert(!p.llamadas.some(x=>x.method));aceptar=true;await p.asignados.children[0].children[0].onclick();assert.equal(p.llamadas.find(x=>x.method).method,'DELETE');
});
test('Trabajadoras evita doble envío y distingue fallo de recarga posterior',async()=>{
 let terminar,guardado=false;const p=pantalla((url,method)=>{
  if(method)return new Promise(resolve=>{terminar=()=>{guardado=true;resolve({});};});if(guardado)throw Error('Sin conexión');
 });await p.gestion.cargar(1);p.campos.nombre.value='Renata';const primera=p.guardar();await p.guardar();assert.equal(p.llamadas.filter(x=>x.method).length,1);assert.equal(p.selector.disabled,true);
 terminar();await primera;assert.match(p.estado.textContent,/registrada correctamente/);assert.match(p.estado.textContent,/No se pudo actualizar/);assert.equal(p.selector.disabled,false);
});
test('Trabajadoras desactiva únicamente tras confirmación',async()=>{
 let aceptar=false;const p=pantalla(undefined,()=>aceptar);await p.gestion.cargar(1);await p.lista.children[0].children[4].onclick();assert(!p.llamadas.some(x=>x.method));
 aceptar=true;await p.lista.children[0].children[4].onclick();assert.equal(p.llamadas.find(x=>x.method).url,'/api/trabajadoras/1/desactivar');
});
test('Asignaciones ignora una respuesta antigua al cambiar de negocio',async()=>{
 let terminar;const p=pantalla((url,method)=>!method&&url==='/api/trabajadoras/1/servicios'?new Promise(resolve=>{terminar=resolve;}):undefined);
 await p.gestion.cargar(1);const pendiente=p.ver();await p.gestion.cargar(2);terminar([{id_servicio:1,nombre:'Respuesta anterior',activo:true}]);await pendiente;
 assert.equal(p.asignados.children.length,0);assert.equal(p.grupoAsignacion.disabled,true);assert.equal(p.lista.children[0].children[0].textContent,'Otra Prueba');
});
test('Trabajadoras y asignaciones quedan de consulta sin vigencia',async()=>{
 const p=pantalla(undefined,()=>true,()=>false);await p.gestion.cargar(1);assert.equal(p.grupo.disabled,true);
 p.campos.nombre.value='No guardar';await p.guardar();await p.ver();assert.equal(p.grupoAsignacion.disabled,true);await p.asignar();assert(!p.llamadas.some(x=>x.method));
});
