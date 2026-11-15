const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalizar,crearServicioInvitada}=require('../reserva-invitada-servicio');
const datos=()=>({id_servicio:1,id_trabajadora:1,fecha:'2035-01-01',hora:'10:00',contacto:{nombre:'Clienta',correo:'clienta@example.test',telefono:''}});
test('Invitada: contexto firmado rechaza alteración y vence sin tocar PostgreSQL',()=>{
 let now=Date.now();const s=crearServicioInvitada({pool:{},secreto:'s'.repeat(32),ahora:()=>now,consultarTurno(){}});
 const c=s.emitirContexto();assert.equal(s.contextoValido(c),true);assert.equal(s.contextoValido(c.slice(0,-1)+(c.endsWith('a')?'b':'a')),false);
 const otro=crearServicioInvitada({pool:{},secreto:'t'.repeat(32),consultarTurno(){}});assert.equal(otro.contextoValido(c),false);
 now+=7*86400000;assert.equal(s.contextoValido(c),false);
});
for(const [nombre,transformar]of [
 ['id_clienta externo',d=>({...d,id_clienta:42})],
 ['contacto con ID',d=>({...d,contacto:{...d.contacto,id_clienta:1}})],
 ['correo inválido',d=>({...d,contacto:{...d.contacto,correo:'invalido'}})],
 ['nombre con control',d=>({...d,contacto:{...d.contacto,nombre:'Nombre\nOtro'}})],
 ['teléfono con control',d=>({...d,contacto:{...d.contacto,telefono:'123\n456'}})],
 ['fecha inexistente',d=>({...d,fecha:'2035-02-30'})],
 ['hora fuera de rango',d=>({...d,hora:'24:00'})],
 ['ID desbordado',d=>({...d,id_servicio:2147483648})]
])test('Invitada rechaza '+nombre,()=>assert.throws(()=>normalizar(transformar(datos())),e=>e.http===400));
