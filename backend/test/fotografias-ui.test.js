const {test}=require('node:test'),assert=require('node:assert/strict');const {montar}=require('../../frontend/back-office/fotografias');
const url='/media/servicios/11111111-1111-4111-8111-111111111111.webp';
function pantalla(api){
 const claves=['input','img','[data-estado-foto]','[data-titulo-foto]','[data-guardar-foto]','[data-quitar-foto]','[data-cancelar-foto]'];
 const nodos=Object.fromEntries(claves.map(k=>[k,{value:'',textContent:'',disabled:false,hidden:false,removeAttribute(n){delete this[n];}}]));
 const revocadas=[],c={querySelector:k=>nodos[k]},m=montar({contenedor:c,api,urls:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:u=>revocadas.push(u)},confirmar:()=>true});return {n:nodos,c,m,revocadas};
}
test('Fotografía UI: sin imagen, vista previa, guardar, reemplazar y retirar',async()=>{
 const llamadas=[];const p=pantalla(async(r,metodo,datos)=>{llamadas.push({r,metodo,datos});return {imagen:metodo==='PUT'?{url}:null};});
 await p.m.abrir({id_servicio:1,servicio:'Servicio'});assert(p.n.img.hidden);assert(p.n['[data-guardar-foto]'].disabled);
 const archivo={name:'foto.png',type:'image/png',size:100};p.n.input.files=[archivo];p.n.input.onchange();assert.equal(p.n.img.src,'blob:fixture');assert(!p.n.img.hidden);
 await p.n['[data-guardar-foto]'].onclick();assert.equal(llamadas.at(-1).datos,archivo);assert.equal(p.n.img.src,url);assert.equal(p.revocadas.length,1);
 p.n.input.files=[archivo];p.n.input.onchange();await p.n['[data-guardar-foto]'].onclick();assert.equal(p.n.img.src,url);
 await p.n['[data-quitar-foto]'].onclick();assert.equal(llamadas.at(-1).metodo,'DELETE');assert(p.n.img.hidden);
});
test('Fotografía UI rechaza tamaño y formato, y conserva la referencia anterior ante fallo',async()=>{
 const p=pantalla(async(r,metodo)=>{if(metodo)throw Error('No se guardó');return {imagen:{url}};});await p.m.abrir({id_servicio:1,servicio:'Servicio'});
 for(const archivo of [{name:'a.svg',type:'image/svg+xml',size:10},{name:'a.png',type:'image/png',size:6*1024*1024}]){p.n.input.files=[archivo];p.n.input.onchange();assert(p.n['[data-guardar-foto]'].disabled);assert.equal(p.n.img.src,url);}
 p.n.input.files=[{name:'a.png',type:'image/png',size:10}];p.n.input.onchange();await p.n['[data-guardar-foto]'].onclick();assert.equal(p.n.img.src,url);assert.match(p.n['[data-estado-foto]'].textContent,/No se guardó/);
 p.m.cerrar();assert(p.c.hidden);
});
test('Un archivo guardado ausente muestra un mensaje en vez de una imagen rota',async()=>{
 const p=pantalla(async()=>({imagen:{url}}));await p.m.abrir({id_servicio:1,servicio:'Servicio'});p.n.img.onerror();assert(p.n.img.hidden);assert.match(p.n['[data-estado-foto]'].textContent,/no está disponible/);assert.equal(p.n['[data-quitar-foto]'].disabled,false);
});
