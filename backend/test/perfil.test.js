const {test} = require('node:test');
const assert = require('node:assert/strict');
const {montar} = require('../../frontend/back-office/perfil');

function pantalla(api = async () => ({emprendimiento:negocio})) {
    const entradas = Object.fromEntries(['nombre','descripcion','direccion','comuna','telefono'].map(k=>[k,{value:'',focus(){}}]));
    const grupo = {disabled:false};
    const restaurar = {};
    const form = {elements:{namedItem:k=>entradas[k]},reportValidity:()=>true,
        querySelector:s=>s==='fieldset'?grupo:restaurar};
    const estado = {}, selector = {disabled:false}, guardados = [], llamadas = [];
    const perfil = montar({form,estado,selector,api:async(...args)=>{llamadas.push(args);return api(...args);},alGuardar:n=>guardados.push(n)});
    return {perfil,entradas,grupo,estado,selector,guardados,llamadas,restaurar,
        guardar:()=>form.onsubmit({preventDefault(){}})};
}
const negocio = {id_emprendimiento:7,nombre:'Belleza Camila',descripcion:null,comuna:'Santiago'};

test('Perfil sin emprendimiento deshabilita edición y no envía solicitudes',async()=>{
    const p=pantalla();assert.equal(p.grupo.disabled,true);await p.guardar();assert.equal(p.llamadas.length,0);
});
test('Perfil carga datos, permite restaurar y cambia al negocio seleccionado',()=>{
    const p=pantalla();p.perfil.cargar(negocio);assert.equal(p.entradas.nombre.value,negocio.nombre);assert.equal(p.entradas.descripcion.value,'');
    p.entradas.nombre.value='Sin guardar';p.restaurar.onclick();assert.equal(p.entradas.nombre.value,negocio.nombre);
    p.perfil.cargar({...negocio,id_emprendimiento:8,nombre:'Otro'});assert.equal(p.entradas.nombre.value,'Otro');
});
test('Perfil guarda solo campos editables, recorta espacios y limpia opcionales',async()=>{
    const p=pantalla(async()=>({emprendimiento:{...negocio,nombre:'Nombre nuevo'}}));p.perfil.cargar(negocio);
    p.entradas.nombre.value=' Nombre nuevo ';p.entradas.comuna.value=' Santiago ';await p.guardar();
    assert.deepEqual(p.llamadas,[['/api/emprendimientos/7','PATCH',{nombre:'Nombre nuevo',descripcion:null,direccion:null,comuna:'Santiago',telefono:null}]]);
    assert.equal(p.guardados.length,1);assert.equal(p.entradas.nombre.value,'Nombre nuevo');assert.match(p.estado.textContent,/guardado correctamente/);
});
test('Perfil rechaza nombre con espacios antes de enviar',async()=>{
    const p=pantalla();p.perfil.cargar(negocio);p.entradas.nombre.value='   ';await p.guardar();assert.equal(p.llamadas.length,0);assert.match(p.estado.textContent,/Indica el nombre/);
});
test('Perfil conserva edición ante error y libera controles para reintentar',async()=>{
    const p=pantalla(async()=>{throw Error('No se pudo guardar');});p.perfil.cargar(negocio);p.entradas.nombre.value='Edición pendiente';await p.guardar();
    assert.equal(p.entradas.nombre.value,'Edición pendiente');assert.equal(p.grupo.disabled,false);assert.equal(p.selector.disabled,false);assert.equal(p.guardados.length,0);assert.match(p.estado.textContent,/No se pudo guardar/);
});
test('Perfil bloquea doble envío y cambio de negocio mientras guarda',async()=>{
    let terminar;const p=pantalla(()=>new Promise(resolve=>{terminar=resolve;}));p.perfil.cargar(negocio);
    const primera=p.guardar();assert.equal(p.grupo.disabled,true);assert.equal(p.selector.disabled,true);await p.guardar();assert.equal(p.llamadas.length,1);
    terminar({emprendimiento:negocio});await primera;assert.equal(p.grupo.disabled,false);assert.equal(p.selector.disabled,false);
});
