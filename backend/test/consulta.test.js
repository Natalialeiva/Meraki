const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
function pantalla(respuestas) {
    const elementos = Object.fromEntries(['estado','detalle','pagar','cancelar','actualizar'].map(id=>['#'+id,{hidden:true,disabled:false,replaceChildren(){},append(){}}]));
    const peticiones = [];
    const contexto = vm.createContext({
        location:{hash:'#11111111-1111-4111-8111-111111111111'},URL,confirm:()=>true,
        document:{querySelector:s=>elementos[s],createElement:()=>({})},
        fetch:async(url,opciones)=>{peticiones.push({url,method:opciones.method});const r=await respuestas.shift();return {ok:r.status===200,status:r.status,text:async()=>r.texto};}
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
const pendiente={id_reserva:1,estado:'pendiente_abono'};
const disponible={estado:'disponible',puede_iniciar:true,motivo:null};
const revision={estado:'en_revision',puede_iniciar:false,motivo:'intento_bloqueante'};
const datos=(pago,reserva=pendiente)=>({status:200,texto:JSON.stringify({reserva,pago})});
const esperar=()=>new Promise(setImmediate);

test('Solo un contrato de pago completo y habilitado muestra el botón',async()=>{
    for(const pago of [undefined,{puede_iniciar:true},{...disponible,motivo:undefined},revision]){
        const p=pantalla([datos(pago)]);await esperar();
        assert.equal(p.elementos['#pagar'].hidden,true);
        if(pago===revision)assert.match(p.elementos['#estado'].textContent,/Pago en revisión/);
    }
    const confirmada=pantalla([datos(disponible,reserva)]);await esperar();
    assert.equal(confirmada.elementos['#pagar'].hidden,true);
    const p=pantalla([datos({...disponible,estado:'rechazado'})]);await esperar();
    assert.equal(p.elementos['#pagar'].hidden,false);
    assert.equal(p.elementos['#pagar'].textContent,'Intentar de nuevo');
});

test('Doble clic envía un solo POST y un fallo exige volver a consultar',async()=>{
    let resolver;
    const inicio=new Promise(r=>resolver=r);
    const p=pantalla([datos(disponible),inicio,datos(revision)]);
    await esperar();
    const boton=p.elementos['#pagar'];
    assert.equal(boton.hidden,false);
    const intento=boton.onclick();
    assert.equal(boton.disabled,true);
    await boton.onclick();
    resolver({status:502,texto:'{}'});
    await intento;
    assert.deepEqual(p.peticiones.map(x=>x.method),['GET','POST','GET']);
    assert.equal(boton.hidden,true);
});

test('Una respuesta atrasada no habilita el pago después de una consulta fallida',async()=>{
    let resolver;
    const antigua=new Promise(r=>resolver=r);
    const p=pantalla([antigua,{status:500,texto:'{}'}]);
    await p.elementos['#actualizar'].onclick();
    resolver(datos(disponible));await esperar();
    assert.equal(p.elementos['#pagar'].hidden,true);
    assert.match(p.elementos['#estado'].textContent,/No se pudo completar/);
});
