const {test}=require('node:test');const assert=require('node:assert/strict');
const {abonoCLPValido}=require('../montos-abono');
test('Abono CLP exige entero positivo, límite de almacenamiento y precio suficiente',()=>{
 for(const n of [1,5000,20000])assert.equal(abonoCLPValido(n,20000),true);
 for(const n of [0,-1,0.5,5000.25,20001,NaN,Infinity,null,undefined,true,'5000',{},[],100000000])assert.equal(abonoCLPValido(n,20000),false);
 for(const precio of [0,-1,NaN,Infinity,null,'20000'])assert.equal(abonoCLPValido(1,precio),false);
 assert.equal(abonoCLPValido(10,10.5),true); // No cambia la política del precio.
});
test('Reserva invitada rechaza tarifa histórica inválida antes de insertar reserva o contacto',async()=>{
 const {crearServicioInvitada}=require('../reserva-invitada-servicio');
 for(const monto of ['0','-1','0.50','5000.25','20001','NaN']){
  const consultas=[];const db={query:async(sql)=>{consultas.push(sql);return {rows:/count\(\*\)/.test(sql)?[{n:0}]:[]};},release(){}};
  const servicio=crearServicioInvitada({pool:{connect:async()=>db},secreto:'a'.repeat(32),consultarTurno:async()=>({precio:'20000',monto_abono:monto})});
  await assert.rejects(servicio.crear({contexto:servicio.emitirContexto(),clave:require('crypto').randomUUID(),body:{contacto:{nombre:'Cliente',correo:'cliente@example.test'},id_servicio:1,id_trabajadora:1,fecha:'2030-11-18',hora:'10:00'}}),e=>e.codigo==='ABONO_NO_DISPONIBLE');
  assert(!consultas.some(s=>/INSERT INTO (reserva|contacto_reserva_invitada)\b/.test(s)));assert(consultas.includes('ROLLBACK'));
 }
});
