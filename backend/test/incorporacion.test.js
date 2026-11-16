const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalizarNegocio}=require('../incorporacion');
const {montar}=require('../../frontend/back-office/incorporacion');
test('Negocio valida campos protegidos, obligatorios y coordenadas manuales opcionales',()=>{
 assert.deepEqual(normalizarNegocio({nombre:' Estudio ',comuna:' Santiago '},{creacion:true}),{nombre:'Estudio',comuna:'Santiago'});
 assert.equal(normalizarNegocio({latitud:'-33.4',longitud:'-70.6'}).latitud,-33.4);
 for(const d of [{nombre:''},{nombre:'Uno'},{nombre:'Uno',comuna:'X',id_emprendedora:1},{nombre:'Uno',comuna:'X',latitud:1},{nombre:'Uno',comuna:'X',latitud:91,longitud:0},{nombre:'Uno',comuna:'X',latitud:'',longitud:''}])assert.throws(()=>normalizarNegocio(d,{creacion:true}));
});
function form(datos){const campos=Object.fromEntries(Object.entries(datos).map(([k,value])=>[k,{value}]));const fieldset={disabled:false};return {campos,elements:{namedItem:k=>campos[k]},querySelector:()=>fieldset,fieldset,reportValidity:()=>true,reset(){this.reiniciado=true;}};}
function pantalla(api,alCrearNegocio=async()=>{}){
 const registro=form({nombre:'Cuenta',apellido:'Nueva',rut:'11111111-1',correo:'cuenta@example.test',telefono:'',password:'clave-larga-para-fixture',confirmacion:'clave-larga-para-fixture'});
 const negocio=form({nombre:'Estudio',comuna:'Santiago',direccion:'',descripcion:'',telefono:'',latitud:'',longitud:''}),login=form({correo:''}),estado={textContent:''};
 montar({registro,negocio,login,estado,api,alCrearNegocio});return {registro,negocio,login,estado};
}
test('Registro UI conserva login existente y exige confirmación coincidente',async()=>{
 const llamadas=[];const p=pantalla(async(...args)=>llamadas.push(args));
 p.registro.campos.confirmacion.value='otra';await p.registro.onsubmit({preventDefault(){}});assert.equal(llamadas.length,0);
 p.registro.campos.confirmacion.value=p.registro.campos.password.value;await p.registro.onsubmit({preventDefault(){}});
 assert.equal(llamadas[0][0],'/api/auth/registro');assert(!Object.hasOwn(llamadas[0][2],'confirmacion'));assert.equal(p.login.campos.correo.value,'cuenta@example.test');assert(p.registro.reiniciado);
});
test('Alta de negocio evita doble envío, conserva errores y distingue recarga fallida',async()=>{
 let resolver,n=0;const p=pantalla(()=>{n++;return new Promise(r=>resolver=r);},async()=>{throw Error('Recarga');});
 const primero=p.negocio.onsubmit({preventDefault(){}});assert(p.negocio.fieldset.disabled);await p.negocio.onsubmit({preventDefault(){}});assert.equal(n,1);
 resolver({});await primero;assert.match(p.estado.textContent,/se guardó/);assert.equal(p.negocio.fieldset.disabled,false);
 const error=pantalla(async()=>{throw Error('Datos inválidos');});await error.negocio.onsubmit({preventDefault(){}});assert.equal(error.negocio.campos.nombre.value,'Estudio');assert.match(error.estado.textContent,/Datos inválidos/);
});

test('Mensajes de incorporación son locales y el registro devuelve foco al login',async()=>{
 const p=pantalla(async()=>({})),registro={textContent:''},negocio={textContent:''};let cerrado=false,enfocado=false,entradas=0;
 p.registro.closest=()=>({removeAttribute:k=>{cerrado=k==='open';}});p.login.campos.correo.focus=()=>enfocado=true;
 montar({registro:p.registro,negocio:p.negocio,login:p.login,estado:p.estado,estadoRegistro:registro,estadoNegocio:negocio,api:async()=>({}),alCrearNegocio:async()=>{entradas++;}});
 p.registro.campos.confirmacion.value='distinta';await p.registro.onsubmit({preventDefault(){}});assert.match(registro.textContent,/coincidir/);assert.equal(p.estado.textContent,'');
 p.registro.campos.confirmacion.value=p.registro.campos.password.value;await p.registro.onsubmit({preventDefault(){}});
 assert(cerrado&&enfocado);assert.equal(registro.textContent,'');assert.match(p.estado.textContent,/Cuenta creada/);
 p.estado.textContent='Sesión iniciada.';await p.negocio.onsubmit({preventDefault(){}});assert.equal(entradas,1);assert.equal(p.estado.textContent,'');assert.match(negocio.textContent,/creado/);
});
