const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {calcularEstadisticasReservas:calcular}=require('./estadisticas');
const reserva=(id,cambios={})=>({id_reserva:id,id_servicio:1,servicio:'Servicio ficticio',
    id_trabajadora:1,trabajadora:'Profesional ficticia',estado:'confirmada',
    fecha_hora_inicio:'2026-11-18T15:00:00',fecha_hora_fin:'2026-11-18T16:00:00',...cambios});
const obtener=filas=>{const r=calcular(filas);assert.equal(r.estado,'disponible');return r.estadisticas;};
test('Lista vacía: cero único, sin grupos ni ganadores o divisiones por cero',()=>{
    const s=obtener([]);assert.deepEqual(s,{totalReservasUnicas:0,duplicadosOmitidos:0,porServicio:[],porProfesional:[],serviciosMasReservados:[],profesionalesMasReservados:[]});
});
test('Una reserva produce 100 por ciento y ganadores por ID',()=>{
    const s=obtener([reserva(1)]);assert.equal(s.totalReservasUnicas,1);
    assert.equal(s.porServicio[0].porcentaje,100);assert.equal(s.porProfesional[0].porcentaje,100);
    assert.deepEqual(s.serviciosMasReservados,[1]);assert.deepEqual(s.profesionalesMasReservados,[1]);
});
test('Servicios con nombres iguales y distinto ID permanecen separados',()=>{
    const s=obtener([reserva(1),reserva(2,{id_servicio:2})]);
    assert.deepEqual(s.porServicio.map(g=>g.id_servicio),[1,2]);assert.equal(s.porServicio[0].reservas,1);
});
test('Profesionales con nombres iguales y distinto ID permanecen separadas',()=>{
    const s=obtener([reserva(1),reserva(2,{id_trabajadora:2})]);
    assert.deepEqual(s.porProfesional.map(g=>g.id_trabajadora),[1,2]);
});
test('Varias reservas: máximos y porcentajes correctos por ambos tipos de entidad',()=>{
    const s=obtener([reserva(1),reserva(2),reserva(3,{id_servicio:2,id_trabajadora:3})]);
    assert.equal(s.totalReservasUnicas,3);assert.equal(s.porServicio[0].reservas,2);
    assert.equal(s.porServicio[0].porcentaje,66.67);assert.equal(s.porProfesional[1].porcentaje,33.33);
    assert.deepEqual(s.serviciosMasReservados,[1]);assert.deepEqual(s.profesionalesMasReservados,[1]);
});
test('Distintas reservas con igual horario cuentan por separado',()=>{
    assert.equal(obtener([reserva(1),reserva(2)]).totalReservasUnicas,2);
});
test('Duplicados idénticos con distinto orden de propiedades solo cuentan una vez',()=>{
    const a=reserva(1),b=Object.fromEntries(Object.entries(a).reverse());
    const s=obtener([a,b,reserva(2)]);assert.equal(s.totalReservasUnicas,2);assert.equal(s.duplicadosOmitidos,1);
    assert.equal(s.porServicio[0].reservas,2);
});
for(const [campo,valor] of [['id_servicio',2],['id_trabajadora',2],['estado','cancelada'],['servicio','Otro nombre'],
    ['trabajadora','Otro nombre'],['fecha_hora_inicio','2026-11-18T14:00:00'],['fecha_hora_fin','2026-11-18T17:00:00']]){
    test('Mismo ID de reserva con contradicción impide estadísticas parciales: '+campo,()=>{
        const filas=[reserva(1),reserva(1,{[campo]:valor}),reserva(2)];const r=calcular(filas);
        assert.equal(r.estado,'inconsistente');assert.equal(r.estadisticas,null);
        assert.deepEqual(r.incidencias,[{codigo:'reserva_contradictoria',idReserva:1}]);
        assert.deepEqual(calcular([...filas].reverse()),r);
    });
}
test('Empates incluyen a todos, ordenados por ID y sin elegir el primero recibido',()=>{
    const s=obtener([reserva(2,{id_servicio:20,id_trabajadora:30}),reserva(1,{id_servicio:10,id_trabajadora:3})]);
    assert.deepEqual(s.serviciosMasReservados,[10,20]);assert.deepEqual(s.profesionalesMasReservados,[3,30]);
});
test('Incluye cada estado sin excluir canceladas ni pendientes de abono',()=>{
    const estados=['confirmada','cancelada','pendiente_abono','atendida','no_atendida'];
    const s=obtener(estados.map((estado,i)=>reserva(i+1,{estado})));
    assert.equal(s.totalReservasUnicas,5);
    for(const g of [s.porServicio[0],s.porProfesional[0]]){
        assert.equal(g.reservas,5);for(const e of estados)assert.equal(g.porEstado[e],1);
    }
});
test('Redondeo a dos decimales independiente: suma puede ser 99.99',()=>{
    const s=obtener([1,2,3].map(id=>reserva(id,{id_servicio:id,id_trabajadora:id})));
    assert.deepEqual(s.porServicio.map(g=>g.porcentaje),[33.33,33.33,33.33]);
    assert(s.porServicio.every(g=>Number.isFinite(g.porcentaje)));
});
for(const campo of ['id_reserva','id_servicio','id_trabajadora','servicio','trabajadora','estado','fecha_hora_inicio','fecha_hora_fin']){
    test('Campo obligatorio ausente no se reemplaza por un nombre o un cero: '+campo,()=>{
        const fila=reserva(1);delete fila[campo];const r=calcular([fila,reserva(2)]);
        assert.equal(r.estado,'no_disponible');assert.equal(r.estadisticas,null);assert(r.incidencias.length);
    });
}
for(const id of [null,undefined,0,-1,1.5,NaN,Infinity,'1',true,Number.MAX_SAFE_INTEGER+1]){
    test('Identificador inválido se rechaza sin conversión implícita: '+String(id),()=>{
        for(const campo of ['id_reserva','id_servicio','id_trabajadora']){
            const r=calcular([reserva(1,{[campo]:id})]);assert.equal(r.estado,'no_disponible');assert.equal(r.estadisticas,null);
        }
    });
}
for(const valor of [null,undefined,{},'error'])test('Respuesta ausente o inválida no es una lista vacía: '+String(valor),()=>{
    assert.equal(calcular(valor).estado,'no_disponible');assert.equal(calcular(valor).estadisticas,null);
});
test('Registro nulo, array o nombre vacío no producen estadísticas parciales',()=>{
    for(const fila of [null,[],reserva(1,{servicio:' '}),reserva(1,{trabajadora:null}),reserva(1,{estado:'desconocido'})]){
        assert.equal(calcular([fila]).estado,'no_disponible');
    }
});
test('Fechas históricas cuentan sin consultar reloj ni inferir atenciones futuras',()=>{
    const s=obtener([reserva(1,{fecha_hora_inicio:'1900-01-01T15:00:00',fecha_hora_fin:'1900-01-01T16:00:00'}),reserva(2)]);
    assert.equal(s.totalReservasUnicas,2);assert.equal(s.porServicio[0].porEstado.confirmada,2);
});
test('Calendario inválido, Z y fin anterior o igual no se aceptan',()=>{
    for(const cambio of [{fecha_hora_inicio:'2026-02-30T15:00:00'}, {fecha_hora_inicio:'2026-11-18T24:00:00'},
        {fecha_hora_inicio:'2026-11-18T15:00:00Z'},{fecha_hora_fin:'2026-11-18T14:00:00'},{fecha_hora_fin:'2026-11-18T15:00:00'}]){
        assert.equal(calcular([reserva(1,cambio)]).estado,'no_disponible');
    }
});
test('Horas civiles repetidas o inexistentes se cuentan sin convertirlas a instantes',()=>{
    const s=obtener([reserva(1,{fecha_hora_inicio:'2026-04-04T23:15:00',fecha_hora_fin:'2026-04-04T23:45:00'}),
        reserva(2,{fecha_hora_inicio:'2026-09-06T00:15:00',fecha_hora_fin:'2026-09-06T00:45:00'})]);
    assert.equal(s.totalReservasUnicas,2);
});
test('Cambios de nombre en reservas distintas preservan el ID y muestran todas las etiquetas',()=>{
    const r=calcular([reserva(1),reserva(2,{servicio:'Nombre anterior',trabajadora:'Nombre anterior'})]);
    assert.equal(r.estado,'disponible');assert.equal(r.estadisticas.porServicio[0].servicio,null);
    assert.deepEqual(r.estadisticas.porServicio[0].nombres,['Nombre anterior','Servicio ficticio']);
    assert.equal(r.advertencias.length,2);assert.equal(r.estadisticas.porServicio[0].reservas,2);
});
test('Resultado determinista e independiente del orden con etiquetas, duplicados y empates',()=>{
    const a=reserva(1),filas=[a,reserva(5,{id_servicio:3,id_trabajadora:2}),reserva(3,{servicio:'Otro nombre'}),{...a}];
    const referencia=calcular(filas);
    for(const orden of [[...filas].reverse(),[filas[2],filas[0],filas[3],filas[1]]])assert.deepEqual(calcular(orden),referencia);
});
test('Entradas congeladas no cambian; resultado no comparte referencias mutables',()=>{
    const fila=Object.freeze(reserva(1)),filas=Object.freeze([fila]);const antes=JSON.stringify(filas);
    const r=calcular(filas);r.estadisticas.porServicio[0].nombres.push('Cambio de salida');
    r.estadisticas.porServicio[0].porEstado.confirmada=99;assert.equal(JSON.stringify(filas),antes);
    assert.equal(calcular(filas).estadisticas.porServicio[0].porEstado.confirmada,1);
});
test('No admite datos de clientas ni información financiera, ni los filtra a diagnósticos',()=>{
    for(const campo of ['clienta','correo','telefono','precio_servicio','monto_abono','token_consulta']){
        const r=calcular([reserva(1,{[campo]:'VALOR-PRIVADO'})]);
        assert.equal(r.estado,'no_disponible');assert(!JSON.stringify(r).includes('VALOR-PRIVADO'));
    }
    const salida=JSON.stringify(calcular([reserva(1)]));
    for(const campo of ['clienta','correo','telefono','precio_servicio','monto_abono','token_consulta','fecha_hora'])assert(!salida.includes(campo));
});
test('Script clásico y Node funcionan sin DOM, HTTP, almacenamiento, reloj ni PostgreSQL',()=>{
    let llamadas=0;const prohibido=()=>{llamadas++;throw Error('Efecto externo prohibido');};
    const entorno={fetch:prohibido,XMLHttpRequest:prohibido,WebSocket:prohibido,setTimeout:prohibido,console:{log:prohibido,error:prohibido},
        Date:class{constructor(){prohibido();}static now(){prohibido();}}};
    for(const k of ['document','localStorage','sessionStorage','Intl'])Object.defineProperty(entorno,k,{get:prohibido});
    const c=vm.createContext(entorno);vm.runInContext(fs.readFileSync(path.join(__dirname,'estadisticas.js'),'utf8'),c);
    assert.equal(c.MerakiEstadisticasReservas.calcularEstadisticasReservas([reserva(1)]).estadisticas.totalReservasUnicas,1);
    assert.equal(llamadas,0);
});
