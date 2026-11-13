const {test}=require('node:test'),assert=require('node:assert/strict');
const {calcularComplementos:calcular,centavos,clp}=require('../../frontend/back-office/dashboard-graficos');
const {calcularMensual,mesActualSantiago}=require('../../frontend/back-office/dashboard-graficos');
const {calcularSerieReservas,periodosMensuales}=require('../../frontend/back-office/dashboard-graficos');
const {calcularEstadisticasReservas}=require('../../frontend/back-office/estadisticas-reservas');
const reserva=(id,extra={})=>({id_reserva:id,id_servicio:1,servicio:'Servicio',id_trabajadora:2,trabajadora:'Profesional',estado:'confirmada',fecha_hora_inicio:'2026-11-18T11:00:00',fecha_hora_fin:'2026-11-18T12:00:00',precio_servicio:'100.25',monto_abono:'20.10',...extra});
function evaluar(filas){
    const campos=['id_reserva','id_servicio','servicio','id_trabajadora','trabajadora','estado','fecha_hora_inicio','fecha_hora_fin'];
    const s=calcularEstadisticasReservas(filas.map(r=>Object.fromEntries(campos.map(k=>[k,r[k]]))));
    assert.equal(s.estado,'disponible');return calcular(filas,s.estadisticas);
}
test('Resumen histórico distingue todos los estados de las proyecciones activas',()=>{
    const estados=['confirmada','pendiente_abono','cancelada','atendida','no_atendida'];
    const r=evaluar(estados.map((estado,i)=>reserva(i+1,{estado}))).economia;
    assert.equal(r.estado,'disponible');assert.equal(r.sinCanceladas,40100);assert.equal(r.activas,20050);assert.equal(r.abonosActivas,4020);
    for(const estado of estados)assert.deepEqual(r.porEstado[estado],{reservas:1,servicios:10025,abonos:2010});
});
test('Meses observados usan fecha de atención civil, conservan huecos y cambio de año',()=>{
    const filas=[reserva(1,{fecha_hora_inicio:'2026-12-31T23:00:00',fecha_hora_fin:'2027-01-01T00:00:00'}),
        reserva(2,{fecha_hora_inicio:'2027-02-01T00:00:00',fecha_hora_fin:'2027-02-01T01:00:00'}),reserva(3)];
    assert.deepEqual(evaluar(filas).serieMensual,[{periodo:'2026-11',cantidad:1},{periodo:'2026-12',cantidad:1},{periodo:'2027-02',cantidad:1}]);
});
test('Vacío y filtro solo canceladas no inventan proyecciones activas',()=>{
    const vacio=evaluar([]);assert.deepEqual(vacio.serieMensual,[]);assert.equal(vacio.economia.sinCanceladas,0);
    const e=evaluar([reserva(1,{estado:'cancelada'})]).economia;
    assert.equal(e.activas,0);assert.equal(e.abonosActivas,0);assert.equal(e.sinCanceladas,0);assert.equal(e.porEstado.cancelada.servicios,10025);
});
test('Duplicados idénticos se suman una vez; importes contradictorios invalidan economía',()=>{
    const r=reserva(1);assert.equal(evaluar([r,{...r}]).economia.sinCanceladas,10025);
    const conflictivo=evaluar([r,{...r,precio_servicio:'200'}]);assert.equal(conflictivo.economia.estado,'no_disponible');
    assert.deepEqual(conflictivo.serieMensual,[{periodo:'2026-11',cantidad:1}]);
});
for(const valor of [null,undefined,'',NaN,Infinity,-1,'-2','1e3','10.001','99999999999']){
    test('Importe inválido no se convierte en cero ni en suma parcial: '+String(valor),()=>{
        assert.equal(centavos(valor),null);assert.equal(evaluar([reserva(1,{precio_servicio:valor})]).economia.estado,'no_disponible');
    });
}
test('Abono mayor al valor o ausente impide proyección económica',()=>{
    assert.equal(evaluar([reserva(1,{monto_abono:'101'})]).economia.estado,'no_disponible');
    assert.equal(evaluar([reserva(1,{monto_abono:null})]).economia.estado,'no_disponible');
});
test('Valores decimales se suman exactamente en centavos y se presentan en CLP',()=>{
    assert.equal(centavos(0),0);assert.equal(centavos('0.10'),10);
    assert.equal(evaluar([reserva(1,{precio_servicio:'0.10',monto_abono:0}),reserva(2,{precio_servicio:'0.20',monto_abono:0})]).economia.activas,30);
    assert.match(clp(2000025),/20\.000,25/);assert.match(clp(0),/\$.*0/);
});
test('La confirmación o un estado de abono no prueban ingresos; datos congelados no mutan',()=>{
    const fila=Object.freeze(reserva(1,{estado_abono:'aprobado',fecha_creacion:'1999-01-01'}));
    const lista=Object.freeze([fila]);const r=evaluar(lista);
    assert.equal(r.economia.abonosActivas,2010);assert(!('ingresos' in r.economia));assert.equal(r.serieMensual[0].periodo,'2026-11');
    assert.equal(fila.precio_servicio,'100.25');
});
test('Mes predeterminado respeta Santiago en cruces UTC de mes y año',()=>{
    assert.equal(mesActualSantiago(Date.UTC(2027,0,1,1)),'2026-12');
    assert.equal(mesActualSantiago(Date.UTC(2026,6,1,3)),'2026-06');
    assert.equal(mesActualSantiago(Date.UTC(2026,10,13,16)),'2026-11');
});
test('Resumen mensual excluye otras fechas y genera seis meses con cero explícito',()=>{
    const filas=[reserva(1),reserva(2,{fecha_hora_inicio:'2026-05-18T11:00:00'}),reserva(3,{estado:'cancelada'})];
    const r=calcularMensual(filas,'2026-11');
    assert.deepEqual(r.serie.map(m=>m.periodo),['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11']);
    assert(r.serie.slice(0,5).every(m=>m.activas===0&&m.abonosActivas===0));
    assert.equal(r.economia.activas,10025);assert.equal(r.economia.abonosActivas,2010);
});
test('Ventana mensual cruza año sin generar fechas ni importes fuera de seis meses',()=>{
    const r=calcularMensual([],'2027-02');
    assert.deepEqual(r.serie.map(m=>m.periodo),['2026-09','2026-10','2026-11','2026-12','2027-01','2027-02']);
    assert(r.serie.every(m=>m.estado==='disponible'&&m.activas===0));
});
test('Mes inválido no se sustituye silenciosamente por otro',()=>{
    for(const mes of ['',null,'2026-13','2026-00','2026-1','texto'])assert.equal(calcularMensual([],mes).estado,'no_disponible');
});
test('Importes inválidos de otro mes de la ventana no se representan como cero',()=>{
    const filas=[reserva(1),reserva(2,{fecha_hora_inicio:'2026-10-18T11:00:00',monto_abono:null})];
    const r=calcularMensual(filas,'2026-11');
    assert.equal(r.economia.estado,'disponible');assert.equal(r.serie[4].estado,'no_disponible');
    assert.equal(r.serie[4].activas,undefined);
});
test('Evolución de reservas comparte los seis períodos económicos y rellena ceros',()=>{
    const filas=[reserva(1),reserva(2),reserva(3,{fecha_hora_inicio:'2026-05-31T23:59:59'})];
    const serie=calcularSerieReservas(filas,'2026-11');
    assert.deepEqual(serie.map(m=>m.periodo),periodosMensuales('2026-11'));
    assert.deepEqual(serie.map(m=>m.periodo),calcularMensual(filas,'2026-11').serie.map(m=>m.periodo));
    assert.deepEqual(serie.map(m=>m.cantidad),[0,0,0,0,0,2]);
});
test('Evolución respeta cruces de año y componentes civiles de atención, no creación',()=>{
    const filas=[reserva(1,{fecha_hora_inicio:'2026-12-31T23:59:59',fecha_creacion:'2027-01-01'}),reserva(2,{fecha_hora_inicio:'2027-01-01T00:00:00'})];
    const serie=calcularSerieReservas(filas,'2027-02');
    assert.deepEqual(serie.map(m=>m.periodo),['2026-09','2026-10','2026-11','2026-12','2027-01','2027-02']);
    assert.deepEqual(serie.map(m=>m.cantidad),[0,0,0,1,1,0]);
});
test('Evolución vacía y duplicados cuentan reservas únicas, sin depender de pagos o montos',()=>{
    assert(calcularSerieReservas([],'2026-11').every(m=>m.cantidad===0));
    const r=Object.freeze(reserva(1,{monto_abono:null,id_abono:9}));
    assert.equal(calcularSerieReservas(Object.freeze([r,r]),'2026-11').at(-1).cantidad,1);
    assert.equal(calcularSerieReservas([],''),null);
});
