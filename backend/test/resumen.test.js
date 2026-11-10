const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const ruta=require.resolve('../../frontend/back-office/resumen.js');
const {calcularResumenOperativo:calcular,calcularReservasPorCerrar}=require(ruta);
const contexto={idEmprendimientoConsultado:1,idEmprendimientoSeleccionado:1,consultaAutorizada:true,respuestaExitosa:true};
const referencia=Date.UTC(2026,10,9,13);
const reserva=(fecha='2026-11-09T11:00',extra={})=>({id_reserva:1,estado:'confirmada',fecha_hora_inicio:fecha,puede_cerrar:false,...extra});
const entrada=(reservas=[],extra={})=>({reservas,contexto:{...contexto},ahoraEpochMs:referencia,...extra});
const proxima=(reservas,extra)=>calcular(entrada(reservas,extra)).proximaAtencion;

// Oráculo: resolvedor exhaustivo anterior a la optimización. Se conserva solo
// en pruebas; el resto del contrato se ejecuta con el mismo código del módulo.
function resolverAnterior(grupos,relojes) {
    for(const [diaMs,horarios] of grupos) {
        const objetivos=new Map();
        for(const horario of horarios.values()) objetivos.set(relojes.utc.format(horario.civilMs),horario.instantes);
        for(let instante=diaMs-DIA;instante<diaMs+2*DIA;instante+=1000) {
            const destino=objetivos.get(relojes.chile.format(instante));
            if(destino) destino.push(instante);
        }
    }
}
function cargarVersion({anterior=false,contar=false}={}) {
    let fuente=fs.readFileSync(ruta,'utf8'), llamadas=0;
    if(anterior) {
        const inicio=fuente.indexOf('    function resolver('),fin=fuente.indexOf('    function calcularReservasPorCerrar(');
        assert.ok(inicio>=0 && fin>inicio);
        fuente=fuente.slice(0,inicio)+resolverAnterior.toString().replace('resolverAnterior','resolver')+'\n'+fuente.slice(fin);
    }
    const entorno={module:{exports:{}}};
    if(contar) entorno.Intl={DateTimeFormat:function(...args){
        const real=new Intl.DateTimeFormat(...args);
        return {resolvedOptions:()=>real.resolvedOptions(),format:valor=>{llamadas++;return real.format(valor);}};
    }};
    vm.runInNewContext(fuente,entorno);
    return {calcular:entorno.module.exports.calcularResumenOperativo,llamadas:()=>llamadas};
}
function medirRendimiento() {
    const {performance}=require('node:perf_hooks');
    console.log(JSON.stringify({node:process.version,icu:process.versions.icu,tz:process.versions.tz,temporal:typeof Temporal}));
    calcular(entrada([reserva()])); // calentamiento fuera de las mediciones
    for(const [n,dias,anteriorMs] of [[10,10,3969.64],[100,100,38784.28],[500,500,194473.15],[500,10,3888.93]]) {
        const reservas=Object.freeze(Array.from({length:n},(_,i)=>Object.freeze({id_reserva:i+1,estado:'confirmada',puede_cerrar:i%2===0,
            fecha_hora_inicio:new Date(Date.UTC(2026,0,1+i%dias,11,Math.floor(i/dias)%60)).toISOString().slice(0,19)})));
        const datos=Object.freeze(entrada(reservas,{contexto:Object.freeze({...contexto}),ahoraEpochMs:Date.UTC(2025,11,31)}));
        const antes=JSON.stringify(datos),inicio=performance.now(),resultado=calcular(datos),ms=performance.now()-inicio;
        assert.equal(JSON.stringify(datos),antes);assert.equal(resultado.reservasPorCerrar.cantidad,n/2);
        assert.equal(resultado.proximaAtencion.inicioEpochMs,Date.UTC(2026,0,1,14));
        // Fechas consecutivas: la unión de ventanas de 3 días tiene D+2 días.
        console.log(JSON.stringify({reservas:n,dias,anteriorMs,optimizadoMs:+ms.toFixed(2),factor:+(anteriorMs/ms).toFixed(2),
            llamadasIntlAnteriores:259200*dias+n,llamadasIntlOptimizadas:86400*(dias+2)+n,inmutable:true}));
    }
}
if(process.argv.includes('--medir-rendimiento')) medirRendimiento();
else {
test('sin Temporal el navegador informa indisponibilidad y el contador conserva su contrato',()=>{
    const entorno={Intl,Temporal:undefined};
    vm.runInNewContext(fs.readFileSync(ruta,'utf8'),entorno);
    vm.runInNewContext(fs.readFileSync(require.resolve('../../frontend/back-office/resumen-temporal.js'),'utf8'),entorno);
    const datos=entrada([reserva(undefined,{puede_cerrar:true})]);
    assert.equal(entorno.MerakiResumenTemporal.disponible(),false);
    for(const modulo of [entorno.MerakiResumen,entorno.MerakiResumenTemporal]){
        const salida=modulo.calcularResumenOperativo(datos);
        assert.equal(salida.proximaAtencion.estado,'no_disponible');
        assert.equal(salida.proximaAtencion.motivo,'zona_horaria_no_disponible');
        assert.equal(salida.reservasPorCerrar.cantidad,1);
    }
    assert.equal(entorno.MerakiResumen.calcularReservasPorCerrar(datos).cantidad,1);
});
test('contador aislado distingue vacío válido, contexto inválido y carga fallida',()=>{
    assert.equal(calcularReservasPorCerrar(entrada()).cantidad,0);
    assert.deepEqual(calcularReservasPorCerrar(entrada([],{contexto:null})),
        {estado:'no_disponible',cantidad:null,motivo:'contexto_no_valido'});
    assert.equal(calcularReservasPorCerrar(entrada([],{contexto:{...contexto,respuestaExitosa:false}})).cantidad,null);
    assert.equal(calcularReservasPorCerrar(entrada(null)).cantidad,null);
});
test('contador solo acepta true y funciona sin soporte para la próxima atención',()=>{
    const entorno={module:{exports:{}},Intl:{DateTimeFormat(){throw Error('No se puede resolver la fecha');}}};
    vm.runInNewContext(fs.readFileSync(ruta,'utf8'),entorno);
    const datos=entrada([true,false,null,undefined,'true',1,true].map(puede_cerrar=>({puede_cerrar,estado:'confirmada'})));
    const modulo=entorno.module.exports;
    assert.equal(modulo.calcularReservasPorCerrar(datos).cantidad,2);
    assert.equal(modulo.calcularResumenOperativo(datos).proximaAtencion.motivo,'zona_horaria_no_disponible');
});
test('contexto autorizado y vacío válido distinguen cero de indisponibilidad',()=>{
    const r=calcular(entrada());
    assert.equal(r.idEmprendimiento,1);
    assert.deepEqual(r.reservasPorCerrar,{estado:'disponible',cantidad:0});
    assert.equal(r.proximaAtencion.estado,'sin_proximas');
});
for (const [nombre,valor] of Object.entries({ausente:undefined,nulo:null,otroEmprendimiento:{...contexto,idEmprendimientoSeleccionado:2},noAutorizado:{...contexto,consultaAutorizada:false},idTexto:{...contexto,idEmprendimientoConsultado:'1'},idInvalido:{...contexto,idEmprendimientoConsultado:0}})) {
    test(`contexto inválido: ${nombre}`,()=>{
        const r=calcular(entrada([reserva()],{contexto:valor}));
        assert.equal(r.reservasPorCerrar.cantidad,null);
        assert.equal(r.proximaAtencion.motivo,'contexto_no_valido');
    });
}
test('entrada ausente no produce contadores cero',()=>assert.equal(calcular().reservasPorCerrar.cantidad,null));
test('respuesta fallida no produce contadores cero',()=>{
    assert.equal(calcular(entrada([],{contexto:{...contexto,respuestaExitosa:false}})).reservasPorCerrar.cantidad,null);
});
for(const valor of [undefined,null,{},'error']) test(`lista ausente o errónea: ${String(valor)}`,()=>{
    assert.equal(calcular({...entrada(),reservas:valor}).reservasPorCerrar.cantidad,null);
});
test('solo cuenta booleano puede_cerrar true, sin inferir permisos por estado',()=>{
    const r=calcular(entrada([reserva(undefined,{puede_cerrar:true}),reserva(undefined,{estado:'pendiente_abono',puede_cerrar:true}),reserva(),reserva(undefined,{puede_cerrar:'true'}),reserva(undefined,{puede_cerrar:1})]));
    assert.equal(r.reservasPorCerrar.cantidad,2);
});
test('acepta el contexto de la consulta sin inventar pertenencia por fila',()=>{
    assert.equal(calcular(entrada([reserva()])).proximaAtencion.estado,'disponible');
});
test('próxima confirmada devuelve proyección sin datos de clienta',()=>{
    const r=proxima([reserva(undefined,{clienta:'Persona ficticia',servicio:'Servicio ficticio',trabajadora:'Profesional ficticia'})]);
    assert.equal(r.inicioEpochMs,Date.UTC(2026,10,9,14));
    assert.equal(r.reserva.servicio,'Servicio ficticio');
    assert.equal('clienta' in r.reserva,false);
});
test('ordena cronológicamente sin modificar la lista y resuelve empates por ID',()=>{
    const r=proxima([reserva('2026-11-09T12:00',{id_reserva:3}),reserva('2026-11-09T11:00',{id_reserva:2}),reserva('2026-11-09T11:00',{id_reserva:1})]);
    assert.equal(r.reserva.id_reserva,1);
});
test('excluye pasado, instante exacto, canceladas y pendientes',()=>{
    assert.equal(proxima([reserva('2026-11-09T09:00'),reserva('2026-11-09T10:00'),reserva(undefined,{estado:'cancelada'}),reserva(undefined,{estado:'pendiente_abono'})]).estado,'sin_proximas');
});
test('cambio de día chileno no se confunde con fecha UTC',()=>{
    const r=proxima([reserva('2026-11-09T23:30')],{ahoraEpochMs:Date.UTC(2026,10,10,2)});
    assert.equal(r.inicioEpochMs,Date.UTC(2026,10,10,2,30));
});
for(const fecha of ['2026-02-30T11:00','2026-02-29T11:00','2026-11-09T24:00','2026-11-09T11:60','2026-11-09T11:00:60','2026-11-09T11:00Z','2026-11-09 11:00','0000-01-01T00:00',null]) {
    test(`fecha inválida no permite afirmar próxima: ${fecha}`,()=>{
        const r=calcular(entrada([reserva(fecha),reserva()]));
        assert.equal(r.exclusiones.fechasInvalidas,1);
        assert.equal(r.proximaAtencion.estado,'pendiente_revision');
    });
}
test('fecha bisiesta y segundos del backend se conservan',()=>{
    assert.equal(proxima([reserva('2028-02-29T11:00:05')]).inicioEpochMs,Date.UTC(2028,1,29,14,0,5));
});
test('invierno chileno usa sus reglas propias sin offset fijo de verano',()=>{
    assert.equal(proxima([reserva('2026-07-09T11:00')],{ahoraEpochMs:Date.UTC(2026,6,9,14)}).inicioEpochMs,Date.UTC(2026,6,9,15));
});
test('horario inexistente en septiembre no se corrige silenciosamente',()=>{
    const r=calcular(entrada([reserva('2026-09-06T00:30')],{ahoraEpochMs:Date.UTC(2026,8,5)}));
    assert.equal(r.exclusiones.horariosInexistentes,1);
    assert.equal(r.proximaAtencion.estado,'pendiente_revision');
});
test('horario repetido en abril impide asegurar la próxima posterior',()=>{
    const r=calcular(entrada([reserva('2026-04-04T23:30'),reserva('2026-04-05T00:30')],{ahoraEpochMs:Date.UTC(2026,3,5,1)}));
    assert.equal(r.exclusiones.horariosAmbiguos,1);
    assert.equal(r.proximaAtencion.estado,'pendiente_revision');
});
test('ambigüedad con una posibilidad pasada y otra futura sigue bloqueando',()=>{
    assert.equal(proxima([reserva('2026-04-04T23:30'),reserva('2026-04-05T00:30')],{ahoraEpochMs:Date.UTC(2026,3,5,2,45)}).estado,'pendiente_revision');
});
test('ambigüedad posterior no invalida una atención anterior inequívoca',()=>{
    const r=proxima([reserva('2026-04-04T23:30'),reserva('2026-04-04T22:30',{id_reserva:2})],{ahoraEpochMs:Date.UTC(2026,3,5,1)});
    assert.equal(r.estado,'disponible');assert.equal(r.reserva.id_reserva,2);
});
test('se cuentan exclusiones por registro, incluso horarios duplicados',()=>{
    const r=calcular(entrada([reserva('2026-04-04T23:30'),reserva('2026-04-04T23:30')],{ahoraEpochMs:0}));
    assert.equal(r.exclusiones.horariosAmbiguos,2);
});
test('fila nula no se interpreta como ausencia válida de reservas',()=>{
    const r=calcular(entrada([null]));
    assert.equal(r.exclusiones.registrosInvalidos,1);assert.equal(r.proximaAtencion.estado,'pendiente_revision');
});
test('estados no confirmados no generan incertidumbre temporal',()=>{
    assert.equal(proxima([reserva('inválida',{estado:'cancelada'})]).estado,'sin_proximas');
});
test('referencia explícita obligatoria, conservando permiso de cierre',()=>{
    const r=calcular(entrada([reserva(undefined,{puede_cerrar:true})],{ahoraEpochMs:undefined}));
    assert.equal(r.reservasPorCerrar.cantidad,1);assert.equal(r.proximaAtencion.motivo,'referencia_temporal_no_valida');
});
test('entradas congeladas no se alteran y salida no comparte objetos',()=>{
    const datos=entrada([reserva(undefined,{servicio:'Ficticio'})]);
    Object.freeze(datos.reservas[0]);Object.freeze(datos.reservas);Object.freeze(datos.contexto);Object.freeze(datos);
    const antes=JSON.stringify(datos),r=calcular(datos);
    r.proximaAtencion.reserva.servicio='Otro';assert.equal(JSON.stringify(datos),antes);
});
test('resultado independiente de la zona horaria del computador',()=>{
    const codigo=`const f=require(${JSON.stringify(ruta)}).calcularResumenOperativo;process.stdout.write(JSON.stringify(f(${JSON.stringify(entrada([reserva()]))})))`;
    const resultados=['UTC','Asia/Tokyo','America/Los_Angeles'].map(TZ=>execFileSync(process.execPath,['-e',codigo],{env:{...process.env,TZ},encoding:'utf8'}));
    assert.equal(resultados[0],resultados[1]);assert.equal(resultados[1],resultados[2]);
});
test('sin solicitudes externas, logs, almacenamiento ni reloj actual',()=>{
    const prohibido=()=>{throw Error('Efecto externo prohibido');};
    class Fecha extends Date {static now(){return prohibido();}}
    const entorno={module:{exports:{}},Intl,Date:Fecha,fetch:prohibido,XMLHttpRequest:prohibido,console:{log:prohibido},localStorage:new Proxy({},{get:prohibido}),sessionStorage:new Proxy({},{get:prohibido})};
    vm.runInNewContext(fs.readFileSync(ruta,'utf8'),entorno);
    assert.equal(entorno.module.exports.calcularResumenOperativo(entrada([reserva()])).proximaAtencion.estado,'disponible');
});
test('sin soporte IANA devuelve indisponibilidad explícita',()=>{
    const entorno={module:{exports:{}},Intl:{}};
    vm.runInNewContext(fs.readFileSync(ruta,'utf8'),entorno);
    const r=entorno.module.exports.calcularResumenOperativo(entrada());
    assert.equal(r.proximaAtencion.motivo,'zona_horaria_no_disponible');assert.equal(r.reservasPorCerrar.cantidad,0);
});

for(const [nombre,fechas] of [
    ['normales y ventanas solapadas desordenadas',['2026-11-11T11:00','2026-11-09T11:00','2026-11-10T11:00']],
    ['invierno y hora repetida',['2026-04-04T22:30','2026-04-04T23:30','2026-04-05T00:30']],
    ['verano y hora inexistente',['2026-09-06T00:30','2026-09-06T01:30','2026-09-07T11:00']],
    ['historia con segundos de offset',['1900-01-01T12:00:05','1910-01-10T00:00:00']],
    ['transiciones históricas de 1910',['1910-01-09T23:50:00','1910-01-10T00:10:00']],
    ['ventanas disjuntas y límites calendario',['2026-01-01T00:00:00','2026-01-05T23:59:59','2026-02-30T11:00']]
]) test(`equivalencia exacta con resolvedor anterior: ${nombre}`,()=>{
    const datos=entrada(fechas.map((fecha,i)=>Object.freeze(reserva(fecha,{id_reserva:i+1,puede_cerrar:i%2===0}))),{ahoraEpochMs:Date.UTC(1899,0,1)});
    Object.freeze(datos.reservas);Object.freeze(datos.contexto);Object.freeze(datos);
    const antes=JSON.stringify(datos);
    assert.equal(JSON.stringify(calcular(datos)),JSON.stringify(cargarVersion({anterior:true}).calcular(datos)));
    assert.equal(JSON.stringify(datos),antes);
});
test('unión de ventanas elimina segundos repetidos sin duplicar coincidencias',()=>{
    const datos=entrada([reserva('2026-11-11T11:00'),reserva('2026-11-09T11:00'),reserva('2026-11-10T11:00')]);
    const nuevo=cargarVersion({contar:true}),anterior=cargarVersion({anterior:true,contar:true});
    assert.equal(JSON.stringify(nuevo.calcular(datos)),JSON.stringify(anterior.calcular(datos)));
    assert.equal(nuevo.llamadas(),5*86400+3);
    assert.equal(anterior.llamadas(),9*86400+3);
});
test('sin caché entre llamadas: permisos y referencia temporal se recalculan',()=>{
    const datos=entrada([reserva()]);
    assert.equal(calcular(datos).proximaAtencion.estado,'disponible');
    datos.reservas[0].puede_cerrar=true;datos.ahoraEpochMs=Date.UTC(2026,10,10);
    const resultado=calcular(datos);
    assert.equal(resultado.reservasPorCerrar.cantidad,1);assert.equal(resultado.proximaAtencion.estado,'sin_proximas');
});
}
