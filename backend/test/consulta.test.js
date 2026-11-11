const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
function pantalla(respuestas) {
    const elementos = Object.fromEntries(['estado','detalle','pagar','cancelar','actualizar'].map(id=>['#'+id,{hidden:true,disabled:false,hijos:[],replaceChildren(){this.hijos=[];},append(p){this.hijos.push(p);}}]));
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

for (const civil of ['2026-11-18T15:00:00','2026-07-18T15:00:00','2026-12-31T23:59:59','2027-01-01T00:00:00','2026-04-04T23:30:00','2026-09-06T00:30:00']) {
 test('Presenta componentes civiles sin desplazar: '+civil,async()=>{
  const p=pantalla([{status:200,texto:JSON.stringify({reserva:{...reserva,fecha_hora_inicio:'1999-01-01T00:00:00Z',fecha_hora_inicio_civil:civil,fecha_hora_fin_civil:civil,zona_horaria:'America/Santiago'}})}]);
  await esperar();
  const texto=p.elementos['#detalle'].hijos.map(p=>p.textContent).join(' ');
  assert(texto.includes(civil.slice(8,10)+'/'+civil.slice(5,7)+'/'+civil.slice(0,4)));
  assert(texto.includes(civil.slice(11,16)));assert(texto.includes('hora de Santiago'));assert(!texto.includes('1999'));
 });
}
for (const valor of [undefined,null,'2026-02-30T15:00:00','2026-11-18T24:00:00','2026-11-18T15:00:00Z','texto']) {
 test('Horario no fiable no se inventa: '+valor,async()=>{
  const p=pantalla([{status:200,texto:JSON.stringify({reserva:{...reserva,fecha_hora_inicio:'2026-11-18T18:00:00Z',fecha_hora_inicio_civil:valor,zona_horaria:'America/Santiago'}})}]);await esperar();
  assert.match(p.elementos['#detalle'].hijos[0].textContent,/Horario no disponible/);
 });
}
test('Presentación independiente de la zona del navegador: no construye Date',async()=>{
 const codigo=fs.readFileSync(path.join(__dirname,'../../frontend/consulta/consulta.js'),'utf8');
 const contexto=vm.createContext({location:{hash:''},document:{querySelector:()=>({replaceChildren(){}}),createElement:()=>({})},URL,Date:class {constructor(){throw Error('Conversión local prohibida');}}});
 vm.runInContext(codigo,contexto);
 assert.equal(vm.runInContext("presentarHoraCivil('2026-11-18T15:00:00','America/Santiago')",contexto),'18/11/2026, 15:00 — hora de Santiago');
 const {spawnSync}=require('node:child_process');
 for(const zona of ['UTC','Asia/Tokyo','America/Santiago']) {
  const programa=`const vm=require('node:vm');const c=vm.createContext({location:{hash:''},document:{querySelector:()=>({replaceChildren(){}})},URL});vm.runInContext(${JSON.stringify(codigo)},c);process.stdout.write(vm.runInContext("presentarHoraCivil('2026-11-18T15:00:00','America/Santiago')",c));`;
  const r=spawnSync(process.execPath,['-e',programa],{env:{...process.env,TZ:zona},encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  assert.equal(r.stdout,'18/11/2026, 15:00 — hora de Santiago');
 }
});
