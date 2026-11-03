const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('vm'),fs=require('fs'),path=require('path');
class Elemento{
 constructor(tag='div'){this.tag=tag;this.children=[];this.hidden=false;this.disabled=false;this.checked=false;this.textContent='';}
 set value(v){this._value=String(v);}get value(){return this._value!==undefined?this._value:this.tag==='select'?(this.children.find(c=>!c.disabled)?.value||''):'';}
 get selectedOptions(){return this.children.filter(c=>c.value===this.value);}
 append(...hijos){this.children.push(...hijos);}replaceChildren(){this.children=[];if(this.tag==='select')this._value=undefined;}
 requestSubmit(){return this.onsubmit({preventDefault(){},target:this});}
 reset(){for(const c of this.campos||[])c.value='';}
 querySelectorAll(){return this.campos||[];}
}
function iniciar({servicios,profesionales}={}){
 const ids=['estado','reserva','resultados','buscar','formReserva','camposReserva','servicio','profesional','fecha','hora','confirmarDatos','crearReserva','avisoServicio','tituloReserva','disponibilidad','consulta','nuevaReserva','limpiarBusqueda','resumen'];
 const elementos=Object.fromEntries(ids.map(id=>['#'+id,new Elemento(['servicio','profesional','hora'].includes(id)?'select':'div')]));
 const nombre=new Elemento('input'),correo=new Elemento('input'),telefono=new Elemento('input');nombre.name='nombre';correo.name='correo';telefono.name='telefono';
 elementos['#formReserva'].campos=[nombre,correo,telefono];elementos['#formReserva input[name="correo"]']=correo;
 const filtroNombre=new Elemento('input'),comuna=new Elemento('input');filtroNombre.name='nombre';comuna.name='comuna';elementos['#buscar'].campos=[filtroNombre,comuna];
 const peticiones=[];let reservasCreadas=0;
 const datosServicios=servicios||[{id_servicio:1,servicio:'Sin profesional',precio:15000,monto_abono:5000,reservable:false},{id_servicio:2,servicio:'Manicure permanente',precio:20000,monto_abono:5000,reservable:true}];
 const contexto=vm.createContext({Intl,Date,URLSearchParams,console,
  document:{querySelector:s=>{if(!elementos[s])throw Error('Selector sin fixture: '+s);return elementos[s];},createElement:tag=>new Elemento(tag)},
  FormData:class{constructor(form){this.form=form;}*[Symbol.iterator](){for(const c of this.form.campos||[])yield[c.name,c.value];}},
  fetch:async(url,opciones)=>{peticiones.push({url,method:opciones.method});let datos;
   if(url.startsWith('/api/emprendimientos?'))datos=[{id_emprendimiento:1,nombre:'Belleza Camila',comuna:'Santiago'}];
   else if(url==='/api/emprendimientos/1/servicios')datos=datosServicios;
   else if(url.startsWith('/api/servicios/'))datos=profesionales?await profesionales(url):[{id_trabajadora:3,nombre:'Camila'}];
   else if(url.startsWith('/api/disponibilidad?'))datos=[{hora_inicio:'11:00:00'}];
   else if(url==='/api/clientas')datos={id_clienta:11};
   else if(url==='/api/reservas'){reservasCreadas++;datos={reserva:{id_reserva:21,token_consulta:'11111111-1111-4111-8111-111111111111'}};}
   else throw Error('Ruta de fixture inesperada');
   return{ok:true,status:200,text:async()=>JSON.stringify(datos)};
  }});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../../frontend/front-office/front.js'),'utf8'),contexto);
 return{elementos,peticiones,nombre,correo,filtroNombre,comuna,creadas:()=>reservasCreadas,async seleccionar(){await new Promise(setImmediate);return elementos['#resultados'].children[0].children[2].onclick();}};
}
test('Front Office selecciona servicio reservable y explica filtros',async()=>{const p=iniciar();await p.seleccionar();assert.equal(p.elementos['#servicio'].value,'2');assert.equal(p.elementos['#servicio'].children[0].disabled,true);assert.equal(p.elementos['#profesional'].value,'3');assert.equal(p.elementos['#crearReserva'].disabled,true);});
test('Ver todos borra ambos filtros y vuelve a consultar',async()=>{const p=iniciar();await new Promise(setImmediate);p.filtroNombre.value='Manicure';p.comuna.value='Otra comuna';p.elementos['#limpiarBusqueda'].onclick();await new Promise(setImmediate);assert.equal(p.filtroNombre.value,'');assert.equal(p.comuna.value,'');assert.match(p.peticiones.at(-1).url,/nombre=&comuna=/);});
test('Disponibilidad requiere fecha y cambiarla invalida hora y revisión',async()=>{const p=iniciar();await p.seleccionar();await p.elementos['#disponibilidad'].onclick();assert(!p.peticiones.some(r=>r.url.startsWith('/api/disponibilidad')));p.elementos['#fecha'].value='2030-11-04';await p.elementos['#disponibilidad'].onclick();assert.equal(p.elementos['#hora'].value,'11:00:00');p.elementos['#confirmarDatos'].checked=true;p.elementos['#fecha'].value='2030-11-05';p.elementos['#fecha'].onchange();assert.equal(p.elementos['#hora'].value,'');assert.equal(p.elementos['#confirmarDatos'].checked,false);});
test('Creación exige revisión y evita duplicación por doble envío',async()=>{const p=iniciar();await p.seleccionar();p.elementos['#fecha'].value='2030-11-04';await p.elementos['#disponibilidad'].onclick();p.nombre.value='Clienta prueba';p.correo.value='prueba@example.com';const form=p.elementos['#formReserva'];await form.requestSubmit();assert.equal(p.creadas(),0);p.elementos['#confirmarDatos'].checked=true;p.elementos['#confirmarDatos'].onchange();await Promise.all([form.requestSubmit(),form.requestSubmit()]);assert.equal(p.creadas(),1);assert.equal(p.elementos['#camposReserva'].disabled,true);assert.equal(p.elementos['#consulta'].hidden,false);assert.match(p.elementos['#estado'].textContent,/pendiente de abono/);});
test('Respuesta antigua de profesionales no reemplaza la selección nueva',async()=>{let resolver;const antigua=new Promise(r=>resolver=r);const p=iniciar({servicios:[{id_servicio:1,servicio:'Uno',precio:100,monto_abono:10,reservable:true},{id_servicio:2,servicio:'Dos',precio:200,monto_abono:20,reservable:true}],profesionales:async url=>url.includes('/1/')?antigua:[{id_trabajadora:8,nombre:'Profesional actual'}]});await new Promise(setImmediate);const pendiente=p.elementos['#resultados'].children[0].children[2].onclick();await new Promise(setImmediate);p.elementos['#servicio'].value='2';await p.elementos['#servicio'].onchange();resolver([{id_trabajadora:7,nombre:'Profesional anterior'}]);await pendiente;assert.equal(p.elementos['#profesional'].value,'8');});
