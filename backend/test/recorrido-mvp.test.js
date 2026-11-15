const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {randomUUID}=require('node:crypto'),{createRequire}=require('node:module');
const {Pool}=require('pg'),request=require('supertest'),bcrypt=require('bcrypt');
test('Recorrido MVP: invitada, Webpay simulado, correo, asistencia y solicitudes',{
 skip:process.env.MERAKI_DB_TEST!=='1',timeout:120000
},async t=>{
 assert.match(process.env.DB_NAME||'',/^meraki_mvp_ejecucion_\d+_[a-f0-9]{8}$/,'Usar scripts/probar-mvp-aislado.cjs');
 const config={host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME};
 const admin=new Pool(config),schema='meraki_recorrido_'+Date.now();let pool;
 try{
  await admin.query('CREATE SCHEMA '+schema);pool=new Pool({...config,options:'-c search_path='+schema+',public -c timezone=America/Santiago'});
  const files=['schema.sql','migracion_abonos_reintentos.sql','002_agregar_token_consulta.sql','003_notificaciones_correo.sql','004_fecha_inicio_envio.sql','005_revision_notificaciones.sql','006_correccion_correo_reserva.sql','007_nombre_reserva.sql','008_suscripcion_oneclick.sql','009_intentos_webpay.sql','010_procesamiento_webpay.sql','seed.sql'];
  for(const f of files)await pool.query(fs.readFileSync(path.join(__dirname,'../../database',f),'utf8'));
  const antes=(await pool.query('SELECT to_jsonb(r) fila FROM reserva r ORDER BY id_reserva')).rows;
  for(const f of ['011_reserva_invitada.sql','012_gestiones_reserva.sql'])await pool.query(fs.readFileSync(path.join(__dirname,'../../database',f),'utf8'));
  await t.test('Migraciones incrementales conservan las reservas previas',async()=>{
   const despues=(await pool.query("SELECT to_jsonb(r)-'asistencia_confirmada_en' fila FROM reserva r ORDER BY id_reserva")).rows;assert.deepEqual(despues,antes);
  });
  await pool.end();pool=new Pool({...config,options:'-c search_path='+schema+' -c timezone=America/Santiago'});
  await pool.query('UPDATE emprendedora SET password_hash=$1',[await bcrypt.hash('clave-fixture',4)]);
  await pool.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,monto_mensual,estado,acceso_hasta) VALUES(1,CURRENT_DATE,9990,'prueba','2099-01-01')");
  await pool.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash) VALUES('Otra','Fixture','OTRA','otra@example.test',$1)",[await bcrypt.hash('clave-fixture',4)]);
  const req=createRequire(path.join(__dirname,'../index.js'));let enviados=0,creates=0,commits=0,consultas=0,remoto;
  const notificaciones=req('./notificaciones');
  const mod={exports:{}};
  const wrapped=n=>{
   if(n==='./db')return pool;
   if(n==='connect-pg-simple')return ()=>req('express-session').MemoryStore;
   if(n==='./notificaciones')return {...notificaciones,crearNotificaciones:p=>notificaciones.crearNotificaciones(p,async d=>{assert.ok(d.enlaceConsulta.endsWith(d.enlaceConsulta.split('#')[1]));assert.match(d.enlaceConsulta,/\/consulta\/#/);enviados++;return {idMensaje:'simulado-'+enviados};})};
   if(n==='./suscripciones')return {crearSuscripciones:()=>({}),montarRutasSuscripcion(){},iniciarPlanificador(){throw Error('Planificador prohibido');}};
   if(n==='transbank-sdk')return {Options:class{},IntegrationCommerceCodes:{},IntegrationApiKeys:{},Environment:{},WebpayPlus:{Transaction:class{
    async create(order,session,amount){creates++;remoto={status:'AUTHORIZED',response_code:0,amount,buy_order:order,authorization_code:'SIMULADO'};return {token:('p'+creates).padEnd(64,'a'),url:'https://webpay3gint.transbank.cl/webpayserver/initTransaction'};}
    async commit(){commits++;return remoto;}async status(){consultas++;return remoto;}
   }}};
   return req(n);
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../index.js'),'utf8'),{module:mod,require:wrapped,__dirname:path.join(__dirname,'..'),process:{env:{SESSION_SECRET:'fixture-aislado-no-produccion',MERAKI_DB_TEST:'1',MERAKI_SUSCRIPCIONES_AUTOMATICAS:'0',PUBLIC_BASE_URL:'http://localhost:3000',WEBPAY_RETURN_URL:'http://localhost:3000/api/abonos/retorno'}},console:{log(){},error(){}},URL,Buffer,setTimeout,clearTimeout});
  const app=mod.exports,web=request(app),guest=request.agent(app),otro=request.agent(app),owner=request.agent(app),foreign=request.agent(app);
  await owner.post('/api/auth/login').send({correo:'camila@meraki.test',password:'clave-fixture'}).expect(200);
  await foreign.post('/api/auth/login').send({correo:'otra@example.test',password:'clave-fixture'}).expect(200);
  const fecha='2035-01-01';assert.equal(new Date(fecha+'T00:00Z').getUTCDay(),1);
  const body=hora=>({id_servicio:1,id_trabajadora:1,fecha,hora,contacto:{nombre:'Invitada MVP',correo:'valentina@meraki.test',telefono:''}});
  const enviar=(agent,clave,datos)=>agent.post('/api/reservas/invitada').set('X-Meraki-Action','1').set('Idempotency-Key',clave).send(datos);
  await guest.get('/api/reservas/invitada/contexto').expect(200);await otro.get('/api/reservas/invitada/contexto').expect(200);
  const clave=randomUUID();let reserva;
  await t.test('Rutas antiguas ya no permiten enumerar contacto ni reservar con ID ajeno públicamente',async()=>{
   await web.post('/api/clientas').send({nombre:'X',correo:'valentina@meraki.test'}).expect(401);
   await web.post('/api/reservas').send({id_clienta:1,id_servicio:1,id_trabajadora:1,fecha,hora:'10:00'}).expect(401);
  });
  await t.test('Contexto, cabecera y campos autorizados son obligatorios',async()=>{
   await enviar(web,randomUUID(),body('10:00')).expect(401);
   await guest.post('/api/reservas/invitada').send(body('10:00')).expect(403);
   await enviar(guest,randomUUID(),{...body('10:00'),id_clienta:1}).expect(400);
   await enviar(guest,randomUUID(),{...body('10:00'),fecha:'2035-02-30'}).expect(400);
  });
  await t.test('Reintentos concurrentes crean una sola reserva y devuelven el mismo enlace',async()=>{
   const r=await Promise.all([enviar(guest,clave,body('10:00')),enviar(guest,clave,body('10:00'))]);assert.deepEqual(r.map(x=>x.status).sort(),[200,201]);
   assert.equal(r[0].body.reserva.token_consulta,r[1].body.reserva.token_consulta);reserva=r[0].body.reserva;
   const snapshot=(await pool.query('SELECT id_clienta,nombre_clienta,correo_confirmacion FROM reserva WHERE id_reserva=$1',[reserva.id_reserva])).rows[0];
   assert.equal(snapshot.id_clienta,null);assert.equal(snapshot.nombre_clienta,'Invitada MVP');
   assert.equal((await pool.query('SELECT count(*)::int n FROM clienta')).rows[0].n,1,'No vincular ni duplicar perfiles globales por correo');
   assert.equal((await pool.query('SELECT count(*)::int n FROM contacto_reserva_invitada')).rows[0].n,1);
  });
  await t.test('Clave ligada a navegador y contenido, sin doble reserva',async()=>{
   await enviar(guest,clave,body('11:00')).expect(409);
   const r=await enviar(otro,clave,body('10:00')).expect(409);assert.ok(!JSON.stringify(r.body).includes(reserva.token_consulta));
   const rs=await Promise.all([enviar(guest,randomUUID(),body('11:00')),enviar(otro,randomUUID(),body('11:00'))]);assert.deepEqual(rs.map(x=>x.status).sort(),[201,409]);
  });
  await t.test('Fallo tras contacto revierte contacto, reserva e intento',async()=>{
   const {crearServicioInvitada}=req('./reserva-invitada-servicio'),{TURNO}=req('./reservas-invitadas');
   const servicio=crearServicioInvitada({pool,secreto:'s'.repeat(32),consultarTurno:async(db,d)=>(await db.query(TURNO,[d.fecha,'lunes',d.id_trabajadora,d.id_servicio,d.hora])).rows[0],trasContacto:async()=>{throw Error('fallo inyectado');}});
   const conteo=async()=> (await pool.query('SELECT (SELECT count(*) FROM reserva) r,(SELECT count(*) FROM contacto_reserva_invitada) c,(SELECT count(*) FROM intento_reserva_invitada) i')).rows[0];const antes=await conteo();
   await assert.rejects(servicio.crear({contexto:servicio.emitirContexto(),clave:randomUUID(),body:body('16:00')}));assert.deepEqual(await conteo(),antes);
  });
  const ruta=()=>'/api/reservas/consulta/'+reserva.token_consulta;
  let iniciado,financiero;
  await t.test('Inicio y retorno simulados aprueban abono y generan una notificación auténtica de consulta',async()=>{
   iniciado=(await web.post('/api/abonos/cliente/iniciar').send({token_consulta:reserva.token_consulta}).expect(201)).body;
   await web.get('/api/abonos/retorno').query({token_ws:iniciado.token}).expect(200);
   const r=(await web.get(ruta()).expect(200)).body;assert.equal(r.reserva.estado,'confirmada');assert.equal(r.pago.estado,'confirmado');assert.equal(r.capacidades.confirmar_asistencia,true);
   assert.equal(enviados,1);assert.equal(creates,1);assert.equal(commits,1);
   financiero=(await pool.query('SELECT to_jsonb(a) fila FROM abono a WHERE id_reserva=$1',[reserva.id_reserva])).rows;
  });
  await t.test('Retorno repetido no duplica pago ni correo',async()=>{
   await web.get('/api/abonos/retorno').query({token_ws:iniciado.token}).expect(409);assert.equal(enviados,1);assert.equal(commits,1);
  });
  await t.test('Asistencia independiente e idempotente; no modifica reserva.estado ni abono',async()=>{
   await web.post(ruta()+'/confirmar-asistencia').set('X-Meraki-Action','1').send({}).expect(200);
   const a=(await web.get(ruta())).body;assert.ok(a.reserva.asistencia_confirmada_en);assert.equal(a.reserva.estado,'confirmada');
   await web.post(ruta()+'/confirmar-asistencia').set('X-Meraki-Action','1').send({}).expect(200);
   assert.equal((await web.get(ruta())).body.reserva.asistencia_confirmada_en,a.reserva.asistencia_confirmada_en);
  });
  let solicitud;
  await t.test('Cancelación con pago queda solicitada una vez y mantiene ocupado el horario',async()=>{
   await web.patch(ruta()+'/cancelar').expect(409);
   const rs=await Promise.all([web.post(ruta()+'/solicitud-cancelacion').set('X-Meraki-Action','1').send({motivo:'No podré asistir'}),web.post(ruta()+'/solicitud-cancelacion').set('X-Meraki-Action','1').send({motivo:'No podré asistir'})]);assert.ok(rs.every(r=>r.status===200));
   const r=(await web.get(ruta())).body;solicitud=r.solicitud_cancelacion;assert.equal(solicitud.estado,'pendiente');assert.equal(r.reserva.estado,'confirmada');
   await enviar(otro,randomUUID(),body('10:00')).expect(409);
   await web.post(ruta()+'/confirmar-asistencia').set('X-Meraki-Action','1').send({}).expect(409);
  });
  await t.test('Back Office propietario revisa y cierra, sin cancelar ni devolver',async()=>{
   await web.get('/api/solicitudes-cancelacion').expect(401);
   assert.deepEqual((await foreign.get('/api/solicitudes-cancelacion')).body,[]);
   const cerrar='/api/solicitudes-cancelacion/'+solicitud.id_solicitud+'/cerrar';
   await foreign.patch(cerrar).set('X-Meraki-Action','1').send({respuesta:'No autorizada'}).expect(404);
   await owner.patch(cerrar).set('X-Meraki-Action','1').send({respuesta:'Contactamos a la clienta para gestionar el caso.'}).expect(200);
   await owner.patch(cerrar).set('X-Meraki-Action','1').send({respuesta:'Reintento no reemplaza respuesta'}).expect(200);
   const r=(await web.get(ruta())).body;assert.equal(r.solicitud_cancelacion.estado,'cerrada');assert.match(r.solicitud_cancelacion.respuesta,/Contactamos/);
   const agenda=(await owner.get('/api/reservas?id_emprendimiento=1')).body,rr=agenda.find(x=>x.id_reserva===reserva.id_reserva);assert.ok(rr.asistencia_confirmada_en);assert.equal(rr.estado_solicitud_cancelacion,'cerrada');
   assert.equal(rr.estado,'confirmada');assert.deepEqual((await pool.query('SELECT to_jsonb(a) fila FROM abono a WHERE id_reserva=$1',[reserva.id_reserva])).rows,financiero);
   const estadistica=req('../frontend/back-office/estadisticas-reservas').calcularEstadisticasReservas(agenda.map(r=>Object.fromEntries(['id_reserva','id_servicio','servicio','id_trabajadora','trabajadora','estado','fecha_hora_inicio','fecha_hora_fin'].map(k=>[k,r[k]]))));assert.equal(estadistica.estado,'disponible');
   assert.equal(enviados,1);assert.equal(creates,1);assert.equal(commits,1);assert.equal(consultas,0);
  });
  await t.test('Futuros sin pago y citas pasadas no confirman asistencia; GET no ejecuta acciones',async()=>{
   const sinpago=(await enviar(guest,randomUUID(),body('14:00')).expect(201)).body.reserva;
   await web.post('/api/reservas/consulta/'+sinpago.token_consulta+'/confirmar-asistencia').set('X-Meraki-Action','1').send({}).expect(409);
   await web.get(ruta()+'/confirmar-asistencia').expect(404);
   await pool.query("UPDATE reserva SET fecha_hora_inicio='2020-01-01 10:00',fecha_hora_fin='2020-01-01 11:00' WHERE id_reserva=$1",[reserva.id_reserva]);
   await web.post(ruta()+'/confirmar-asistencia').set('X-Meraki-Action','1').send({}).expect(409);
  });
 }finally{if(pool)await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();}
});
