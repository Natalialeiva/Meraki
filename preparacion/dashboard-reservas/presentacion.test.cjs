const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const {crearPresentador,formatearSantiago} = require('./presentacion.js');
const tiempo = Date.UTC(2026,10,18,18,4,12);
const contexto = (id=1,sesion='sesion-ficticia') => ({sesion,idEmprendimiento:id,nombre:'Negocio ficticio '+id});
const reserva = id => ({id_reserva:id,estado:'confirmada',fecha_hora_inicio:'2026-11-18T15:00:00',fecha_hora_fin:'2026-11-18T16:00:00'});
const respuesta = (reservas=[reserva(1)],extra={}) => ({reservas,recibidoEnEpochMs:tiempo,consultaAutorizada:true,respuestaExitosa:true,...extra});
function preparado() { const p=crearPresentador();p.cambiarContexto(contexto());return p; }
function cargar(p,datos=respuesta()) {const t=p.iniciarCarga();return p.aceptarRespuesta(t,datos);}

test('Contexto ausente no simula carga ni cero; valida contexto antes de modificar estado',()=>{
    const p=crearPresentador(), anterior=p.obtenerEstado();
    assert.equal(anterior.estado,'sin_contexto');assert.equal(anterior.datos.total,null);
    assert.throws(()=>p.iniciarCarga());assert.throws(()=>p.cambiarContexto(contexto(0)));
    assert.strictEqual(p.obtenerEstado(),anterior);
});
test('Cambio de emprendimiento limpia contexto anterior y solicita conservar foco en selector',()=>{
    const p=preparado();cargar(p);p.cambiarContexto(contexto(2));const s=p.obtenerEstado();
    assert.equal(s.estado,'cambio_emprendimiento');assert.equal(s.ultimaActualizacion.epochMs,null);
    assert.equal(s.datos.total,null);assert.equal(s.foco.destino,'selector_emprendimiento');
    assert(!JSON.stringify(s).includes('Negocio ficticio 1'));
});
test('Carga bloquea duplicados, oculta datos y no inventa marca',()=>{
    const p=preparado(),t=p.iniciarCarga();assert.strictEqual(p.iniciarCarga(),t);
    const s=p.obtenerEstado();assert.equal(s.estado,'cargando');assert.equal(s.datos.total,null);
    assert.equal(s.accesibilidad.ariaBusy,true);assert.equal(s.acciones.find(a=>a.id==='actualizar').habilitada,false);
    assert.equal(s.ultimaActualizacion.epochMs,null);
});
test('Solo una lista vacía válida presenta cero y registra carga exitosa',()=>{
    const p=preparado();assert(cargar(p,respuesta([])));const s=p.obtenerEstado();
    assert.equal(s.estado,'agenda_vacia');assert.equal(s.datos.total,0);assert.equal(s.datos.visibles,0);
    assert.equal(s.ultimaActualizacion.epochMs,tiempo);assert.equal(s.accesibilidad.ariaBusy,false);
});
test('Error de conexión inicial no se representa como agenda vacía',()=>{
    const p=preparado();assert(p.registrarError(p.iniciarCarga()));const s=p.obtenerEstado();
    assert.equal(s.estado,'error_carga');assert.equal(s.datos.total,null);assert.equal(s.datos.tratamiento,'ocultar');
    assert.equal(s.acciones[0].id,'reintentar');assert.equal(s.foco.accion,'conservar');
});
test('Actualización válida conserva alcance por negocio y no devuelve datos privados ni recalcula indicadores',()=>{
    const p=preparado();assert(cargar(p,respuesta([reserva(1),reserva(2)])));const s=p.obtenerEstado();
    assert.equal(s.estado,'actualizada');assert.equal(s.emprendimiento.id,1);assert.equal(s.datos.total,2);
    assert.equal(s.datos.indicadores,'usar_agenda_completa');
    assert(!JSON.stringify(s).includes('sesion-ficticia'));assert(!Object.hasOwn(s,'reservas'));
});
test('Filtro vacío sobre agenda no vacía conserva total y marca; repetirlo no duplica anuncio',()=>{
    const p=preparado();cargar(p,respuesta([reserva(1),reserva(2)]));const marca=p.obtenerEstado().ultimaActualizacion.epochMs;
    assert(p.aplicarFiltro([]));const s=p.obtenerEstado();assert.equal(s.estado,'filtros_sin_coincidencias');
    assert.equal(s.datos.total,2);assert.equal(s.datos.visibles,0);assert.equal(s.ultimaActualizacion.epochMs,marca);
    p.aplicarFiltro([]);assert.strictEqual(p.obtenerEstado(),s);
    p.aplicarFiltro([2]);assert.equal(p.obtenerEstado().estado,'actualizada');
});
test('Agenda completa vacía tiene prioridad sobre filtros vacíos',()=>{
    const p=preparado();cargar(p,respuesta([],{idsVisibles:[]}));p.aplicarFiltro([]);
    assert.equal(p.obtenerEstado().estado,'agenda_vacia');
});
test('Filtros no aceptan IDs ajenos, duplicados ni datos de entrada inválidos',()=>{
    const p=preparado();cargar(p);const previo=p.obtenerEstado();
    for(const ids of [[2],[1,1],null])assert.throws(()=>p.aplicarFiltro(ids));
    assert.strictEqual(p.obtenerEstado(),previo);
});
test('Recarga fallida mantiene última marca con advertencia y oculta agenda anterior',()=>{
    const p=preparado();cargar(p);const t=p.iniciarCarga();
    assert.equal(p.obtenerEstado().ultimaActualizacion.estado,'en_curso');
    p.registrarError(t);const s=p.obtenerEstado();assert.equal(s.estado,'error_actualizacion');
    assert.equal(s.ultimaActualizacion.epochMs,tiempo);assert.equal(s.ultimaActualizacion.estado,'fallida');
    assert.match(s.ultimaActualizacion.advertencia,/falló/);assert.equal(s.datos.total,null);
    assert.equal(p.aplicarFiltro([]),false);
});
test('Una nueva carga exitosa sustituye la marca fallida por la hora explícita aceptada',()=>{
    const p=preparado();cargar(p);p.registrarError(p.iniciarCarga());
    cargar(p,respuesta([],{recibidoEnEpochMs:tiempo+1000}));
    assert.equal(p.obtenerEstado().ultimaActualizacion.epochMs,tiempo+1000);
    assert.equal(p.obtenerEstado().ultimaActualizacion.advertencia,'');
});
test('A → B → A rechaza éxito y error de primera A incluso con mismo ID',()=>{
    const p=preparado(), a=p.iniciarCarga();p.cambiarContexto(contexto(2));const b=p.iniciarCarga();
    p.cambiarContexto(contexto(1));const nueva=p.iniciarCarga();const s=p.obtenerEstado();
    for(const ticket of [a,b]){assert.equal(p.aceptarRespuesta(ticket,respuesta()),false);assert.equal(p.registrarError(ticket,{sesionVencida:true}),false);}
    assert.strictEqual(p.obtenerEstado(),s);assert(p.aceptarRespuesta(nueva,respuesta()));
});
test('401 vigente borra nombre, marca y datos; sesión nueva rechaza 401 anterior',()=>{
    const p=preparado();cargar(p);const t=p.iniciarCarga();p.registrarError(t,{sesionVencida:true});
    const s=p.obtenerEstado();assert.equal(s.estado,'sesion_vencida');assert.equal(s.emprendimiento,null);
    assert.equal(s.ultimaActualizacion.estado,'oculta');assert.equal(s.foco.destino,'acceso');
    assert.deepEqual(s.acciones,[{id:'iniciar_sesion',habilitada:true}]);
    p.cambiarContexto(contexto(1,'otra-sesion'));const antes=p.obtenerEstado();
    assert.equal(p.registrarError(t,{sesionVencida:true}),false);assert.strictEqual(p.obtenerEstado(),antes);
});
test('Ticket reconstruido y respuesta repetida no modifican estado ni marca',()=>{
    const p=preparado(),t=p.iniciarCarga(),s=p.obtenerEstado();
    assert.equal(p.aceptarRespuesta({...t},respuesta()),false);assert.strictEqual(p.obtenerEstado(),s);
    p.aceptarRespuesta(t,respuesta());const aceptado=p.obtenerEstado();
    assert.equal(p.aceptarRespuesta(t,respuesta([],{recibidoEnEpochMs:tiempo+5000})),false);
    assert.strictEqual(p.obtenerEstado(),aceptado);
});
test('Tickets de otra instancia y cuerpos nulos no se aceptan como éxito',()=>{
    const p=preparado(),otro=preparado(),t=p.iniciarCarga(),ajeno=otro.iniciarCarga();
    const antes=p.obtenerEstado();assert.equal(p.aceptarRespuesta(ajeno,respuesta()),false);
    assert.strictEqual(p.obtenerEstado(),antes);assert.equal(p.aceptarRespuesta(t,null),false);
    assert.equal(p.obtenerEstado().estado,'error_carga');
});
for(const [nombre,datos] of [
    ['ausente',respuesta(undefined,{reservas:undefined})],['null',respuesta(null)],
    ['objeto',respuesta({})],['registro nulo',respuesta([null])],
    ['ID duplicado',respuesta([reserva(1),reserva(1)])],['estado inválido',respuesta([{...reserva(1),estado:'inventado'}])],
    ['negocio ajeno',respuesta([{...reserva(1),id_emprendimiento:2}])],
    ['no autorizada',respuesta([],{consultaAutorizada:false})],['fallo HTTP',respuesta([],{respuestaExitosa:false})],
    ['instante inválido',respuesta([],{recibidoEnEpochMs:NaN})],['visibles ajenos',respuesta([reserva(1)],{idsVisibles:[2]})]
])test('Respuesta inválida no registra cero ni marca: '+nombre,()=>{
    const p=preparado();assert.equal(cargar(p,datos),false);
    assert.equal(p.obtenerEstado().estado,'error_carga');assert.equal(p.obtenerEstado().ultimaActualizacion.epochMs,null);
});
test('Fecha civil indeterminada no es recalculada ni bloquea una respuesta estructural válida',()=>{
    const p=preparado();assert(cargar(p,respuesta([{...reserva(1),fecha_hora_inicio:'hora indeterminada'}])));
    assert.equal(p.obtenerEstado().estado,'actualizada');
});
test('Entradas congeladas y mutación posterior no alteran estado; salida profundamente inmutable',()=>{
    const p=preparado(),r=Object.freeze(reserva(1)),filas=Object.freeze([r]);
    assert(cargar(p,Object.freeze(respuesta(filas))));const s=p.obtenerEstado();
    for(const v of [s,s.datos,s.ultimaActualizacion,s.acciones,s.acciones[0],s.accesibilidad,s.emprendimiento])assert(Object.isFrozen(v));
    assert.throws(()=>{ 'use strict';s.emprendimiento.nombre='ajeno'; },TypeError);
    const otro=preparado(),entrada=[reserva(3)];cargar(otro,respuesta(entrada));entrada[0].id_reserva=99;entrada.push(reserva(4));
    assert(otro.aplicarFiltro([3]));assert.equal(otro.obtenerEstado().datos.total,1);
});
test('Cada estado publica mensaje, acciones, foco y un único identificador de anuncio',()=>{
    const p=preparado();const estados=[];const guardar=()=>estados.push(p.obtenerEstado());guardar();
    let t=p.iniciarCarga();guardar();p.registrarError(t);guardar();cargar(p,respuesta([]));guardar();
    cargar(p);guardar();p.aplicarFiltro([]);guardar();t=p.iniciarCarga();p.registrarError(t);guardar();
    t=p.iniciarCarga();p.registrarError(t,{sesionVencida:true});guardar();
    assert.equal(new Set(estados.map(s=>s.estado)).size,8);
    assert.equal(new Set(estados.map(s=>s.accesibilidad.anuncioId)).size,8);
    for(const s of estados){assert(s.mensaje);assert(s.acciones.length);assert(s.foco.destino);assert.equal(s.accesibilidad.role,'status');assert.equal(s.accesibilidad.ariaLive,'polite');assert.equal(s.accesibilidad.texto,s.mensaje);}
});
test('Santiago respeta verano, invierno y cruce de año, sin offsets constantes',()=>{
    assert.match(formatearSantiago(Date.UTC(2026,10,18,18,4,12)),/15:04:12/);
    assert.match(formatearSantiago(Date.UTC(2026,6,18,19,4,12)),/15:04:12/);
    const fin=formatearSantiago(Date.UTC(2027,0,1,1,4,12));assert.match(fin,/31.?12.?2026/);assert.match(fin,/22:04:12/);
});
test('Formato de instantes alrededor de cambios de horario de Chile conserva segundos',()=>{
    assert.match(formatearSantiago(Date.UTC(2026,3,5,2,59,59)),/23:59:59/);
    assert.match(formatearSantiago(Date.UTC(2026,3,5,3,0,0)),/23:00:00/);
    assert.match(formatearSantiago(Date.UTC(2026,8,6,3,59,59)),/23:59:59/);
    assert.match(formatearSantiago(Date.UTC(2026,8,6,4,0,0)),/01:00:00/);
});
test('Formato independiente de zona del proceso',()=>{
    for(const TZ of ['UTC','Asia/Tokyo','America/Santiago']){
        const programa=`process.stdout.write(require(${JSON.stringify(path.join(__dirname,'presentacion.js'))}).formatearSantiago(${tiempo}))`;
        const r=spawnSync(process.execPath,['-e',programa],{env:{...process.env,TZ},encoding:'utf8'});
        assert.equal(r.status,0,r.stderr);assert.equal(r.stdout,formatearSantiago(tiempo));
    }
});
test('Script de navegador sin DOM, red, backend, almacenamiento, temporizadores o Date del equipo',()=>{
    let llamadas=0;const prohibido=()=>{llamadas++;throw Error('Efecto externo prohibido');};
    const sandbox={Intl,fetch:prohibido,XMLHttpRequest:prohibido,setTimeout:prohibido,Date:class{constructor(){prohibido();}static now(){prohibido();}}};
    for(const nombre of ['document','localStorage','sessionStorage','WebSocket'])Object.defineProperty(sandbox,nombre,{get:prohibido});
    const c=vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'presentacion.js'),'utf8'),c);
    const p=c.MerakiPresentacionReservas.crearPresentador();p.cambiarContexto(contexto());
    assert(p.aceptarRespuesta(p.iniciarCarga(),respuesta()));assert.equal(llamadas,0);
    assert.equal(p.obtenerEstado().ultimaActualizacion.texto.includes('hora de Santiago'),true);
});
