const {test}=require('node:test');const assert=require('node:assert/strict');
const {filtrar,acciones,estado}=require('../../frontend/back-office/agenda');
const reservas=[{id_reserva:1,fecha_hora_inicio:'2030-11-04T10:00:00',estado:'confirmada',puede_cancelar:false,puede_cerrar:false},
{id_reserva:2,fecha_hora_inicio:'2030-11-04T12:00:00',estado:'pendiente_abono',puede_cancelar:true,puede_cerrar:false},
{id_reserva:3,fecha_hora_inicio:'2030-11-05T10:00:00',estado:'confirmada',puede_cancelar:false,puede_cerrar:true}];
test('Agenda combina fecha y estado sin desplazar el día de Chile',()=>{assert.deepEqual(filtrar(reservas,'2030-11-04','confirmada').map(r=>r.id_reserva),[1]);assert.equal(filtrar(reservas,'','confirmada').length,2);assert.equal(filtrar(reservas,'2030-11-06','').length,0);assert.equal(filtrar(reservas,'','').length,3);});
test('Agenda usa permisos del servidor para pagos y cierre de atención',()=>{assert.equal(acciones(reservas[0]).length,0);assert.deepEqual(acciones(reservas[1]).map(x=>x.accion),['cancelar']);assert.deepEqual(acciones(reservas[2]).map(x=>x.accion),['atender','no-atendida']);});
test('Agenda muestra estados comprensibles y ausencia de abono',()=>{assert.equal(estado('pendiente_abono'),'Pendiente de abono');assert.equal(estado('no_atendida'),'No atendida');assert.equal(estado(null),'Sin abono');});
