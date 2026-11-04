const {test}=require('node:test');
const assert=require('node:assert/strict');
const {montar}=require('../../frontend/back-office/servicios');

class Elemento {
    constructor(){this.children=[];this.value='';this.disabled=false;this.textContent='';}
    append(...hijos){this.children.push(...hijos);}
    replaceChildren(){this.children=[];}
    querySelectorAll(){return this.children.flatMap(h=>[...(h.onclick?[h]:[]),...h.querySelectorAll()]);}
    focus(){}
}
const servicio={id_servicio:3,id_emprendimiento:1,id_categoria:1,servicio:'Manicure',categoria:'Uñas',precio:'20000',duracion_min:60,monto_abono:'5000',descripcion:null,activo:true};
function pantalla(responder,confirmar=()=>true){
    const campos=Object.fromEntries(['nombre','descripcion','id_categoria','precio','duracion_min','monto_abono'].map(k=>[k,new Elemento()]));
    const grupo=new Elemento(),nuevo=new Elemento(),titulo=new Elemento(),lista=new Elemento(),estado=new Elemento(),selector=new Elemento(),actualizar=new Elemento();
    const form={elements:{namedItem:k=>campos[k]},querySelector:s=>s==='fieldset'?grupo:s==='[data-nuevo-servicio]'?nuevo:titulo,
        reportValidity:()=>true,reset(){for(const c of Object.values(campos))c.value='';campos.id_categoria.value='1';}};
    const llamadas=[];
    const api=async(url,method,datos)=>{
        llamadas.push({url,method,datos});
        if(responder){const resultado=await responder(url,method,datos);if(resultado!==undefined)return resultado;}
        if(url==='/api/mis-servicios')return [servicio,{...servicio,id_servicio:4,id_emprendimiento:2,servicio:'Cabello ajeno'}];
        if(url==='/api/categorias')return [{id_categoria:1,nombre:'Uñas'},{id_categoria:2,nombre:'Cabello'}];
        return {servicio};
    };
    const gestion=montar({form,lista,estado,selector,actualizar,api,documento:{createElement:()=>new Elemento()},confirmar});
    return {gestion,campos,lista,estado,grupo,selector,actualizar,llamadas,nuevo,titulo,
        guardar:()=>form.onsubmit({preventDefault(){}}),completar(){Object.assign(campos.nombre,{value:' Servicio nuevo '});campos.precio.value='18000';campos.duracion_min.value='45';campos.monto_abono.value='4000';}};
}
test('Servicios carga categorías y lista solo el negocio seleccionado',async()=>{
    const p=pantalla();assert.equal(p.grupo.disabled,true);await p.gestion.cargar(1);assert.equal(p.lista.children.length,1);assert.equal(p.campos.id_categoria.children.length,2);assert.equal(p.grupo.disabled,false);
    await p.gestion.cargar(null);assert.equal(p.lista.children.length,0);assert.equal(p.grupo.disabled,true);
});
test('Servicios crea con datos normalizados y permite comenzar otro',async()=>{
    const p=pantalla();await p.gestion.cargar(1);p.completar();await p.guardar();
    const envio=p.llamadas.find(x=>x.method==='POST');assert.equal(envio.url,'/api/servicios');assert.deepEqual(envio.datos,{id_emprendimiento:1,id_categoria:1,nombre:'Servicio nuevo',descripcion:null,precio:18000,duracion_min:45,monto_abono:4000});
    assert.match(p.estado.textContent,/creado correctamente/);assert.equal(p.campos.nombre.value,'');
});
test('Servicios edita categoría, precio y duración sin enviar propietario ni estado',async()=>{
    const p=pantalla();await p.gestion.cargar(1);p.lista.children[0].children[2].onclick();assert.equal(p.campos.nombre.value,'Manicure');
    p.campos.id_categoria.value='2';p.campos.precio.value='25000';p.campos.duracion_min.value='90';await p.guardar();
    const envio=p.llamadas.find(x=>x.method==='PATCH');assert.equal(envio.url,'/api/servicios/3');assert.equal(envio.datos.id_categoria,2);assert.equal(envio.datos.precio,25000);assert.equal(envio.datos.duracion_min,90);assert(!('activo' in envio.datos));assert(!('id_emprendimiento' in envio.datos));
});
test('Servicios rechaza abono mayor al precio y conserva datos ante fallo al guardar',async()=>{
    const p=pantalla(async(url,method)=>{if(method)throw Error('Error de red');});await p.gestion.cargar(1);p.completar();p.campos.monto_abono.value='30000';await p.guardar();assert(!p.llamadas.some(x=>x.method));
    p.campos.monto_abono.value='4000';await p.guardar();assert.equal(p.campos.nombre.value,' Servicio nuevo ');assert.match(p.estado.textContent,/Error de red/);assert.equal(p.grupo.disabled,false);
});
test('Servicios distingue guardado correcto de falla posterior al recargar',async()=>{
    let guardado=false;const p=pantalla(async(url,method)=>{if(method){guardado=true;return {servicio};}if(guardado)throw Error('Recarga fallida');});
    await p.gestion.cargar(1);p.completar();await p.guardar();assert.match(p.estado.textContent,/creado correctamente/);assert.match(p.estado.textContent,/No se pudo actualizar la lista/);assert.equal(p.actualizar.disabled,false);
});
test('Servicios desactiva solo tras confirmación y usa la ruta correspondiente',async()=>{
    let aceptar=false;const p=pantalla(undefined,()=>aceptar);await p.gestion.cargar(1);await p.lista.children[0].children[3].onclick();assert(!p.llamadas.some(x=>x.method));
    aceptar=true;await p.lista.children[0].children[3].onclick();assert.equal(p.llamadas.find(x=>x.method).url,'/api/servicios/3/desactivar');assert.match(p.estado.textContent,/desactivado correctamente/);
});
test('Servicios evita doble envío y bloquea controles mientras guarda',async()=>{
    let terminar;const p=pantalla((url,method)=>method?new Promise(resolve=>{terminar=resolve;}):undefined);await p.gestion.cargar(1);p.completar();const guardando=p.guardar();
    assert.equal(p.grupo.disabled,true);assert.equal(p.selector.disabled,true);assert.equal(p.actualizar.disabled,true);await p.guardar();assert.equal(p.llamadas.filter(x=>x.method).length,1);
    terminar({servicio});await guardando;assert.equal(p.grupo.disabled,false);assert.equal(p.selector.disabled,false);
});
test('Servicios ignora carga anterior al cambiar de negocio',async()=>{
    let terminar,primera=true;const p=pantalla((url)=>{if(url==='/api/mis-servicios'&&primera){primera=false;return new Promise(resolve=>{terminar=resolve;});}});
    const anterior=p.gestion.cargar(1);await p.gestion.cargar(2);terminar([servicio]);await anterior;
    assert.equal(p.lista.children.length,1);assert.equal(p.lista.children[0].children[0].textContent,'Cabello ajeno');
    p.completar();await p.guardar();assert.equal(p.llamadas.find(x=>x.method==='POST').datos.id_emprendimiento,2);
});
