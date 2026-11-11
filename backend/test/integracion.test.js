const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const vm=require('vm');const {createRequire}=require('module');
const request=require('supertest');const {Pool}=require('pg');const bcrypt=require('bcrypt');
const {crearNotificaciones}=require('../notificaciones');
require('dotenv').config({path:path.join(__dirname,'../.env')});
test('Integración PostgreSQL, sesión, recuperación y notificaciones',{skip:process.env.MERAKI_DB_TEST!=='1'},async t=>{
 const schema='meraki_test_'+Date.now();assert.match(schema,/^meraki_test_\d+$/);
 const config={host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD};
 const admin=new Pool(config);let pool;let app;let enviados=0;let modo='ok';let notificacionId=1;let transaccionesCreadas=0;let consultasWebpay=0;let alCrearWebpay;let alConfirmarWebpay;let status={status:'AUTHORIZED',response_code:0,amount:5000,buy_order:'orden-test',authorization_code:'TEST'};
 try{
  // La extensión debe estar instalada previamente: las pruebas no la instalan en la base principal.
  assert.equal((await admin.query("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='btree_gist') AS instalada")).rows[0].instalada,true);
  await admin.query('CREATE SCHEMA '+schema);pool=new Pool({...config,options:'-c search_path='+schema+',public'});
  for(const file of ['schema.sql','002_agregar_token_consulta.sql','003_notificaciones_correo.sql','004_fecha_inicio_envio.sql','005_revision_notificaciones.sql','006_correccion_correo_reserva.sql','007_nombre_reserva.sql','008_suscripcion_oneclick.sql','seed.sql'])await pool.query(fs.readFileSync(path.join(__dirname,'../../database',file),'utf8'));
  // public se usa solo al construir las tablas para resolver la extensión btree_gist.
  // Las consultas del servidor y sus sesiones nunca pueden recurrir a tablas de public.
  await pool.end();pool=new Pool({...config,options:'-c search_path='+schema});
  await t.test('Aislamiento: las consultas y sesiones solo resuelven el esquema temporal',async()=>{
   const contexto=(await pool.query('SELECT current_schema() AS esquema,current_schemas(false)::text[] AS rutas')).rows[0];
   assert.equal(contexto.esquema,schema);assert.deepEqual(contexto.rutas,[schema]);
  });
  await pool.query('UPDATE emprendedora SET password_hash=$1',[await bcrypt.hash('clave-prueba',4)]);
  // Las pruebas operativas parten de un plan vigente, sin inventar pagos en Transbank.
  await pool.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,monto_mensual,estado,acceso_hasta) SELECT id_emprendedora,CURRENT_DATE,9990,'prueba',DATE '2099-01-01' FROM emprendedora");
  await pool.query("UPDATE reserva SET token_consulta='11111111-1111-4111-8111-111111111111',estado='pendiente_abono'");
  await pool.query("INSERT INTO abono(id_reserva,monto,token_transaccion,buy_order) VALUES(1,5000,repeat('a',64),'orden-test')");
  await t.test('Migración de Webpay conserva el abono histórico y las garantías de unicidad',async()=>{
   const previo=(await pool.query('SELECT to_jsonb(a) AS abono FROM abono a WHERE id_abono=1')).rows[0].abono;
   await pool.query(fs.readFileSync(path.join(__dirname,'../../database/009_intentos_webpay.sql'),'utf8'));
   const posterior=(await pool.query('SELECT to_jsonb(a) AS abono FROM abono a WHERE id_abono=1')).rows[0].abono;
   assert.deepEqual(posterior,{...previo,fase_webpay:null,sesion_webpay:null,fecha_fase_webpay:null});
   const indices=(await pool.query("SELECT indexdef FROM pg_indexes WHERE schemaname=current_schema() AND tablename='abono'")).rows.map(r=>r.indexdef);
   for(const patron of [/UNIQUE.*(buy_order)/,/UNIQUE.*(token_transaccion)/,/UNIQUE.*(id_reserva).*pendiente/,/UNIQUE.*(id_reserva).*aprobado/,/UNIQUE.*(sesion_webpay)/]){
    assert(indices.some(indice=>patron.test(indice)),String(patron));
   }
  });
  const previo010=(await pool.query('SELECT to_jsonb(a) AS fila FROM abono a WHERE id_abono=1')).rows[0].fila;
  await pool.query(fs.readFileSync(path.join(__dirname,'../../database/010_procesamiento_webpay.sql'),'utf8'));
  const historico=(await pool.query('SELECT to_jsonb(a) AS fila FROM abono a WHERE id_abono=1')).rows[0].fila;
  assert.deepEqual(historico,{...previo010,operacion_webpay:null,tipo_operacion_webpay:null,
   estado_proceso_webpay:null,fecha_operacion_webpay:null,commit_webpay_reclamado_en:null});
  const financiero=async id=>(await pool.query('SELECT id_abono,id_reserva,estado,monto,buy_order,token_transaccion,codigo_autorizacion,fecha_pago FROM abono WHERE id_abono=$1',[id])).rows;
  const enviar=async()=>{enviados++;if(modo!=='ok'){const e=new Error('fallo simulado');e.code=modo;throw e;}return{idMensaje:'mensaje-test'};};
  const req=createRequire(path.join(__dirname,'../index.js'));const module={exports:{}};
  const wrapped=n=>n==='./db'?pool:n==='./notificaciones'?{...req(n),crearNotificaciones:p=>crearNotificaciones(p,enviar)}:n==='transbank-sdk'?{WebpayPlus:{Transaction:class{async status(){consultasWebpay++;return status;} async create(order,session,amount,returnUrl){if(alCrearWebpay)await alCrearWebpay(order,session,amount,returnUrl);status={status:"AUTHORIZED",response_code:0,amount,buy_order:order,authorization_code:"TEST"};return {token:String(++transaccionesCreadas).padStart(64,"a"),url:"https://webpay3gint.transbank.cl/webpayserver/initTransaction"};} async commit(token){return alConfirmarWebpay?alConfirmarWebpay(token):status;}}},Options:class{},IntegrationCommerceCodes:{},IntegrationApiKeys:{},Environment:{}}:req(n);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../index.js'),'utf8'),{require:wrapped,module,__dirname:path.join(__dirname,'..'),process,console,URL,Buffer,setTimeout,clearTimeout});app=module.exports;
  const agent=request.agent(app);
  await t.test('Consulta privada: PostgreSQL conserva componentes civiles en distintas zonas',async()=>{
   const original=(await pool.query(`SELECT TO_CHAR(fecha_hora_inicio,'YYYY-MM-DD"T"HH24:MI:SS') AS inicio, TO_CHAR(fecha_hora_fin,'YYYY-MM-DD"T"HH24:MI:SS') AS fin FROM reserva WHERE id_reserva=1`)).rows[0];
   const zonaAnterior=process.env.TZ;
   const sesion=request.agent(app);
   await sesion.post('/api/auth/login').send({correo:'camila@meraki.test',password:'clave-prueba'}).expect(200);
   try {
    for(const zona of ['America/Santiago','UTC','Asia/Tokyo']) {
     process.env.TZ=zona;
     for(const civil of ['2026-11-18T15:00:00','2026-07-18T15:00:00','2026-12-31T23:30:00','2027-01-01T00:30:00','2026-04-04T23:30:00','2026-09-06T00:30:00']) {
      await pool.query("UPDATE reserva SET fecha_hora_inicio=$1::timestamp,fecha_hora_fin=$1::timestamp+interval '1 hour' WHERE id_reserva=1",[civil]);
      const fila=(await pool.query('SELECT fecha_hora_inicio,fecha_hora_fin FROM reserva WHERE id_reserva=1')).rows[0];
      const respuesta=(await request(app).get('/api/reservas/consulta/11111111-1111-4111-8111-111111111111').expect(200)).body;
      assert.equal(respuesta.reserva.fecha_hora_inicio_civil,civil);
      assert.equal(respuesta.reserva.zona_horaria,'America/Santiago');
      assert.equal(respuesta.reserva.fecha_hora_inicio,fila.fecha_hora_inicio.toISOString());
      assert.equal(respuesta.reserva.fecha_hora_fin,fila.fecha_hora_fin.toISOString());
      const fin=(await pool.query(`SELECT TO_CHAR(fecha_hora_fin,'YYYY-MM-DD"T"HH24:MI:SS') AS civil FROM reserva WHERE id_reserva=1`)).rows[0].civil;
      assert.equal(respuesta.reserva.fecha_hora_fin_civil,fin);
      assert(respuesta.pago);assert(respuesta.capacidades);
      const agenda=(await sesion.get('/api/reservas?id_emprendimiento=1').expect(200)).body;
      assert.equal(agenda.find(r=>r.id_reserva===1).fecha_hora_inicio,civil);
     }
    }
   } finally {
    if(zonaAnterior===undefined)delete process.env.TZ;else process.env.TZ=zonaAnterior;
    await pool.query('UPDATE reserva SET fecha_hora_inicio=$1::timestamp,fecha_hora_fin=$2::timestamp WHERE id_reserva=1',[original.inicio,original.fin]);
    await sesion.post('/api/auth/logout').expect(200);
   }
  });
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
   await pool.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,monto_mensual,estado,acceso_hasta) VALUES($1,CURRENT_DATE,9990,'prueba',DATE '2099-01-01')",[cuenta.id_emprendedora]);
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
  let trabajadoraGestion,servicioTrabajadora;
  const datosTrabajadora={id_emprendimiento:1,nombre:' Profesional prueba ',apellido:' Apellido ',descripcion:' Descripción '};
  await t.test('Trabajadoras: autenticación y validación de campos',async()=>{
   await request(app).get('/api/mis-trabajadoras').expect(401);
   await request(app).post('/api/trabajadoras').send(datosTrabajadora).expect(401);
   await request(app).patch('/api/trabajadoras/1').send({nombre:'Prueba'}).expect(401);
   for(const cambio of [{nombre:''},{nombre:'x'.repeat(101)},{apellido:4},{descripcion:4},{descripcion:'x'.repeat(1001)},{activa:false}]){
    await agent.post('/api/trabajadoras').send({...datosTrabajadora,...cambio}).expect(400);
   }
   for(const cambio of [{},{nombre:null},{nombre:' '},{apellido:'x'.repeat(101)},{descripcion:4},{activa:false},{nombre:'Prueba',id_emprendimiento:2}]){
    await agent.patch('/api/trabajadoras/1').send(cambio).expect(400);
   }
  });
  await t.test('Trabajadoras: creación y edición con limpieza de opcionales',async()=>{
   trabajadoraGestion=(await agent.post('/api/trabajadoras').send(datosTrabajadora).expect(201)).body.trabajadora;
   assert.equal(trabajadoraGestion.nombre,'Profesional prueba');assert.equal(trabajadoraGestion.apellido,'Apellido');assert.equal(trabajadoraGestion.activa,true);
   const t=(await agent.patch('/api/trabajadoras/'+trabajadoraGestion.id_trabajadora).send({nombre:' Profesional editada ',apellido:null,descripcion:null}).expect(200)).body.trabajadora;
   assert.equal(t.nombre,'Profesional editada');assert.equal(t.apellido,null);assert.equal(t.descripcion,null);
   assert((await agent.get('/api/mis-trabajadoras').expect(200)).body.some(x=>x.id_trabajadora===t.id_trabajadora));
   servicioTrabajadora=(await agent.post('/api/servicios').send({...datosServicio,nombre:'Z servicio para asignar'}).expect(201)).body.servicio;
  });
  await t.test('Asignaciones: habilita profesional y evita duplicados concurrentes',async()=>{
   const ruta='/api/trabajadoras/'+trabajadoraGestion.id_trabajadora+'/servicios';
   await request(app).get(ruta).expect(401);await request(app).post(ruta).send({id_servicio:servicioTrabajadora.id_servicio}).expect(401);
   await agent.post(ruta).send({id_servicio:servicioTrabajadora.id_servicio,activa:true}).expect(400);
   const antes=(await request(app).get('/api/emprendimientos/1/servicios').expect(200)).body.find(s=>s.id_servicio===servicioTrabajadora.id_servicio);assert.equal(antes.reservable,false);
   const respuestas=await Promise.all([agent.post(ruta).send({id_servicio:servicioTrabajadora.id_servicio}),agent.post(ruta).send({id_servicio:servicioTrabajadora.id_servicio})]);
   assert.deepEqual(respuestas.map(r=>r.status).sort(),[201,409]);
   assert.equal((await agent.get(ruta).expect(200)).body.length,1);
   assert.equal((await request(app).get('/api/emprendimientos/1/servicios').expect(200)).body.find(s=>s.id_servicio===servicioTrabajadora.id_servicio).reservable,true);
   const profesionales=(await request(app).get('/api/servicios/'+servicioTrabajadora.id_servicio+'/trabajadoras').expect(200)).body;assert(profesionales.some(t=>t.id_trabajadora===trabajadoraGestion.id_trabajadora));
   // Una asignación no inventa un horario de atención.
   await request(app).get('/api/disponibilidad').query({id_servicio:servicioTrabajadora.id_servicio,id_trabajadora:trabajadoraGestion.id_trabajadora,fecha:'2030-11-04'}).expect(200,[]);
  });
  await t.test('Trabajadoras y asignaciones: impide acceso ajeno y cruce de negocios',async()=>{
   const otra=request.agent(app);await otra.post('/api/auth/login').send({correo:'perfil@meraki.test',password:'clave-prueba'}).expect(200);
   await otra.get('/api/mis-trabajadoras').expect(200,[]);await otra.post('/api/trabajadoras').send(datosTrabajadora).expect(403);
   const base='/api/trabajadoras/'+trabajadoraGestion.id_trabajadora;
   await otra.patch(base).send({nombre:'Ajena'}).expect(404);await otra.patch(base+'/desactivar').expect(404);await otra.get(base+'/servicios').expect(404);
   await otra.post(base+'/servicios').send({id_servicio:servicioTrabajadora.id_servicio}).expect(404);
   await otra.delete(base+'/servicios/'+servicioTrabajadora.id_servicio).expect(404);
   const dueña=(await pool.query("SELECT id_emprendedora FROM emprendedora WHERE correo='perfil@meraki.test'")).rows[0].id_emprendedora;
   const negocioAjeno=(await pool.query("INSERT INTO emprendimiento(id_emprendedora,nombre) VALUES($1,'Negocio ajeno') RETURNING id_emprendimiento",[dueña])).rows[0].id_emprendimiento;
   const ajeno=(await pool.query("INSERT INTO servicio(id_emprendimiento,id_categoria,nombre,precio,duracion_min,monto_abono) VALUES($1,1,'Servicio ajeno',20000,60,5000) RETURNING id_servicio",[negocioAjeno])).rows[0].id_servicio;
   await agent.post(base+'/servicios').send({id_servicio:ajeno}).expect(404);
   await agent.post(base+'/servicios').send({id_servicio:servicioGestion.id_servicio}).expect(404);
   await otra.post('/api/auth/logout').expect(200);
  });
  await t.test('Asignaciones: retirar conserva reservas y retira disponibilidad profesional',async()=>{
   const reservas=(await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows;
   const ruta='/api/trabajadoras/'+trabajadoraGestion.id_trabajadora+'/servicios/'+servicioTrabajadora.id_servicio;
   await request(app).delete(ruta).expect(401);await agent.delete(ruta).expect(200);await agent.delete(ruta).expect(404);
   assert.deepEqual((await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows,reservas);
   assert.equal((await request(app).get('/api/emprendimientos/1/servicios').expect(200)).body.find(s=>s.id_servicio===servicioTrabajadora.id_servicio).reservable,false);
  });
  await t.test('Trabajadoras: desactivar conserva historial y excluye nuevas reservas',async()=>{
   const base='/api/trabajadoras/'+trabajadoraGestion.id_trabajadora;
   await agent.post(base+'/servicios').send({id_servicio:servicioTrabajadora.id_servicio}).expect(201);
   const reservas=(await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows;
   await request(app).patch(base+'/desactivar').expect(401);await agent.patch(base+'/desactivar').expect(200);await agent.patch(base+'/desactivar').expect(409);
   assert.equal((await agent.get('/api/mis-trabajadoras').expect(200)).body.find(t=>t.id_trabajadora===trabajadoraGestion.id_trabajadora).activa,false);
   assert.equal((await agent.get(base+'/servicios').expect(200)).body.length,1);
   await agent.post(base+'/servicios').send({id_servicio:1}).expect(404);
   assert(!(await request(app).get('/api/servicios/'+servicioTrabajadora.id_servicio+'/trabajadoras').expect(200)).body.length);
   assert.deepEqual((await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows,reservas);
  });
  let profesionalHorario,horarioPrincipal,horarioContiguo,bloqueoPrueba;
  const fechaHorario='2030-11-04';
  const horasPrueba=async()=> (await request(app).get('/api/disponibilidad').query({id_servicio:1,id_trabajadora:profesionalHorario,fecha:fechaHorario}).expect(200)).body;
  await t.test('Horarios y bloqueos: autenticación y validaciones',async()=>{
   profesionalHorario=(await agent.post('/api/trabajadoras').send({...datosTrabajadora,nombre:'Profesional horarios'}).expect(201)).body.trabajadora.id_trabajadora;
   await agent.post('/api/trabajadoras/'+profesionalHorario+'/servicios').send({id_servicio:1}).expect(201);
   await request(app).get('/api/mis-horarios').expect(401);await request(app).get('/api/mis-bloqueos').expect(401);
   const horario={id_trabajadora:profesionalHorario,dia_semana:'lunes',hora_inicio:'09:00',hora_fin:'12:00'};
   await request(app).post('/api/horarios').send(horario).expect(401);
   for(const cambio of [{dia_semana:'feriado'},{hora_inicio:'25:00'},{hora_fin:'08:00'},{hora_fin:'09:00'},{activo:false}])await agent.post('/api/horarios').send({...horario,...cambio}).expect(400);
   await agent.patch('/api/horarios/1').send({}).expect(400);await agent.patch('/api/horarios/1').send({id_trabajadora:profesionalHorario}).expect(400);
   const bloqueo={id_trabajadora:profesionalHorario,fecha_inicio:fechaHorario+'T10:00',fecha_fin:fechaHorario+'T11:00'};
   await request(app).post('/api/bloqueos').send(bloqueo).expect(401);
   for(const cambio of [{fecha_inicio:'2030-02-30T10:00'},{fecha_inicio:fechaHorario+'T10:00Z'},{fecha_fin:fechaHorario+'T09:00'},{motivo:'x'.repeat(256)},{activo:false}])await agent.post('/api/bloqueos').send({...bloqueo,...cambio}).expect(400);
  });
  await t.test('Horarios: concurrencia rechaza superposición y permite tramos contiguos',async()=>{
   const datos={id_trabajadora:profesionalHorario,dia_semana:'lunes',hora_inicio:'09:00',hora_fin:'12:00'};
   const respuestas=await Promise.all([agent.post('/api/horarios').send(datos),agent.post('/api/horarios').send(datos)]);
   assert.deepEqual(respuestas.map(r=>r.status).sort(),[201,409]);horarioPrincipal=respuestas.find(r=>r.status===201).body.horario.id_horario;
   horarioContiguo=(await agent.post('/api/horarios').send({...datos,hora_inicio:'12:00',hora_fin:'13:00'}).expect(201)).body.horario.id_horario;
   await agent.patch('/api/horarios/'+horarioContiguo).send({hora_inicio:'11:00'}).expect(409);
   await agent.patch('/api/horarios/'+horarioPrincipal).send({hora_inicio:'10:00'}).expect(200);
   assert.deepEqual((await horasPrueba()).map(h=>h.hora_inicio.slice(0,5)),['10:00','11:00','12:00']);
  });
  await t.test('Bloqueos: protege reservas activas, modifica disponibilidad y permite retirar',async()=>{
   await request(app).post('/api/reservas').send({id_clienta:1,id_trabajadora:profesionalHorario,id_servicio:1,fecha:fechaHorario,hora:'10:00'}).expect(201);
   const antes=(await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows;
   await agent.post('/api/bloqueos').send({id_trabajadora:profesionalHorario,fecha_inicio:fechaHorario+'T10:00',fecha_fin:fechaHorario+'T11:00'}).expect(409);
   bloqueoPrueba=(await agent.post('/api/bloqueos').send({id_trabajadora:profesionalHorario,fecha_inicio:fechaHorario+'T11:00',fecha_fin:fechaHorario+'T12:00',motivo:' Ausencia '}).expect(201)).body.bloqueo.id_bloqueo;
   await agent.post('/api/bloqueos').send({id_trabajadora:profesionalHorario,fecha_inicio:fechaHorario+'T11:30',fecha_fin:fechaHorario+'T12:30'}).expect(409);
   assert.deepEqual((await horasPrueba()).map(h=>h.hora_inicio.slice(0,5)),['12:00']);
   const registrado=(await agent.get('/api/mis-bloqueos').expect(200)).body.find(b=>b.id_bloqueo===bloqueoPrueba);assert.equal(registrado.fecha_inicio,fechaHorario+'T11:00:00');assert.equal(registrado.motivo,'Ausencia');
   await request(app).delete('/api/bloqueos/'+bloqueoPrueba).expect(401);await agent.delete('/api/bloqueos/'+bloqueoPrueba).expect(200);await agent.delete('/api/bloqueos/'+bloqueoPrueba).expect(404);
   assert.deepEqual((await horasPrueba()).map(h=>h.hora_inicio.slice(0,5)),['11:00','12:00']);
   assert.deepEqual((await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows,antes);
  });
  await t.test('Bloqueos: carrera con nueva reserva nunca ocupa dos veces el período',async()=>{
   const respuestas=await Promise.all([
    request(app).post('/api/reservas').send({id_clienta:1,id_trabajadora:profesionalHorario,id_servicio:1,fecha:fechaHorario,hora:'11:00'}),
    agent.post('/api/bloqueos').send({id_trabajadora:profesionalHorario,fecha_inicio:fechaHorario+'T11:00',fecha_fin:fechaHorario+'T12:00'})
   ]);assert.deepEqual(respuestas.map(r=>r.status).sort(),[201,409]);
  });
  await t.test('Horarios y bloqueos: otra propietaria no consulta ni modifica datos ajenos',async()=>{
   const otra=request.agent(app);await otra.post('/api/auth/login').send({correo:'perfil@meraki.test',password:'clave-prueba'}).expect(200);
   await otra.get('/api/mis-horarios').expect(200,[]);await otra.get('/api/mis-bloqueos').expect(200,[]);
   await otra.post('/api/horarios').send({id_trabajadora:profesionalHorario,dia_semana:'martes',hora_inicio:'09:00',hora_fin:'12:00'}).expect(404);
   await otra.patch('/api/horarios/'+horarioPrincipal).send({hora_inicio:'09:00'}).expect(404);await otra.patch('/api/horarios/'+horarioPrincipal+'/desactivar').expect(404);
   const b=(await agent.post('/api/bloqueos').send({id_trabajadora:profesionalHorario,fecha_inicio:fechaHorario+'T15:00',fecha_fin:fechaHorario+'T16:00'}).expect(201)).body.bloqueo.id_bloqueo;
   await otra.post('/api/bloqueos').send({id_trabajadora:profesionalHorario,fecha_inicio:fechaHorario+'T16:00',fecha_fin:fechaHorario+'T17:00'}).expect(404);await otra.delete('/api/bloqueos/'+b).expect(404);
   await otra.post('/api/auth/logout').expect(200);
  });
  await t.test('Horarios: desactivación conserva citas y excluye nuevas horas',async()=>{
   const antes=(await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows;
   await request(app).patch('/api/horarios/'+horarioPrincipal+'/desactivar').expect(401);
   await agent.patch('/api/horarios/'+horarioPrincipal+'/desactivar').expect(200);await agent.patch('/api/horarios/'+horarioPrincipal+'/desactivar').expect(409);
   await agent.patch('/api/horarios/'+horarioPrincipal).send({hora_inicio:'08:00'}).expect(409);
   await agent.patch('/api/horarios/'+horarioContiguo+'/desactivar').expect(200);
   assert.deepEqual(await horasPrueba(),[]);assert.deepEqual((await pool.query('SELECT * FROM reserva ORDER BY id_reserva')).rows,antes);
   await agent.post('/api/horarios').send({id_trabajadora:trabajadoraGestion.id_trabajadora,dia_semana:'martes',hora_inicio:'09:00',hora_fin:'12:00'}).expect(409);
   // El resto de la batería conserva su escenario original de una sola profesional activa para este servicio.
   await agent.patch('/api/trabajadoras/'+profesionalHorario+'/desactivar').expect(200);
  });
  await t.test('Suscripción vencida bloquea configuración y reservas nuevas, conserva agenda y pagos existentes',async()=>{
   const pagos=(await pool.query('SELECT * FROM abono ORDER BY id_abono')).rows;
   await pool.query("UPDATE suscripcion SET estado='vencida',acceso_hasta=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date WHERE id_emprendedora=1");
   assert.equal((await agent.get('/api/suscripcion').expect(200)).body.capacidades.configurar,false);
   for(const [metodo,ruta,datos] of [
    ['post','/api/servicios',datosServicio],['patch','/api/servicios/1',{precio:10000}],['patch','/api/servicios/1/desactivar',{}],
    ['post','/api/trabajadoras',datosTrabajadora],['patch','/api/trabajadoras/1',{nombre:'Otro'}],['patch','/api/trabajadoras/1/desactivar',{}],
    ['post','/api/trabajadoras/1/servicios',{id_servicio:1}],['delete','/api/trabajadoras/1/servicios/1',{}],
    ['post','/api/horarios',{id_trabajadora:1,dia_semana:'lunes',hora_inicio:'09:00',hora_fin:'12:00'}],['patch','/api/horarios/1',{hora_inicio:'09:00'}],
    ['patch','/api/horarios/1/desactivar',{}],['post','/api/bloqueos',{id_trabajadora:1,fecha_inicio:'2030-11-04T10:00',fecha_fin:'2030-11-04T11:00'}],['delete','/api/bloqueos/1',{}]
   ])await agent[metodo](ruta).send(datos).expect(402);
   for(const ruta of ['/api/reservas?id_emprendimiento=1','/api/mis-servicios','/api/mis-trabajadoras','/api/mis-horarios','/api/mis-bloqueos','/api/notificaciones','/api/abonos/1/estado'])await agent.get(ruta).expect(200);
   await request(app).post('/api/reservas').send({id_clienta:1,id_servicio:1,id_trabajadora:1,fecha:'2030-11-04',hora:'10:00'}).expect(409);
   await request(app).get('/api/disponibilidad').query({id_servicio:1,id_trabajadora:1,fecha:'2030-11-04'}).expect(200,[]);
   const catalogo=(await request(app).get('/api/emprendimientos/1/servicios').expect(200)).body;assert(catalogo.every(s=>s.reservable===false));
   await request(app).get('/api/reservas/consulta/11111111-1111-4111-8111-111111111111').expect(200);
   assert.deepEqual((await pool.query('SELECT * FROM abono ORDER BY id_abono')).rows,pagos);
   const cita=(await pool.query(`INSERT INTO reserva(id_emprendimiento,id_servicio,id_trabajadora,id_clienta,fecha_hora_inicio,fecha_hora_fin,estado,precio_servicio,monto_abono,token_consulta)
    VALUES(1,1,1,1,'2020-01-01 10:00','2020-01-01 11:00','confirmada',20000,5000,$1) RETURNING id_reserva`,[require('crypto').randomUUID()])).rows[0].id_reserva;
   await agent.patch('/api/reservas/'+cita+'/atender').expect(200);
   await pool.query("UPDATE suscripcion SET estado='prueba',acceso_hasta=DATE '2099-01-01' WHERE id_emprendedora=1");
  });
  await t.test('Cancelación con período vigente conserva configuración y una vigencia restaurada desbloquea',async()=>{
   await pool.query("UPDATE suscripcion SET estado='cancelada',renovacion_automatica=FALSE WHERE id_emprendedora=1");
   assert.equal((await agent.get('/api/suscripcion').expect(200)).body.capacidades.configurar,true);
   const s=(await pool.query('SELECT nombre FROM servicio WHERE id_servicio=1')).rows[0];await agent.patch('/api/servicios/1').send({nombre:s.nombre}).expect(200);
   assert.equal((await request(app).get('/api/emprendimientos/1/servicios').expect(200)).body.find(s=>s.id_servicio===1).reservable,true);
   await pool.query("UPDATE suscripcion SET estado='prueba' WHERE id_emprendedora=1");
  });
  await t.test('Consulta Webpay solo habilita recuperación de una autorización válida y coincidente',async()=>{
   await request(app).get('/api/abonos/1/estado').expect(401);
   const valida=(await agent.get('/api/abonos/1/estado').expect(200)).body;assert.equal(valida.puede_recuperar,true);
   status.response_code=null;assert.equal((await agent.get('/api/abonos/1/estado').expect(200)).body.puede_recuperar,false);
   status.response_code=0;status.amount=99;assert.equal((await agent.get('/api/abonos/1/estado').expect(200)).body.puede_recuperar,false);
   status.amount=5000;status.status='INITIALIZED';assert.equal((await agent.get('/api/abonos/1/estado').expect(200)).body.puede_recuperar,false);status.status='AUTHORIZED';
  });
  await t.test('Webpay inconsistente no confirma ni envía',async()=>{status.amount=99;await agent.post('/api/abonos/1/recuperar').expect(409);assert.equal(enviados,0);status.amount=5000;});
  await t.test('INITIALIZED e incompleto no recuperan pago',async()=>{
   status.status='INITIALIZED';await agent.post('/api/abonos/1/recuperar').expect(200);assert.equal(enviados,0);
   status.status='AUTHORIZED';status.response_code=null;await agent.post('/api/abonos/1/recuperar').expect(409);status.response_code=0;
  });
  await t.test('Webpay sin código de autorización válido no habilita recuperación ni modifica datos',async()=>{
   const codigo=status.authorization_code;
   const antesAbono=await financiero(1);
   const antesReserva=(await pool.query('SELECT * FROM reserva WHERE id_reserva=1')).rows;
   const antesNotificaciones=(await pool.query('SELECT * FROM notificacion_correo')).rows;
   const antesEnvios=enviados;
   try{
    for(const invalido of [undefined,null,'','   ',123,'x'.repeat(101)]){
     status.authorization_code=invalido;
     assert.equal((await agent.get('/api/abonos/1/estado').expect(200)).body.puede_recuperar,false);
     await agent.post('/api/abonos/1/recuperar').expect(409);
     assert.deepEqual(await financiero(1),antesAbono);
     assert.deepEqual((await pool.query('SELECT * FROM reserva WHERE id_reserva=1')).rows,antesReserva);
     assert.deepEqual((await pool.query('SELECT * FROM notificacion_correo')).rows,antesNotificaciones);
     assert.equal(enviados,antesEnvios);
    }
   }finally{status.authorization_code=codigo;}
  });
  await t.test('Retorno Webpay GET y POST sin autorización válida conserva el pago pendiente y no envía',async()=>{
   const codigo=status.authorization_code;
   const tokenOriginal=(await pool.query('SELECT token_transaccion FROM abono WHERE id_abono=1')).rows[0].token_transaccion;
   const token='b'.repeat(64);
   await pool.query('UPDATE abono SET token_transaccion=$1 WHERE id_abono=1',[token]);
   const antesAbono=await financiero(1);
   const antesReserva=(await pool.query('SELECT * FROM reserva WHERE id_reserva=1')).rows;
   const antesNotificaciones=(await pool.query('SELECT * FROM notificacion_correo')).rows;
   const antesEnvios=enviados;
   try{
    for(const invalido of [undefined,null,'','   ',123,'x'.repeat(101)]){
     status.authorization_code=invalido;
     await pool.query("UPDATE abono SET operacion_webpay=NULL,tipo_operacion_webpay=NULL,estado_proceso_webpay=NULL,fecha_operacion_webpay=NULL,commit_webpay_reclamado_en=NULL WHERE id_abono=1");
     await request(app).get('/api/abonos/retorno').query({token_ws:token}).expect(409);
     await request(app).post('/api/abonos/retorno').send({token_ws:token}).expect(409);
     assert.deepEqual(await financiero(1),antesAbono);
     assert.deepEqual((await pool.query('SELECT * FROM reserva WHERE id_reserva=1')).rows,antesReserva);
     assert.deepEqual((await pool.query('SELECT * FROM notificacion_correo')).rows,antesNotificaciones);
     assert.equal(enviados,antesEnvios);
    }
   }finally{status.authorization_code=codigo;await pool.query('UPDATE abono SET token_transaccion=$1 WHERE id_abono=1',[tokenOriginal]);}
  });
  await t.test('Fallo al guardar outbox revierte pago y reserva',async()=>{
   await pool.query('ALTER TABLE notificacion_correo ADD CONSTRAINT prueba_bloqueo CHECK(false) NOT VALID');
   await agent.post('/api/abonos/1/recuperar').expect(502);
   assert.equal((await pool.query('SELECT estado FROM abono WHERE id_abono=1')).rows[0].estado,'pendiente');
   assert.equal((await pool.query('SELECT estado FROM reserva WHERE id_reserva=1')).rows[0].estado,'pendiente_abono');assert.equal(enviados,0);
   await pool.query('ALTER TABLE notificacion_correo DROP CONSTRAINT prueba_bloqueo');
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
   await request(app).post('/api/abonos/retorno').send({token_ws:pago.token}).expect(409);
   modo='EAUTH';await agent.post('/api/abonos/'+pago.id_abono+'/recuperar').expect(200);
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
  await t.test('Inicio durable de Webpay desde ambas rutas',async t=>{
   const {randomUUID}=require('node:crypto');
   const {crearInicioWebpay}=require('../inicio-webpay');
   const retorno='http://localhost:3000/api/abonos/retorno';
   let dia=0;
   async function nueva(monto=5000){
    const token=randomUUID();
    const r=await pool.query(`
     INSERT INTO reserva(id_emprendimiento,id_servicio,id_trabajadora,id_clienta,fecha_hora_inicio,fecha_hora_fin,estado,precio_servicio,monto_abono,token_consulta)
     SELECT id_emprendimiento,id_servicio,id_trabajadora,id_clienta,
      TIMESTAMP '2032-01-01 10:00'+$1::int*INTERVAL '1 day',
      TIMESTAMP '2032-01-01 11:00'+$1::int*INTERVAL '1 day',
      'pendiente_abono',precio_servicio,$2,$3 FROM reserva WHERE id_reserva=1 RETURNING id_reserva
    `,[++dia,monto,token]);
    return {id:r.rows[0].id_reserva,token};
   }
   const buscar=async id=>(await pool.query('SELECT * FROM abono WHERE id_reserva=$1',[id])).rows;
   const privada=r=>request(app).post('/api/abonos/cliente/iniciar').send({token_consulta:r.token});
   const interna=r=>agent.post('/api/abonos/iniciar').send({id_reserva:r.id});
   await t.test('Una sola llamada externa y registro visible desde otra conexión antes de create',async()=>{
    const r=await nueva();
    const inicial=transaccionesCreadas;
    const correos=enviados;
    let statusLocal;
    alCrearWebpay=async (orden,sesion,monto)=>{
     const [a]=await buscar(r.id);
     assert.equal(a.fase_webpay,'creacion_en_curso');
     assert.equal(a.token_transaccion,null);
     assert.equal(a.buy_order,orden);
     assert.equal(a.sesion_webpay,sesion);
     assert.equal(Number(a.monto),monto);
     statusLocal=(await agent.get('/api/abonos/'+a.id_abono+'/estado').expect(200)).body;
    };
    let respuestas;
    try{respuestas=await Promise.all([interna(r),privada(r)]);}finally{alCrearWebpay=null;}
    assert.deepEqual(respuestas.map(x=>x.status).sort(),[201,409]);
    assert.equal(statusLocal.fase_webpay,'creacion_en_curso');
    assert.equal(statusLocal.puede_recuperar,false);
    assert.equal(transaccionesCreadas,inicial+1);
    const [a]=await buscar(r.id);
    assert.equal(a.fase_webpay,'pendiente_respuesta_pago');
    assert.equal(a.token_transaccion,respuestas.find(x=>x.status===201).body.token);
    const local=(await agent.get('/api/abonos/'+a.id_abono+'/estado').expect(200)).body;
    assert.equal(local.puede_consultar_webpay,true);
    assert.equal(local.estado_transbank,undefined);
    assert.equal(local.token_transaccion,undefined);
    await agent.get('/api/abonos/'+a.id_abono+'/estado?verificar=1').expect(200);
    status={...status,status:'FAILED',response_code:-1};
    await request(app).post('/api/abonos/retorno').send({token_ws:a.token_transaccion}).expect(200);
    assert.equal((await buscar(r.id))[0].estado,'rechazado');
    assert.equal(enviados,correos);
   });
   await t.test('Sesión, token y monto inválidos no alcanzan create',async()=>{
    const inicial=transaccionesCreadas;
    const r=await nueva(0);
    await request(app).post('/api/abonos/iniciar').send({id_reserva:r.id}).expect(401);
    await privada({token:'invalido'}).expect(400);
    await privada({token:randomUUID()}).expect(404);
    await interna(r).expect(400);
    await privada(r).expect(400);
    assert.equal(transaccionesCreadas,inicial);
    assert.equal((await buscar(r.id)).length,0);
   });
   await t.test('COMMIT fallido o confirmado sin respuesta nunca llama a create',async()=>{
    for(const confirmado of [false,true]){
     const r=await nueva();
     const conexion={
      query:pool.query.bind(pool),
      async connect(){
       const db=await pool.connect();
       return {
        release:error=>db.release(error),
        async query(sql,args){
         if(sql!=='COMMIT')return db.query(sql,args);
         if(confirmado)await db.query(sql,args);
         throw Error('Respuesta del COMMIT perdida');
        }
       };
      }
     };
     let llamadas=0;
     const webpay={create:async()=>{llamadas++;}};
     const resultado=await crearInicioWebpay({pool:conexion,webpay})({token:r.token},retorno);
     assert.equal(resultado.codigo,502);
     assert.equal(llamadas,0);
     const filas=await buscar(r.id);
     assert.equal(filas.length,confirmado?1:0);
     if(confirmado){
      const a=filas[0];
      assert.equal(a.fase_webpay,'creacion_en_curso');
      await pool.query("UPDATE abono SET fecha_fase_webpay=clock_timestamp()-INTERVAL '2 minutes' WHERE id_abono=$1",[a.id_abono]);
      const local=(await agent.get('/api/abonos/'+a.id_abono+'/estado?verificar=1').expect(200)).body;
      assert.equal(local.requiere_revision,true);
      assert.equal(local.puede_recuperar,false);
      assert.equal((await crearInicioWebpay({pool,webpay})({token:r.token},retorno)).codigo,409);
      assert.equal(llamadas,0);
     }
    }
   });
   await t.test('Timeout, respuesta incompleta y fallo al guardar token bloquean después de reiniciar',async()=>{
    for(const modo of ['timeout','incompleto','token_duplicado']){
     const r=await nueva();
     const token='a'.repeat(63)+'f';
     if(modo==='token_duplicado'){
      const anterior=await nueva();
      await pool.query("INSERT INTO abono(id_reserva,monto,estado,token_transaccion,buy_order) VALUES($1,5000,'rechazado',$2,'orden-historica-token')",[anterior.id,token]);
     }
     let llamadas=0;
     const webpay={async create(){
      llamadas++;
      if(modo==='timeout')return new Promise(()=>{});
      if(modo==='incompleto')return {token};
      return {token,url:'https://webpay.example/checkout'};
     }};
     const resultado=await crearInicioWebpay({pool,webpay,plazoMs:25})({token:r.token},retorno);
     assert.equal(resultado.codigo,502);
     assert.equal(resultado.cuerpo.url,undefined);
     const [a]=await buscar(r.id);
     assert.equal(a.estado,'pendiente');
     assert.equal(a.fase_webpay,'resultado_incierto');
     assert.equal(a.token_transaccion,null);
     assert.equal((await crearInicioWebpay({pool,webpay})({token:r.token},retorno)).codigo,409);
     assert.equal(llamadas,1);
    }
   });
  });
  await t.test('Procesamiento durable de retorno y recuperación',async t=>{
   const {randomBytes,randomUUID}=require('node:crypto');
   const {crearProcesamientoWebpay}=require('../procesamiento-webpay');
   let dia=0;
   async function nueva(conToken=true){
    const token=conToken?randomBytes(32).toString('hex'):null;
    const tokenConsulta=randomUUID();
    const orden='PROC-'+String(++dia);
    const r=(await pool.query(`
      INSERT INTO reserva(id_emprendimiento,id_servicio,id_trabajadora,id_clienta,fecha_hora_inicio,fecha_hora_fin,estado,precio_servicio,monto_abono,token_consulta)
      SELECT id_emprendimiento,id_servicio,id_trabajadora,id_clienta,
        TIMESTAMP '2033-01-01 10:00'+$1::int*INTERVAL '1 day',
        TIMESTAMP '2033-01-01 11:00'+$1::int*INTERVAL '1 day',
        'pendiente_abono',precio_servicio,5000,$2 FROM reserva WHERE id_reserva=1 RETURNING id_reserva
    `,[dia,tokenConsulta])).rows[0];
    const a=(await pool.query('INSERT INTO abono(id_reserva,monto,token_transaccion,buy_order) VALUES($1,5000,$2,$3) RETURNING id_abono',[r.id_reserva,token,orden])).rows[0];
    return {...r,...a,token,orden,tokenConsulta};
   }
   const aprobado=a=>({status:'AUTHORIZED',response_code:0,authorization_code:'SIMULADO',amount:5000,buy_order:a.orden});
   const retorno=a=>request(app).post('/api/abonos/retorno').send({token_ws:a.token});
   const recuperar=a=>agent.post('/api/abonos/'+a.id_abono+'/recuperar');
   const fila=async a=>(await pool.query('SELECT * FROM abono WHERE id_abono=$1',[a.id_abono])).rows[0];
   await t.test('La ruta visual redirige con GET o POST sin depender de las cabeceras',async()=>{
    const correos=enviados, consultas=consultasWebpay;
    const leer=ref=>request(app).get('/api/abonos/resultado').set('X-Meraki-Resultado',ref);
    const ref=r=>{
     assert.equal(r.text,'');
     assert.equal(r.headers['cache-control'],'no-store');
     assert.equal(r.headers['referrer-policy'],'no-referrer');
     assert.match(r.headers.location,/^\/consulta\/resultado\.html#[A-Za-z0-9_-]+$/);
     return r.headers.location.split('#')[1];
    };
    let llamadas=0;
    for(const [i,estado] of ['aprobado','rechazado','abandonado','incierto','conexion','pendiente'].entries()){
     const a=await nueva();
     await pool.query('DELETE FROM abono WHERE id_abono=$1',[a.id_abono]);
     let urlEnviada;
     alCrearWebpay=async (_orden,_sesion,_monto,url)=>{urlEnviada=url;};
     let inicio;
     try{inicio=(await request(app).post('/api/abonos/cliente/iniciar').send({
      token_consulta:a.tokenConsulta,returnUrl:'https://no-usar.example/'
     }).expect(201)).body;}finally{alCrearWebpay=null;}
     const configurada=new URL(process.env.WEBPAY_RETURN_URL);
     assert.equal(urlEnviada,configurada.origin+'/api/abonos/retorno/navegador'+configurada.search);
     assert.match(inicio.correlacion,/^[A-Za-z0-9_-]{43}$/);
     const anterior=llamadas;
     const pagar=async()=>{llamadas++;
      if(estado==='conexion')throw Object.assign(Error('Simulado'),{code:'ECONNRESET'});
      return {...status,
       status:estado==='rechazado'?'FAILED':'AUTHORIZED',
       response_code:estado==='rechazado'?-1:0,
       amount:estado==='incierto'?1:status.amount};
     };
     alConfirmarWebpay=pagar;
     try{
      const ruta='/api/abonos/retorno/navegador';
      if(estado==='pendiente')await pool.query(`
       UPDATE abono SET operacion_webpay=$2,tipo_operacion_webpay='commit',estado_proceso_webpay='en_proceso',
        fecha_operacion_webpay=clock_timestamp(),commit_webpay_reclamado_en=clock_timestamp()
       WHERE id_abono=$1
      `,[inicio.id_abono,randomUUID()]);
      const datos=estado==='abandonado'?{TBK_TOKEN:inicio.token}:{token_ws:inicio.token};
      const ejecutar=()=>{
       const r=i%2?request(app).post(ruta).type('form').send(datos):request(app).get(ruta).query(datos);
       if(i<4)r.set('Accept',i<2?'text/html':'*/*');
       if(i===2)r.set('Sec-Fetch-Mode','navigate');
       if(i===3)r.set('Sec-Fetch-Dest','empty');
       return r;
      };
      const referencia=ref(await ejecutar().expect(303));
      for(const secreto of [inicio.token,a.tokenConsulta,inicio.correlacion])assert(!referencia.includes(secreto));
      for(let j=0;j<2;j++){
       const lectura=await leer(referencia).expect(200);
       assert.deepEqual(lectura.body,{estado,correlacion:inicio.correlacion});
      }
      await leer((referencia[0]==='A'?'B':'A')+referencia.slice(1)).expect(404);
      await ejecutar().expect(303);
      assert.equal(llamadas,anterior+(['abandonado','pendiente'].includes(estado)?0:1));
      const filas=await pool.query('SELECT count(*)::int AS n FROM abono WHERE id_reserva=$1',[a.id_reserva]);
      assert.equal(filas.rows[0].n,1);
      const avisos=await pool.query('SELECT count(*)::int AS n FROM notificacion_correo WHERE id_reserva=$1',[a.id_reserva]);
      assert.equal(avisos.rows[0].n,estado==='aprobado'?1:0);
      if(estado==='pendiente'){
       await pool.query("UPDATE abono SET estado='rechazado',estado_proceso_webpay='resuelto' WHERE id_abono=$1",[inicio.id_abono]);
       assert.equal((await leer(referencia).expect(200)).body.estado,'rechazado');
      }
     }finally{alConfirmarWebpay=null;}
    }
    assert.equal(enviados,correos+1);
    assert.equal(consultasWebpay,consultas);
    const anonimo=ref(await request(app).get('/api/abonos/retorno/navegador').query({TBK_ORDEN_COMPRA:'SIN-SESION'}).expect(303));
    assert.deepEqual((await leer(anonimo).expect(200)).body,{estado:'abandonado'});
    await request(app).get('/api/abonos/resultado').expect(404);
   });
   await t.test('La ruta heredada conserva JSON y Back Office conserva su URL configurada',async()=>{
    let llamadas=0;
    for(const metodo of ['get','post']){
     const a=await nueva();
     if(metodo==='post'){
      await pool.query('DELETE FROM abono WHERE id_abono=$1',[a.id_abono]);
      let urlEnviada;
      alCrearWebpay=async (_orden,_sesion,_monto,url)=>{urlEnviada=url;};
      let inicio;
      try{inicio=(await agent.post('/api/abonos/iniciar').send({id_reserva:a.id_reserva}).expect(201)).body;}
      finally{alCrearWebpay=null;}
      assert.equal(urlEnviada,process.env.WEBPAY_RETURN_URL);
      a.token=inicio.token;a.orden=status.buy_order;
     }
     alConfirmarWebpay=async()=>{llamadas++;return {...aprobado(a),status:'FAILED',response_code:-1};};
     try{
      const retorno=()=>{
       const r=request(app)[metodo]('/api/abonos/retorno').set('Accept','text/html').set('Sec-Fetch-Mode','navigate');
       return metodo==='get'?r.query({token_ws:a.token}):r.type('form').send({token_ws:a.token});
      };
      const r=await retorno().expect(200).expect('Content-Type',/json/);
      assert.equal(r.body.estado_abono,'rechazado');
      await retorno().expect(409).expect('Content-Type',/json/);
     }finally{alConfirmarWebpay=null;}
    }
    assert.equal(llamadas,2);
   });
   await t.test('Consulta privada calcula el permiso de pago con evidencia local y sin devolver identificadores del abono',async()=>{
    const inicial=transaccionesCreadas;
    const consultasIniciales=consultasWebpay;
    for(const [caso,esperado,permite] of [
     ['confirmada','confirmado',false],['aprobado','confirmado',false],
     ['sin_abono','disponible',true],['rechazado','rechazado',true],
     ['historico','en_revision',false],['pendiente','en_revision',false],
     ['incierto','en_revision',false],['abandono','en_revision',false]
    ]){
     const a=await nueva();
     if(caso==='confirmada')await pool.query("UPDATE reserva SET estado='confirmada' WHERE id_reserva=$1",[a.id_reserva]);
     if(caso==='sin_abono')await pool.query('DELETE FROM abono WHERE id_abono=$1',[a.id_abono]);
     if(caso==='aprobado')await pool.query("UPDATE abono SET estado='aprobado' WHERE id_abono=$1",[a.id_abono]);
     if(caso==='historico')await pool.query("UPDATE abono SET estado='rechazado' WHERE id_abono=$1",[a.id_abono]);
     if(['rechazado','incierto'].includes(caso))await pool.query(`
      UPDATE abono SET estado=$2,operacion_webpay=$3,tipo_operacion_webpay='status',
       estado_proceso_webpay=$4,fecha_operacion_webpay=clock_timestamp() WHERE id_abono=$1
     `,[a.id_abono,caso==='rechazado'?'rechazado':'pendiente',randomUUID(),caso==='rechazado'?'resuelto':'incierto']);
     if(caso==='abandono')await request(app).post('/api/abonos/retorno').send({TBK_TOKEN:a.token}).expect(200);
     const r=await request(app).get('/api/reservas/consulta/'+a.tokenConsulta).expect(200);
     assert.equal(r.body.pago.estado,esperado,caso);
     assert.equal(r.body.pago.puede_iniciar,permite,caso);
     assert.equal(r.body.reserva.id_reserva,a.id_reserva);
     assert.equal(r.headers['cache-control'],'no-store');
     for(const secreto of [a.token,a.tokenConsulta,a.orden,'id_abono','monto_abono'])assert(!r.text.includes(secreto),caso);
    }
    assert.equal(transaccionesCreadas,inicial);
    assert.equal(consultasWebpay,consultasIniciales);
   });
   async function comprobarPendiente(a, correos){
    assert.equal((await fila(a)).estado,'pendiente');
    const reserva=(await pool.query('SELECT estado FROM reserva WHERE id_reserva=$1',[a.id_reserva])).rows[0];
    assert.equal(reserva.estado,'pendiente_abono');
    const avisos=await pool.query('SELECT 1 FROM notificacion_correo WHERE id_reserva=$1',[a.id_reserva]);
    assert.equal(avisos.rowCount,0);
    assert.equal(enviados,correos);
   }
   async function comprobarBloqueoDeInicio(a){
    const inicial=transaccionesCreadas;
    await agent.post('/api/abonos/iniciar').send({id_reserva:a.id_reserva}).expect(409);
    await request(app).post('/api/abonos/cliente/iniciar').send({token_consulta:a.tokenConsulta}).expect(409);
    assert.equal(transaccionesCreadas,inicial);
    const intentos=await pool.query('SELECT id_abono FROM abono WHERE id_reserva=$1',[a.id_reserva]);
    assert.deepEqual(intentos.rows,[{id_abono:a.id_abono}]);
   }
   for(const [nombre,metodo,parametros] of [
    ['Abandono con TBK_TOKEN','post',a=>({TBK_TOKEN:a.token})],
    ['Abandono con TBK_ORDEN_COMPRA y TBK_ID_SESION','get',a=>({TBK_ORDEN_COMPRA:a.orden,TBK_ID_SESION:'SESION-FICTICIA'})]
   ]){
    await t.test(nombre+' deja el pago pendiente sin llamar a commit',async()=>{
     const a=await nueva(), antes=await fila(a), correos=enviados;
     let llamadas=0;
     alConfirmarWebpay=async()=>{llamadas++;return aprobado(a);};
     try{
      const solicitud=request(app)[metodo]('/api/abonos/retorno');
      const r=await (metodo==='get'?solicitud.query(parametros(a)):solicitud.send(parametros(a))).expect(200);
      assert.equal(r.body.estado,'requiere_verificacion');
      assert.match(r.body.mensaje,/consulta su estado/i);
      assert.equal(llamadas,0);
      assert.deepEqual(await fila(a),antes);
      await comprobarBloqueoDeInicio(a);
      await comprobarPendiente(a,correos);
     }finally{alConfirmarWebpay=null;}
    });
   }
   await t.test('ECONNRESET en commit bloquea reintentos y solo permite revisión autorizada',async()=>{
    const a=await nueva(), correos=enviados, estadoAnterior=status;
    let llamadas=0;
    alConfirmarWebpay=async()=>{
     llamadas++;
     throw Object.assign(new Error('Conexión reiniciada simulada'),{code:'ECONNRESET'});
    };
    try{
     const respuesta=await retorno(a).expect(502);
     assert.match(respuesta.body.mensaje,/requiere revisión/i);
     const incierto=await fila(a);
     assert.equal(incierto.estado_proceso_webpay,'incierto');
     assert.ok(incierto.commit_webpay_reclamado_en);
     await retorno(a).expect(409);
     assert.equal(llamadas,1);
     assert.deepEqual(await fila(a),incierto);
     await comprobarBloqueoDeInicio(a);
     await request(app).post('/api/abonos/'+a.id_abono+'/recuperar').expect(401);
     const local=(await agent.get('/api/abonos/'+a.id_abono+'/estado').expect(200)).body;
     assert.equal(local.puede_recuperar,false);
     assert.equal(local.puede_reconciliar,true);
     assert.deepEqual(await fila(a),incierto);
     status={...aprobado(a),status:'INITIALIZED'};
     const revision=await recuperar(a).expect(200);
     assert.equal(revision.body.estado_transbank,'INITIALIZED');
     assert.equal((await fila(a)).tipo_operacion_webpay,'status');
     assert.equal((await fila(a)).estado_proceso_webpay,'incierto');
     assert.equal(llamadas,1);
     await comprobarBloqueoDeInicio(a);
     await comprobarPendiente(a,correos);
    }finally{alConfirmarWebpay=null;status=estadoAnterior;}
   });
   await t.test('Inicio desde Back Office con reserva inexistente devuelve 404 sin efectos',async()=>{
    const capturar=async()=>(await pool.query(`
     SELECT (SELECT jsonb_agg(to_jsonb(r) ORDER BY id_reserva) FROM reserva r) AS reservas,
            (SELECT jsonb_agg(to_jsonb(a) ORDER BY id_abono) FROM abono a) AS abonos
    `)).rows[0];
    const antes=await capturar(), inicial=transaccionesCreadas, correos=enviados;
    const id=Math.max(...antes.reservas.map(r=>r.id_reserva))+1;
    const r=await agent.post('/api/abonos/iniciar').send({id_reserva:id}).expect(404);
    assert.equal(r.body.mensaje,'No se encontró la reserva');
    assert.equal(transaccionesCreadas,inicial);
    assert.equal(enviados,correos);
    assert.deepEqual(await capturar(),antes);
   });
   await t.test('Ambas rutas bloquean una reserva con abono aprobado',async()=>{
    const a=await nueva(), correos=enviados;
    // La reserva aún pendiente aísla la protección del abono aprobado de la validación de estado de reserva.
    await pool.query("UPDATE abono SET estado='aprobado',fecha_pago=CURRENT_TIMESTAMP WHERE id_abono=$1",[a.id_abono]);
    const reserva=async()=>(await pool.query('SELECT * FROM reserva WHERE id_reserva=$1',[a.id_reserva])).rows[0];
    const antes=await fila(a), reservaAntes=await reserva();
    await comprobarBloqueoDeInicio(a);
    assert.deepEqual(await fila(a),antes);
    assert.deepEqual(await reserva(),reservaAntes);
    assert.equal(enviados,correos);
   });
   await t.test('Interrupción después de confirmar el pago deja un solo correo pendiente',async()=>{
    const a=await nueva(), correos=enviados;
    let llamadas=0, observacion;
    async function leer(db){
     return (await db.query(`
      SELECT a.estado AS abono,r.estado AS reserva,
       (SELECT array_agg(n.estado ORDER BY n.id_notificacion) FROM notificacion_correo n WHERE n.id_reserva=r.id_reserva) AS avisos,
       (SELECT count(*)::int FROM abono otro WHERE otro.id_reserva=r.id_reserva) AS intentos
      FROM abono a JOIN reserva r USING(id_reserva) WHERE a.id_abono=$1
     `,[a.id_abono])).rows[0];
    }
    const notificaciones=crearNotificaciones(pool,enviar);
    const dependencias={
     pool,registrar:notificaciones.registrar,
     webpay:{commit:async()=>{llamadas++;return aprobado(a);}},
     async notificar(){
      // El procesador llama este gancho después de finalizar. Otro pool comprueba
      // que PostgreSQL ya hizo visible el resultado antes de interrumpir el envío.
      const otro=new Pool({...config,options:'-c search_path='+schema});
      try{observacion=await leer(otro);}finally{await otro.end();}
      throw Error('Interrupción simulada antes del envío');
     }
    };
    const acceso={tipo:'commit',token:a.token};
    const resultado=await crearProcesamientoWebpay(dependencias).procesar(acceso);
    assert.equal(resultado.codigo,200);
    const esperado={abono:'aprobado',reserva:'confirmada',avisos:['pendiente'],intentos:1};
    assert.deepEqual(observacion,esperado);
    assert.equal((await crearProcesamientoWebpay(dependencias).procesar(acceso)).codigo,409);
    assert.deepEqual(await leer(pool),esperado);
    assert.equal(llamadas,1);
    assert.equal(enviados,correos);
   });
   await t.test('GET, POST y recuperación concurrentes realizan un solo commit sin retener bloqueos',async()=>{
    const a=await nueva();
    let llamadas=0, confirmarEntrada, soltar;
    const entrada=new Promise(r=>confirmarEntrada=r);
    const espera=new Promise(r=>soltar=r);
    const correos=enviados;
    alConfirmarWebpay=async()=>{llamadas++;confirmarEntrada();await espera;return aprobado(a);};
    const primero=request(app).get('/api/abonos/retorno').query({token_ws:a.token}).then(r=>r);
    try{
     await Promise.race([entrada,primero.then(r=>{throw Error('El proveedor no fue llamado: '+r.status);})]);
     const f=await fila(a);
     assert.equal(f.fase_webpay,null);assert(f.commit_webpay_reclamado_en);
     assert.equal(f.estado_proceso_webpay,'en_proceso');
     const otro=await pool.connect();
     try{
      await otro.query('BEGIN');
      await otro.query('SELECT id_reserva FROM reserva WHERE id_reserva=$1 FOR UPDATE NOWAIT',[a.id_reserva]);
      await otro.query('SELECT id_abono FROM abono WHERE id_abono=$1 FOR UPDATE NOWAIT',[a.id_abono]);
     }finally{await otro.query('ROLLBACK');otro.release();}
     await Promise.all([retorno(a).expect(409),recuperar(a).expect(409)]);
     const local=(await agent.get('/api/abonos/'+a.id_abono+'/estado').expect(200)).body;
     assert.equal(local.estado_proceso_webpay,'en_proceso');
     assert.equal(local.puede_recuperar,false);
    }finally{soltar();await primero;alConfirmarWebpay=null;}
    assert.equal((await primero).status,200);
    assert.equal(llamadas,1);
    await retorno(a).expect(409);
    assert.equal((await fila(a)).estado,'aprobado');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM notificacion_correo WHERE id_reserva=$1',[a.id_reserva])).rows[0].n,1);
    assert.equal(enviados,correos+1);
   });
   await t.test('Rechazo requiere monto y orden coincidentes; token inválido o ausente no consulta Webpay',async()=>{
    for(const diferencia of [{buy_order:'otra-orden'},{amount:1},{}]){
     const a=await nueva();
     alConfirmarWebpay=async()=>({...aprobado(a),status:'FAILED',response_code:-1,...diferencia});
     try{await retorno(a).expect(Object.keys(diferencia).length?409:200);}finally{alConfirmarWebpay=null;}
     assert.equal((await fila(a)).estado,Object.keys(diferencia).length?'pendiente':'rechazado');
    }
    const a=await nueva(false);
    await retorno({token:'inválido'}).expect(400);
    await request(app).post('/api/abonos/'+a.id_abono+'/recuperar').expect(401);
    await recuperar(a).expect(409);
    const local=(await agent.get('/api/abonos/'+a.id_abono+'/estado').expect(200)).body;
    assert.equal(local.revision_manual,true);assert.equal(local.puede_reconciliar,false);
   });
   await t.test('Respuesta perdida del COMMIT local no llama al proveedor, ni después de reiniciar',async()=>{
    const a=await nueva();
    const conexion={query:pool.query.bind(pool),async connect(){
     const db=await pool.connect();
     return {release:error=>db.release(error),async query(sql,args){
      const r=await db.query(sql,args);
      if(sql==='COMMIT')throw Error('Respuesta local perdida');
      return r;
     }};
    }};
    let llamadas=0;
    const webpay={commit:async()=>{llamadas++;return aprobado(a);}};
    const params={pool:conexion,webpay,registrar:async()=>{},notificar:async()=>{}};
    const acceso={tipo:'commit',token:a.token};
    assert.equal((await crearProcesamientoWebpay(params).procesar(acceso)).codigo,502);
    assert((await fila(a)).commit_webpay_reclamado_en);
    assert.equal((await crearProcesamientoWebpay({...params,pool}).procesar(acceso)).codigo,409);
    assert.equal(llamadas,0);
   });
   await t.test('Timeout, reinicio y respuesta tardía preservan la revisión hasta reconciliar explícitamente',async()=>{
    const a=await nueva();
    let tardia, llamadas=0;
    const webpay={commit:()=>{llamadas++;return new Promise(r=>tardia=r);},
     status:async()=>({...aprobado(a),status:'INITIALIZED'})};
    const params={pool,webpay,registrar:async()=>{},notificar:async()=>{},plazoMs:25};
    const acceso={tipo:'commit',token:a.token};
    assert.equal((await crearProcesamientoWebpay(params).procesar(acceso)).codigo,502);
    assert.equal((await fila(a)).estado_proceso_webpay,'incierto');
    assert.equal((await crearProcesamientoWebpay(params).procesar(acceso)).codigo,409);
    tardia(aprobado(a));
    const revision={tipo:'status',id:a.id_abono,propietaria:1};
    assert.equal((await crearProcesamientoWebpay(params).procesar(revision)).codigo,200);
    assert.equal((await fila(a)).estado,'pendiente');
    assert.equal((await fila(a)).estado_proceso_webpay,'incierto');
    status=aprobado(a);
    await recuperar(a).expect(200);
    assert.equal((await fila(a)).estado,'aprobado');
    assert.equal(llamadas,1);
   });
   await t.test('Una respuesta de un reclamo sustituido no puede revertir el resultado más reciente',async()=>{
    const a=await nueva();
    let entrar,soltar;
    const entrada=new Promise(r=>entrar=r);
    const espera=new Promise(r=>soltar=r);
    const webpay={
     commit:async()=>{entrar();await espera;return {...aprobado(a),status:'FAILED',response_code:-1};},
     status:async()=>aprobado(a)
    };
    const servicio=crearProcesamientoWebpay({pool,webpay,registrar:async()=>{},notificar:async()=>{}});
    const anterior=servicio.procesar({tipo:'commit',token:a.token});
    try{
     await Promise.race([entrada,anterior.then(r=>{throw Error('No se reclamó: '+r.codigo);})]);
     await pool.query("UPDATE abono SET fecha_operacion_webpay=clock_timestamp()-INTERVAL '2 minutes' WHERE id_abono=$1",[a.id_abono]);
     const actual=await servicio.procesar({tipo:'status',id:a.id_abono,propietaria:1});
     assert.equal(actual.codigo,200);
    }finally{soltar();await anterior;}
    assert.equal((await anterior).codigo,409);
    assert.equal((await fila(a)).estado,'aprobado');
   });
  });
  await t.test('Propietaria ajena no puede ver ni modificar notificación',async()=>{const r=await pool.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash) VALUES('Otra','Prueba','otro','otra@meraki.test',$1) RETURNING id_emprendedora",[await bcrypt.hash('clave-prueba',4)]);await pool.query('UPDATE emprendimiento SET id_emprendedora=$1 WHERE id_emprendimiento=1',[r.rows[0].id_emprendedora]);await agent.get('/api/notificaciones').expect(200,[]);await agent.get('/api/reservas?id_emprendimiento=1').expect(403);await agent.get('/api/abonos/1/estado').expect(404);await agent.post('/api/abonos/1/recuperar').expect(404);for(const accion of ['atender','no-atendida','cancelar'])await agent.patch('/api/reservas/1/'+accion).expect(404);await agent.post('/api/notificaciones/'+notificacionId+'/reintentar').set('X-Meraki-Action','1').send({evidencia:'Configuración revisada por operadora'}).expect(404);});
  await t.test('Consulta privada no expone token y no se almacena en caché',async()=>{const r=await request(app).get('/api/reservas/consulta/11111111-1111-4111-8111-111111111111').expect(200);assert.equal(r.headers['cache-control'],'no-store');assert(!JSON.stringify(r.body).includes('11111111'));await request(app).get('/consulta/').expect(200);await request(app).get('/front-office/').expect(200);await request(app).get('/back-office/').expect(200);});
  await t.test('Catálogo público combina categoría, nombre y comuna sin duplicar negocios',async()=>{
   const categoria=await pool.query("INSERT INTO categoria(nombre) VALUES('Categoría aislada catálogo') RETURNING id_categoria");
   const id=categoria.rows[0].id_categoria;
   const negocio=async(nombre,comuna,activo)=>{
    const cuenta=await pool.query(`INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash)
      VALUES($1,'Prueba',$2,$3,'hash simulado') RETURNING id_emprendedora`,[nombre,nombre,nombre+'@example.test']);
    const datos=await pool.query(`INSERT INTO emprendimiento(id_emprendedora,nombre,comuna,estado)
      VALUES($1,$2,$3,$4) RETURNING id_emprendimiento`,[cuenta.rows[0].id_emprendedora,nombre,comuna,activo]);
    return datos.rows[0].id_emprendimiento;
   };
   const norte=await negocio('Zeta Norte','Santiago',true);
   const sur=await negocio('Zeta Sur','Providencia',true);
   const inactivo=await negocio('Zeta Inactivo','Santiago',false);
   const sinActivos=await negocio('Zeta Sin activos','Santiago',true);
   await pool.query(`INSERT INTO servicio(id_emprendimiento,id_categoria,nombre,precio,duracion_min,monto_abono,activo)
     VALUES($1,$5,'Uno',10000,30,0,true),($1,$5,'Dos',10000,30,0,true),($2,$5,'Tres',10000,30,0,true),
           ($3,$5,'Cuatro',10000,30,0,true),($4,$5,'Cinco',10000,30,0,false)`,[norte,sur,inactivo,sinActivos,id]);
   const buscar=async filtros=>(await request(app).get('/api/emprendimientos').query(filtros).expect(200)).body.map(n=>n.id_emprendimiento);
   assert.deepEqual(await buscar({nombre:'Zeta'}),[norte,sinActivos,sur]);
   assert.deepEqual(await buscar({id_categoria:id}),[norte,sur]);
   assert.deepEqual(await buscar({id_categoria:id,nombre:'sur'}),[sur]);
   assert.deepEqual(await buscar({id_categoria:id,comuna:'santiago'}),[norte]);
   assert.deepEqual(await buscar({id_categoria:id,nombre:'Norte',comuna:'Santiago'}),[norte]);
   assert.deepEqual(await buscar({id_categoria:id,nombre:'Norte',comuna:'Providencia'}),[]);
   assert.deepEqual(await buscar({id_categoria:2147483647}),[]);
   for(const valor of ['', '0', '-1', '1.5', '1e2', '2147483648','1&id_categoria=2']){
    await request(app).get('/api/emprendimientos?id_categoria='+valor).expect(400);
   }
   const servicios=(await request(app).get('/api/emprendimientos/'+norte+'/servicios').expect(200)).body;
   assert.equal(servicios.length,2);
   assert.ok(servicios.every(s=>s.reservable===false));
  });
 }finally{
  if(pool)await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();
 }
});
