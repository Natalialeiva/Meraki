const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
function pantalla(respuestas) {
    const elementos = Object.fromEntries(['estado','detalle','pagar','cancelar'].map(id=>['#'+id,{hidden:true,disabled:false,replaceChildren(){},append(){}}]));
    const peticiones = [];
    const contexto = vm.createContext({
        location:{hash:'#11111111-1111-4111-8111-111111111111'},URL,confirm:()=>true,
        document:{querySelector:s=>elementos[s],createElement:()=>({})},
        fetch:async(url,opciones)=>{peticiones.push({url,method:opciones.method});const r=respuestas.shift();return {ok:r.status===200,status:r.status,text:async()=>r.texto};}
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../../frontend/consulta/consulta.js'),'utf8'),contexto);
    return {elementos,peticiones};
}
const reserva={id_reserva:1,estado:'confirmada'};
test('Consulta de prueba oculta acciones antes de utilizarlas',async()=>{
    const p=pantalla([{status:200,texto:JSON.stringify({reserva,capacidades:{soloConsulta:true}})}]);
    await new Promise(setImmediate);
    assert.equal(p.elementos['#cancelar'].hidden,true);assert.equal(p.elementos['#pagar'].hidden,true);
    assert.match(p.elementos['#estado'].textContent,/solo consulta/);assert.equal(p.peticiones.length,1);
});
test('Rechazo 405 de texto muestra explicación y conserva reserva',async()=>{
    const p=pantalla([{status:200,texto:JSON.stringify({reserva})},{status:405,texto:'Prueba de consulta: solo lectura'}]);
    await new Promise(setImmediate);
    assert.equal(p.elementos['#cancelar'].hidden,false);
    await p.elementos['#cancelar'].onclick();
    assert.match(p.elementos['#estado'].textContent,/no se ha cancelado/);
    assert(!p.elementos['#estado'].textContent.includes('Unexpected token'));
    assert.equal(p.elementos['#cancelar'].hidden,true);assert.equal(p.peticiones.length,2);
});
test('Error HTML del servidor no se expone como error de JSON',async()=>{
    const p=pantalla([{status:500,texto:'<html>Error interno</html>'}]);await new Promise(setImmediate);
    assert.match(p.elementos['#estado'].textContent,/No se pudo completar/);
    assert(!p.elementos['#estado'].textContent.includes('<html>'));
});
test('Reserva con pago asociado no ofrece cancelación y explica la gestión',async()=>{
    const p=pantalla([{status:200,texto:JSON.stringify({mensaje:'Reserva encontrada',reserva,capacidades:{cancelar:false,motivoCancelacion:'Contacta al emprendimiento para gestionar la cancelación.'}})}]);
    await new Promise(setImmediate);
    assert.equal(p.elementos['#cancelar'].hidden,true);
    assert.match(p.elementos['#estado'].textContent,/Contacta al emprendimiento/);
});
test('Cancelación permitida actualiza estado y oculta las acciones',async()=>{
    const p=pantalla([{status:200,texto:JSON.stringify({reserva,capacidades:{cancelar:true}})},
        {status:200,texto:JSON.stringify({mensaje:'Reserva cancelada correctamente'})},
        {status:200,texto:JSON.stringify({reserva:{...reserva,estado:'cancelada'},capacidades:{cancelar:false}})}]);
    await new Promise(setImmediate);await p.elementos['#cancelar'].onclick();
    assert.equal(p.elementos['#cancelar'].hidden,true);assert.equal(p.elementos['#pagar'].hidden,true);
    assert.equal(p.peticiones[1].method,'PATCH');assert.equal(p.peticiones.length,3);
});
