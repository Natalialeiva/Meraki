const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const vm=require('vm');const {createRequire}=require('module');
const request=require('supertest');const {Pool}=require('pg');const bcrypt=require('bcrypt');
const {crearNotificaciones}=require('../notificaciones');
require('dotenv').config({path:path.join(__dirname,'../.env')});
test('Integración PostgreSQL, sesión, recuperación y notificaciones',{skip:process.env.MERAKI_DB_TEST!=='1'},async t=>{
 const schema='meraki_test_'+Date.now();assert.match(schema,/^meraki_test_\d+$/);
 const config={host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD};
 const admin=new Pool(config);let pool;let app;let enviados=0;let modo='ok';let notificacionId=1;let transaccionesCreadas=0;let status={status:'AUTHORIZED',response_code:0,amount:5000,buy_order:'orden-test',authorization_code:'TEST'};
 try{
  // La extensión debe estar instalada previamente: las pruebas no la instalan en la base principal.
  assert.equal((await admin.query("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='btree_gist') AS instalada")).rows[0].instalada,true);
  await admin.query('CREATE SCHEMA '+schema);pool=new Pool({...config,options:'-c search_path='+schema+',public'});
  for(const file of ['schema.sql','002_agregar_token_consulta.sql','003_notificaciones_correo.sql','004_fecha_inicio_envio.sql','005_revision_notificaciones.sql','006_correccion_correo_reserva.sql','007_nombre_reserva.sql','seed.sql'])await pool.query(fs.readFileSync(path.join(__dirname,'../../database',file),'utf8'));
  // public se usa solo al construir las tablas para resolver la extensión btree_gist.
  // Las consultas del servidor y sus sesiones nunca pueden recurrir a tablas de public.
  await pool.end();pool=new Pool({...config,options:'-c search_path='+schema});
  await t.test('Aislamiento: las consultas y sesiones solo resuelven el esquema temporal',async()=>{
   const contexto=(await pool.query('SELECT current_schema() AS esquema,current_schemas(false)::text[] AS rutas')).rows[0];
   assert.equal(contexto.esquema,schema);assert.deepEqual(contexto.rutas,[schema]);
  });
  await pool.query('UPDATE emprendedora SET password_hash=$1',[await bcrypt.hash('clave-prueba',4)]);
  await pool.query("UPDATE reserva SET token_consulta='11111111-1111-4111-8111-111111111111',estado='pendiente_abono'");
  await pool.query("INSERT INTO abono(id_reserva,monto,token_transaccion,buy_order) VALUES(1,5000,'token-prueba','orden-test')");
  const enviar=async()=>{enviados++;if(modo!=='ok'){const e=new Error('fallo simulado');e.code=modo;throw e;}return{idMensaje:'mensaje-test'};};
  const req=createRequire(path.join(__dirname,'../index.js'));const module={exports:{}};
  const wrapped=n=>n==='./db'?pool:n==='./notificaciones'?{...req(n),crearNotificaciones:p=>crearNotificaciones(p,enviar)}:n==='transbank-sdk'?{WebpayPlus:{Transaction:class{async status(){return status;} async create(order,session,amount){status={status:"AUTHORIZED",response_code:0,amount,buy_order:order,authorization_code:"TEST"};return {token:String(++transaccionesCreadas).padStart(64,"a"),url:"https://webpay3gint.transbank.cl/webpayserver/initTransaction"};} async commit(){return status;}}},Options:class{},IntegrationCommerceCodes:{},IntegrationApiKeys:{},Environment:{}}:req(n);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../index.js'),'utf8'),{require:wrapped,module,__dirname:path.join(__dirname,'..'),process,console,URL,Buffer,setTimeout,clearTimeout});app=module.exports;
  const agent=request.agent(app);
  await t.test('Anónimo no lista ni reintenta',async()=>{await request(app).get('/api/notificaciones').expect(401);await request(app).post('/api/notificaciones/'+notificacionId+'/reintentar').expect(401);});
  await t.test('Login real crea sesión PostgreSQL',async()=>{await agent.post('/api/auth/login').send({correo:'camila@meraki.test',password:'clave-prueba'}).expect(200);});
  await t.test('Perfil: autenticación, campos protegidos y validaciones',async()=>{
   await request(app).patch('/api/emprendimientos/1').send({nombre:'Sin permiso'}).expect(401);
   for(const datos of [{},{nombre:'   '},{nombre:null},{nombre:'x'.repeat(151)},{telefono:123},{id_emprendedora:2},{estado:false},{latitud:1}]){
    await agent.patch('/api/emprendimientos/1').send(datos).expect(400);
   }
   await agent.patch('/api/emprendimientos/incorrecto').send({nombre:'Prueba'}).expect(400);
  });
  await t.test('Perfil: guarda datos públicos, limpia opcionales y mantiene reservas y coordenadas',async()=>{
   const original=(await pool.query('SELECT * FROM emprendimiento WHERE id_emprendimiento=1')).rows[0];
   const reservas=(await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows;
   const datos={nombre:' Belleza de prueba ',descripcion:' Descripción de prueba ',direccion:' Dirección de prueba ',comuna:' Santiago ',telefono:null};
   const respuesta=(await agent.patch('/api/emprendimientos/1').send(datos).expect(200)).body.emprendimiento;
   assert.equal(respuesta.nombre,'Belleza de prueba');assert.equal(respuesta.telefono,null);
   const guardado=(await agent.get('/api/mis-emprendimientos').expect(200)).body.find(n=>n.id_emprendimiento===1);
   assert.equal(guardado.descripcion,'Descripción de prueba');assert.equal(guardado.direccion,'Dirección de prueba');assert.equal(guardado.comuna,'Santiago');
   const publico=(await request(app).get('/api/emprendimientos').expect(200)).body.find(n=>n.id_emprendimiento===1);
   assert.equal(publico.nombre,'Belleza de prueba');
   assert.equal(guardado.latitud,original.latitud);assert.equal(guardado.longitud,original.longitud);
   assert.equal(guardado.estado,original.estado);assert.deepEqual((await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows,reservas);
   await agent.patch('/api/emprendimientos/1').send(Object.fromEntries(['nombre','descripcion','direccion','comuna','telefono'].map(k=>[k,original[k]]))).expect(200);
  });
  await t.test('Perfil: no permite editar el emprendimiento de otra propietaria',async()=>{
   const otra=request.agent(app);
   const cuenta=(await pool.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash) VALUES('Perfil','Ajeno','perfil-ajeno','perfil@meraki.test',$1) RETURNING id_emprendedora",[await bcrypt.hash('clave-prueba',4)])).rows[0];
   await otra.post('/api/auth/login').send({correo:'perfil@meraki.test',password:'clave-prueba'}).expect(200);
   const antes=(await pool.query('SELECT * FROM emprendimiento WHERE id_emprendimiento=1')).rows[0];
   await otra.patch('/api/emprendimientos/1').send({nombre:'Cambio ajeno'}).expect(404);
   assert.deepEqual((await pool.query('SELECT * FROM emprendimiento WHERE id_emprendimiento=1')).rows[0],antes);
   await otra.post('/api/auth/logout').expect(200);
  });
  let servicioGestion;
  const datosServicio={id_emprendimiento:1,id_categoria:1,nombre:'Z servicio gestionado',descripcion:' Prueba aislada ',precio:20000,duracion_min:60,monto_abono:5000};
  await t.test('Servicios: autenticación, campos protegidos y valores inválidos',async()=>{
   await request(app).get('/api/mis-servicios').expect(401);
   await request(app).post('/api/servicios').send(datosServicio).expect(401);
   await request(app).patch('/api/servicios/1').send({precio:10000}).expect(401);
   for(const cambio of [{nombre:' '},{nombre:'x'.repeat(151)},{descripcion:3},{precio:0},{precio:1e10},{precio:20.001},{precio:0.00000001},{duracion_min:1.5},{duracion_min:2147483648},{monto_abono:-1},{monto_abono:25000},{monto_abono:1.001},{id_categoria:999999},{activo:false}]){
    await agent.post('/api/servicios').send({...datosServicio,...cambio}).expect(400);
   }
   for(const cambio of [{},{precio:null},{precio:1e10},{precio:20.001},{precio:0.00000001},{duracion_min:0},{duracion_min:2147483648},{monto_abono:1.001},{id_categoria:999999},{id_categoria:'1'},{activo:false},{nombre:' '},{nombre:'Válido',id_emprendimiento:2}]){
    await agent.patch('/api/servicios/1').send(cambio).expect(400);
   }
  });
  await t.test('Servicios: crear, editar categoría y precio conserva reservas existentes',async()=>{
   const antes=(await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows;
   servicioGestion=(await agent.post('/api/servicios').send(datosServicio).expect(201)).body.servicio;
   assert.equal(servicioGestion.descripcion,'Prueba aislada');assert.equal(servicioGestion.activo,true);
   const categoria=(await pool.query("INSERT INTO categoria(nombre) VALUES('Categoría de prueba de gestión') RETURNING id_categoria")).rows[0].id_categoria;
   const editado=(await agent.patch('/api/servicios/'+servicioGestion.id_servicio).send({nombre:' Z editado ',descripcion:null,id_categoria:categoria,precio:24000,duracion_min:90,monto_abono:6000}).expect(200)).body.servicio;
   assert.equal(editado.nombre,'Z editado');assert.equal(editado.id_categoria,categoria);assert.equal(editado.descripcion,null);assert.equal(Number(editado.precio),24000);assert.equal(editado.duracion_min,90);
   const listado=(await agent.get('/api/mis-servicios').expect(200)).body.find(s=>s.id_servicio===servicioGestion.id_servicio);
   assert.equal(listado.servicio,'Z editado');assert.equal(listado.categoria,'Categoría de prueba de gestión');
   // Cambiar un servicio con una reserva existente tampoco altera su precio o duración históricos.
   const original=(await pool.query('SELECT * FROM servicio WHERE id_servicio=1')).rows[0];
   await agent.patch('/api/servicios/1').send({precio:25000,duracion_min:90,monto_abono:6000}).expect(200);
   assert.deepEqual((await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows,antes);
   await agent.patch('/api/servicios/1').send({precio:Number(original.precio),duracion_min:original.duracion_min,monto_abono:Number(original.monto_abono)}).expect(200);
  });
  await t.test('Servicios: ediciones simultáneas no dejan abono superior al precio',async()=>{
   const ruta='/api/servicios/'+servicioGestion.id_servicio;
   await agent.patch(ruta).send({precio:20000,monto_abono:5000}).expect(200);
   const respuestas=await Promise.all([agent.patch(ruta).send({precio:10000}),agent.patch(ruta).send({monto_abono:15000})]);
   for(const r of respuestas)assert([200,400,409].includes(r.status));
   assert(respuestas.some(r=>r.status!==200));
   const actual=(await pool.query('SELECT precio,monto_abono FROM servicio WHERE id_servicio=$1',[servicioGestion.id_servicio])).rows[0];
   assert(Number(actual.monto_abono)<=Number(actual.precio));
  });
  await t.test('Servicios: otra propietaria no puede crear, editar ni desactivar',async()=>{
   const otra=request.agent(app);await otra.post('/api/auth/login').send({correo:'perfil@meraki.test',password:'clave-prueba'}).expect(200);
   await otra.get('/api/mis-servicios').expect(200,[]);
   await otra.post('/api/servicios').send(datosServicio).expect(403);
   await otra.patch('/api/servicios/'+servicioGestion.id_servicio).send({precio:100}).expect(404);
   await otra.patch('/api/servicios/'+servicioGestion.id_servicio+'/desactivar').expect(404);
   await otra.post('/api/auth/logout').expect(200);
  });
  await t.test('Servicios: desactivación conserva historial y retira del catálogo público',async()=>{
   const antes=(await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows;
   const ruta='/api/servicios/'+servicioGestion.id_servicio+'/desactivar';
   await request(app).patch(ruta).expect(401);await agent.patch(ruta).expect(200);await agent.patch(ruta).expect(409);
   assert.equal((await agent.get('/api/mis-servicios').expect(200)).body.find(s=>s.id_servicio===servicioGestion.id_servicio).activo,false);
   assert(!(await request(app).get('/api/servicios').expect(200)).body.some(s=>s.id_servicio===servicioGestion.id_servicio));
   assert.deepEqual((await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows,antes);
  });
  await t.test('Webpay inconsistente no confirma ni envía',async()=>{status.amount=99;await agent.post('/api/abonos/1/recuperar').expect(409);assert.equal(enviados,0);status.amount=5000;});
  await t.test('INITIALIZED e incompleto no recuperan pago',async()=>{
   status.status='INITIALIZED';await agent.post('/api/abonos/1/recuperar').expect(200);assert.equal(enviados,0);
   status.status='AUTHORIZED';status.response_code=null;await agent.post('/api/abonos/1/recuperar').expect(409);status.response_code=0;
  });
  await t.test('Fallo al guardar outbox revierte pago y reserva',async()=>{
   await pool.query('ALTER TABLE notificacion_correo ADD CONSTRAINT prueba_bloqueo CHECK(false) NOT VALID');
   await agent.post('/api/abonos/1/recuperar').expect(502);
   assert.equal((await pool.query('SELECT estado FROM abono WHERE id_abono=1')).rows[0].estado,'pendiente');
   assert.equal((await pool.query('SELECT estado FROM reserva WHERE id_reserva=1')).rows[0].estado,'pendiente_abono');assert.equal(enviados,0);
   await pool.query('ALTER TABLE notificacion_correo DROP CONSTRAINT prueba_bloqueo');
  });
  await t.test('Consulta Webpay solo habilita recuperación de una autorización válida y coincidente',async()=>{
   await request(app).get('/api/abonos/1/estado').expect(401);
   const valida=(await agent.get('/api/abonos/1/estado').expect(200)).body;assert.equal(valida.puede_recuperar,true);
   status.response_code=null;assert.equal((await agent.get('/api/abonos/1/estado').expect(200)).body.puede_recuperar,false);
   status.response_code=0;status.amount=99;assert.equal((await agent.get('/api/abonos/1/estado').expect(200)).body.puede_recuperar,false);
   status.amount=5000;status.status='INITIALIZED';assert.equal((await agent.get('/api/abonos/1/estado').expect(200)).body.puede_recuperar,false);status.status='AUTHORIZED';
  });
  await t.test('Pago autorizado recupera, confirma y envía una sola vez',async()=>{await agent.post('/api/abonos/1/recuperar').expect(200);assert.equal(enviados,1);assert.equal((await agent.get('/api/abonos/1/estado').expect(200)).body.puede_recuperar,false);const n=(await pool.query('SELECT * FROM notificacion_correo')).rows[0];notificacionId=n.id_notificacion;assert.equal(n.estado,'enviado');assert.equal(n.intentos,1);await agent.post('/api/abonos/1/recuperar').expect(409);assert.equal(enviados,1);});
  await t.test('Reclamo concurrente solo realiza un envío',async()=>{await pool.query("UPDATE notificacion_correo SET estado='pendiente',intentos=0");const n=crearNotificaciones(pool,enviar);await Promise.all(Array.from({length:8},()=>n.notificar(1)));assert.equal(enviados,2);});
  await t.test('Timeout conserva enviando y bloquea reintento',async()=>{await pool.query("UPDATE notificacion_correo SET estado='pendiente',intentos=0");modo='ETIMEDOUT';await crearNotificaciones(pool,enviar).notificar(1);assert.equal((await pool.query('SELECT estado FROM notificacion_correo')).rows[0].estado,'enviando');await agent.post('/api/notificaciones/'+notificacionId+'/reintentar').set('X-Meraki-Action','1').send({evidencia:'Revisión de proveedor realizada'}).expect(409);});
  await t.test('Revisión exige antigüedad, cabecera y evidencia',async()=>{await agent.post('/api/notificaciones/'+notificacionId+'/revisar').send({decision:'no_entregado',evidencia:'Proveedor confirma que no fue aceptado'}).expect(403);await agent.post('/api/notificaciones/'+notificacionId+'/revisar').set('X-Meraki-Action','1').send({decision:'no_entregado',evidencia:'Proveedor confirma que no fue aceptado'}).expect(409);await pool.query("UPDATE notificacion_correo SET fecha_inicio_envio=CURRENT_TIMESTAMP-INTERVAL '11 minutes'");await agent.post('/api/notificaciones/'+notificacionId+'/revisar').set('X-Meraki-Action','1').send({decision:'no_entregado',evidencia:'Proveedor confirma que no fue aceptado'}).expect(200);});
  await t.test('Reintento auditado respeta máximo tres',async()=>{modo='EAUTH';for(let i=0;i<2;i++)await agent.post('/api/notificaciones/'+notificacionId+'/reintentar').set('X-Meraki-Action','1').send({evidencia:'Configuración revisada por operadora'}).expect(200);await agent.post('/api/notificaciones/'+notificacionId+'/reintentar').set('X-Meraki-Action','1').send({evidencia:'Configuración revisada por operadora'}).expect(409);assert.equal((await pool.query('SELECT intentos FROM notificacion_correo')).rows[0].intentos,3);assert.equal((await pool.query('SELECT * FROM revision_notificacion')).rows.length,3);});
  await t.test('Catálogo distingue servicios sin profesional y permite nueva reserva con correo existente',async()=>{
   const nuevos=(await agent.get('/api/mis-servicios').expect(200)).body;
   assert(Array.isArray(nuevos));
   const servicio=(await pool.query(`INSERT INTO servicio(id_emprendimiento,id_categoria,nombre,precio,duracion_min,monto_abono)
    SELECT id_emprendimiento,id_categoria,'Servicio sin profesional',precio,duracion_min,monto_abono FROM servicio WHERE id_servicio=1 RETURNING id_servicio`)).rows[0].id_servicio;
   let catalogo=(await request(app).get('/api/emprendimientos/1/servicios').expect(200)).body;
   assert.equal(catalogo.find(s=>s.id_servicio===1).reservable,true);assert.equal(catalogo.find(s=>s.id_servicio===servicio).reservable,false);
   await pool.query('UPDATE trabajadora SET activa=false WHERE id_trabajadora=1');
   catalogo=(await request(app).get('/api/emprendimientos/1/servicios').expect(200)).body;assert.equal(catalogo.find(s=>s.id_servicio===1).reservable,false);
   await pool.query('UPDATE trabajadora SET activa=true WHERE id_trabajadora=1');
   const antes=(await pool.query(`SELECT * FROM clienta WHERE correo='valentina@meraki.test'`)).rows[0];
   const reutilizada=(await request(app).post('/api/clientas').send({nombre:'No sobrescribir',correo:' VALENTINA@MERAKI.TEST ',telefono:'123'}).expect(200)).body;
   assert.equal(reutilizada.id_clienta,antes.id_clienta);assert.deepEqual((await pool.query('SELECT * FROM clienta WHERE id_clienta=$1',[antes.id_clienta])).rows[0],antes);
  });
  await t.test('Front Office: catálogo, disponibilidad, reserva y pago; fallo SMTP no revierte pago',async()=>{
   const negocios=(await request(app).get('/api/emprendimientos').expect(200)).body;assert(negocios.length);
   const servicios=(await request(app).get('/api/emprendimientos/1/servicios').expect(200)).body;assert(servicios[0].servicio);
   const personal=(await request(app).get('/api/servicios/1/trabajadoras').expect(200)).body;assert(personal.length);
   const fecha='2030-11-04';const horas=(await request(app).get('/api/disponibilidad').query({id_servicio:1,id_trabajadora:1,fecha}).expect(200)).body;assert(horas.length);
   const c=(await request(app).post('/api/clientas').send({nombre:'Prueba integral',correo:'integral@example.com'}).expect(201)).body;
   const r=(await request(app).post('/api/reservas').send({id_clienta:c.id_clienta,nombre_clienta:'Renata prueba',id_servicio:1,id_trabajadora:1,fecha,hora:horas[0].hora_inicio.slice(0,5)}).expect(201)).body.reserva;
   assert.equal((await agent.get('/api/reservas').query({id_emprendimiento:1}).expect(200)).body.find(x=>x.id_reserva===r.id_reserva).clienta,'Renata prueba');
   assert.equal((await pool.query('SELECT nombre FROM clienta WHERE id_clienta=$1',[c.id_clienta])).rows[0].nombre,'Prueba integral');
   const pago=(await request(app).post('/api/abonos/cliente/iniciar').send({token_consulta:r.token_consulta}).expect(201)).body;assert(pago.token);
   await pool.query('ALTER TABLE notificacion_correo ADD CONSTRAINT prueba_retorno CHECK(false) NOT VALID');
   await request(app).post('/api/abonos/retorno').send({token_ws:pago.token}).expect(502);
   assert.equal((await pool.query('SELECT estado FROM reserva WHERE id_reserva=$1',[r.id_reserva])).rows[0].estado,'pendiente_abono');
   await pool.query('ALTER TABLE notificacion_correo DROP CONSTRAINT prueba_retorno');
   modo='EAUTH';await request(app).post('/api/abonos/retorno').send({token_ws:pago.token}).expect(200);
   const resultado=(await pool.query('SELECT r.estado,n.estado AS correo FROM reserva r JOIN notificacion_correo n ON n.id_reserva=r.id_reserva WHERE r.id_reserva=$1',[r.id_reserva])).rows[0];assert.equal(resultado.estado,'confirmada');assert.equal(resultado.correo,'fallido');
   await request(app).post('/api/abonos/retorno').send({token_ws:pago.token}).expect(409);
  });
  await t.test('Cancelación: reservas sin abonos, estados y permisos por token',async()=>{
   const crypto=require('crypto');
   async function nueva(estado='pendiente_abono'){
    const token=crypto.randomUUID();
    const r=await pool.query(`INSERT INTO reserva(id_emprendimiento,id_servicio,id_trabajadora,id_clienta,fecha_hora_inicio,fecha_hora_fin,estado,precio_servicio,monto_abono,token_consulta)
     SELECT id_emprendimiento,id_servicio,id_trabajadora,id_clienta,'2031-01-06 10:00','2031-01-06 11:00',$1,precio_servicio,monto_abono,$2 FROM reserva WHERE id_reserva=1 RETURNING id_reserva`,[estado,token]);
    return {id:r.rows[0].id_reserva,token,ruta:'/api/reservas/consulta/'+token};
   }
   await request(app).patch('/api/reservas/consulta/invalido/cancelar').expect(400);
   await request(app).patch('/api/reservas/consulta/'+crypto.randomUUID()+'/cancelar').expect(404);
   for(const estado of ['pendiente_abono','confirmada']){
    const r=await nueva(estado);
    const antes=await request(app).get(r.ruta).expect(200);assert.equal(antes.body.capacidades.cancelar,true);
    await request(app).patch(r.ruta+'/cancelar').expect(200);
    const despues=await request(app).get(r.ruta).expect(200);assert.equal(despues.body.reserva.estado,'cancelada');assert.equal(despues.body.capacidades.cancelar,false);
    await request(app).patch(r.ruta+'/cancelar').expect(409);
   }
   for(const estado of ['pendiente','rechazado','aprobado']){
    const r=await nueva(estado==='aprobado'?'confirmada':'pendiente_abono');
    await pool.query('INSERT INTO abono(id_reserva,monto,estado) VALUES($1,5000,$2)',[r.id,estado]);
    const antes=await request(app).get(r.ruta).expect(200);assert.equal(antes.body.capacidades.cancelar,false);assert.match(antes.body.capacidades.motivoCancelacion,/Contacta/);assert.equal(antes.body.reserva.tiene_abonos,undefined);
    await request(app).patch(r.ruta+'/cancelar').expect(409);
    const despues=await request(app).get(r.ruta).expect(200);assert.equal(despues.body.reserva.estado,antes.body.reserva.estado);
    assert.equal((await pool.query('SELECT estado FROM abono WHERE id_reserva=$1',[r.id])).rows[0].estado,estado);
   }
   const terminal=await nueva('atendida');await request(app).patch(terminal.ruta+'/cancelar').expect(409);
   const concurrente=await nueva();
   const [cancelacion,pago]=await Promise.all([request(app).patch(concurrente.ruta+'/cancelar'),request(app).post('/api/abonos/cliente/iniciar').send({token_consulta:concurrente.token})]);
   assert((cancelacion.status===200&&pago.status===409)||(cancelacion.status===409&&pago.status===201));
   const final=(await request(app).get(concurrente.ruta).expect(200)).body.reserva;
   const abonos=(await pool.query('SELECT estado FROM abono WHERE id_reserva=$1',[concurrente.id])).rows;
   if(final.estado==='cancelada')assert.equal(abonos.length,0);else{assert.equal(final.estado,'pendiente_abono');assert.equal(abonos.length,1);}
  });
  await t.test('Agenda privada: pagos, cierre de atención y cancelación por propietaria',async()=>{
   const lista=(await agent.get('/api/reservas?id_emprendimiento=1').expect(200)).body;
   const recuperada=lista.find(r=>r.id_reserva===1);assert(recuperada.id_abono);assert.equal(recuperada.estado_abono,'aprobado');assert.equal(recuperada.puede_cancelar,false);assert.equal(recuperada.puede_cerrar,true);
   assert(!JSON.stringify(lista).includes('token_consulta'));
   await request(app).patch('/api/reservas/1/atender').expect(401);
   await agent.patch('/api/reservas/1/atender').expect(200);
   await agent.patch('/api/reservas/1/no-atendida').expect(404);
   async function nueva(fecha,estado){return (await pool.query(`INSERT INTO reserva(id_emprendimiento,id_servicio,id_trabajadora,id_clienta,fecha_hora_inicio,fecha_hora_fin,estado,precio_servicio,monto_abono)
    SELECT id_emprendimiento,id_servicio,id_trabajadora,id_clienta,$1::timestamp,$1::timestamp+INTERVAL '1 hour',$2,precio_servicio,monto_abono FROM reserva WHERE id_reserva=1 RETURNING id_reserva`,[fecha,estado])).rows[0].id_reserva;}
   const futura=await nueva('2031-01-07 10:00','confirmada');
   await agent.patch('/api/reservas/'+futura+'/atender').expect(404);await agent.patch('/api/reservas/'+futura+'/no-atendida').expect(404);
   const pasada=await nueva('2020-01-07 10:00','confirmada');await agent.patch('/api/reservas/'+pasada+'/no-atendida').expect(200);
   const sinAbono=await nueva('2031-01-08 10:00','pendiente_abono');
   await agent.patch('/api/reservas/'+sinAbono+'/cancelar').expect(200);
   const actualizada=(await agent.get('/api/reservas?id_emprendimiento=1').expect(200)).body;
   assert.equal(actualizada.find(r=>r.id_reserva===sinAbono).puede_cancelar,false);assert.equal(actualizada.find(r=>r.id_reserva===futura).puede_cerrar,false);assert.equal(actualizada.find(r=>r.id_reserva===pasada).estado,'no_atendida');
  });
  await t.test('Corrección de destinatario conserva pago, invalida enlace y no duplica envío',async()=>{
   const {corregirCorreoReserva}=require('../correccion-correo');const token=require('crypto').randomUUID();
   const id=(await pool.query(`INSERT INTO reserva(id_emprendimiento,id_servicio,id_trabajadora,id_clienta,fecha_hora_inicio,fecha_hora_fin,estado,precio_servicio,monto_abono,token_consulta)
     SELECT id_emprendimiento,id_servicio,id_trabajadora,id_clienta,'2031-02-03 10:00','2031-02-03 11:00','confirmada',precio_servicio,monto_abono,$1 FROM reserva WHERE id_reserva=1 RETURNING id_reserva`,[token])).rows[0].id_reserva;
   await pool.query(`INSERT INTO abono(id_reserva,monto,estado,fecha_pago) VALUES($1,5000,'aprobado',CURRENT_TIMESTAMP)`,[id]);
   const original=(await pool.query('SELECT correo FROM clienta WHERE id_clienta=(SELECT id_clienta FROM reserva WHERE id_reserva=$1)',[id])).rows[0].correo;
   const antes=(await pool.query('SELECT * FROM abono WHERE id_reserva=$1',[id])).rows[0];
   await pool.query(`INSERT INTO notificacion_correo(id_reserva,tipo,estado,intentos) VALUES($1,'confirmacion_reserva','enviado',1)`,[id]);
   const r=await corregirCorreoReserva(pool,id,'correcto@example.com');assert.equal(r.corregida,true);
   await request(app).get('/api/reservas/consulta/'+token).expect(404);
   let destinatario;const servicio=crearNotificaciones(pool,async datos=>{destinatario=datos.correo;return{idMensaje:'corregido-test'};});
   assert.equal((await servicio.notificar(id)).enviado,true);assert.equal(destinatario,'correcto@example.com');
   assert.equal((await corregirCorreoReserva(pool,id,'correcto@example.com')).corregida,false);
   assert.equal((await servicio.notificar(id)).enviado,false);
   const actual=(await pool.query('SELECT token_consulta,estado FROM reserva WHERE id_reserva=$1',[id])).rows[0];assert.equal(actual.estado,'confirmada');
   await request(app).get('/api/reservas/consulta/'+actual.token_consulta).expect(200);
   assert.deepEqual((await pool.query('SELECT * FROM abono WHERE id_reserva=$1',[id])).rows[0],antes);
   assert.equal((await pool.query('SELECT correo FROM clienta WHERE id_clienta=(SELECT id_clienta FROM reserva WHERE id_reserva=$1)',[id])).rows[0].correo,original);
   assert.equal((await pool.query('SELECT * FROM notificacion_correo WHERE id_reserva=$1',[id])).rows.length,2);
  });
  await t.test('Propietaria ajena no puede ver ni modificar notificación',async()=>{const r=await pool.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash) VALUES('Otra','Prueba','otro','otra@meraki.test',$1) RETURNING id_emprendedora",[await bcrypt.hash('clave-prueba',4)]);await pool.query('UPDATE emprendimiento SET id_emprendedora=$1',[r.rows[0].id_emprendedora]);await agent.get('/api/notificaciones').expect(200,[]);await agent.get('/api/reservas?id_emprendimiento=1').expect(403);await agent.get('/api/abonos/1/estado').expect(404);for(const accion of ['atender','no-atendida','cancelar'])await agent.patch('/api/reservas/1/'+accion).expect(404);await agent.post('/api/notificaciones/'+notificacionId+'/reintentar').set('X-Meraki-Action','1').send({evidencia:'Configuración revisada por operadora'}).expect(404);});
  await t.test('Consulta privada no expone token y no se almacena en caché',async()=>{const r=await request(app).get('/api/reservas/consulta/11111111-1111-4111-8111-111111111111').expect(200);assert.equal(r.headers['cache-control'],'no-store');assert(!JSON.stringify(r.body).includes('11111111'));await request(app).get('/consulta/').expect(200);await request(app).get('/front-office/').expect(200);await request(app).get('/back-office/').expect(200);});
 }finally{
  if(pool)await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();
 }
});
