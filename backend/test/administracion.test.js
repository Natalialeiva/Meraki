const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),express=require('express'),session=require('express-session'),request=require('supertest'),bcrypt=require('bcrypt');
const {Pool}=require('pg');
const {montarAdministracion,normalizarCorreo}=require('../administracion');
const {argumentos,aprovisionar}=require('../scripts/administradoras.cjs');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const login=(a,correo='admin@example.test',password='Clave-ficticia-123')=>a.post('/api/admin/auth/login').set('X-Meraki-Action','1').send({correo,password});
test('Administración: correo, CLI sin contraseñas por argumentos y formato de fechas',()=>{
 assert.equal(normalizarCorreo('ADMIN@EXAMPLE.TEST'),'admin@example.test');assert.equal(normalizarCorreo('invalido'),null);
 assert.equal(argumentos(['crear','--correo','admin@example.test','--autorizar']).accion,'crear');
 for(const args of [[],['crear','--correo','admin@example.test'],['crear','--correo','admin@example.test','--autorizar','--password','secreto']])assert.throws(()=>argumentos(args));
 const {fecha,dinero}=require('../../frontend/admin/admin');assert.equal(fecha('2026-11-01 00:01:00'),'01-11-2026 00:01:00');assert.equal(fecha(null),'Sin registro');assert.match(dinero('9990'),/9.990/);
});
test('Paginación administrativa se oculta con una sola página y permite regresar desde una página vacía',()=>{
 const {paginacion}=require('../../frontend/admin/admin');
 for(const total of [0,1,50])assert.equal(paginacion(1,total).oculta,true);
 assert.equal(paginacion(1,51).oculta,false);assert.equal(paginacion(1,51).siguiente,false);
 assert.equal(paginacion(2,51).siguiente,true);assert.equal(paginacion(2,51).anterior,false);
 assert.equal(paginacion(2,0).oculta,false);assert.equal(paginacion(2,0).anterior,false);
});
test('Administración PostgreSQL y sesiones aisladas',{skip:process.env.MERAKI_DB_TEST!=='1'},async t=>{
 assert.match(process.env.DB_NAME||'',/^meraki_mvp_ejecucion_\d+_[a-f0-9]{8}$/);
 const cfg={host:process.env.DB_HOST,port:+process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD};
 const base=new Pool(cfg),schema='meraki_admin_'+Date.now();let pool;
 try{
  await base.query('CREATE SCHEMA '+schema);pool=new Pool({...cfg,options:'-c search_path='+schema+',public -c timezone=UTC'});
  for(const f of ['schema.sql','008_suscripcion_oneclick.sql','014_administradoras.sql'])await pool.query(fs.readFileSync(path.join(__dirname,'../../database',f),'utf8'));
  const hash=await bcrypt.hash('Clave-ficticia-123',4);
  await pool.query("INSERT INTO administradora(correo,password_hash,activa) VALUES('admin@example.test',$1,true),('inactiva@example.test',$1,false)",[hash]);
  for(let i=1;i<=5;i++){
   await pool.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash,estado) VALUES($1,'Ficticia',$2,$3,'HASH-PRIVADO',$4)",['Responsable '+i,'ADMIN-FIXTURE-'+i,'negocio'+i+'@example.test',i===5?'inactiva':'activa']);
   await pool.query('INSERT INTO emprendimiento(id_emprendedora,nombre) VALUES($1,$2)',[i,'Negocio '+i]);
  }
  for(const [id,estado,dias,prueba]of [[2,'prueba',10,true],[3,'activa',10,false],[4,'activa',-1,false],[5,'cancelada',10,true]]){
   await pool.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,monto_mensual,estado,acceso_hasta,fecha_fin_prueba) VALUES($1,CURRENT_DATE,9990,$2,(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date+$3::int,CASE WHEN $4::boolean THEN (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date+10 ELSE NULL END)",[id,estado,dias,prueba]);
  }
  const sub=(await pool.query('SELECT id_suscripcion FROM suscripcion WHERE id_emprendedora=3')).rows[0].id_suscripcion;
  // Simular duplicados históricos antes de garantías actuales, solo en este esquema temporal.
  await pool.query('DROP INDEX pago_suscripcion_periodo_aprobado');
  let intento=0;
  for(const [monto,estado,proceso,fecha,periodo]of [[9990,'aprobado','finalizado','2026-11-01 03:01:00','2026-11-01'],[9990,'aprobado','finalizado','2026-11-02 01:00:00','2026-11-01'],[3990,'aprobado','finalizado','2026-12-01 02:59:59',null],[9990,'aprobado','finalizado','2026-12-01 03:00:00','2026-12-01'],[9990,'rechazado','finalizado','2026-11-05',null],[9990,'pendiente','revision',null,null],[9990,'aprobado','revision','2026-11-06',null],[100,'aprobado','finalizado',null,null]]){
   await pool.query('INSERT INTO pago_suscripcion(id_suscripcion,monto,estado,proceso,fecha_pago,periodo_inicio,intento) VALUES($1,$2,$3,$4,$5,$6,$7)',[sub,monto,estado,proceso,fecha,periodo,++intento]);
  }
  await pool.query("INSERT INTO inscripcion_suscripcion(id_suscripcion,usuario_oneclick,token_hash,estado) VALUES($1,'USUARIO-PRIVADO','TOKEN-PRIVADO','completada')",[sub]);
  const app=express();app.use(express.json());const {store}=montarAdministracion(app,{pool,Store:session.MemoryStore});
  // Representa exclusivamente la sesión del Back Office: otra cookie y otro principal.
  app.use(session({name:'meraki.sid',secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false}));
  app.post('/fixture/emprendedora',(req,res)=>{req.session.idEmprendedora=1;res.json({ok:true});});
  app.get('/fixture/privado',(req,res)=>res.sendStatus(req.session.idEmprendedora?200:401));
  const agent=request.agent(app);
  await t.test('Página privada, API sin sesión y cookies manipuladas',async()=>{
   await request(app).get('/admin/').expect(303).expect('Location','/admin/login');await request(app).get('/admin/index.html').expect(303);
   await request(app).get('/api/admin/emprendimientos').expect(401);await request(app).get('/api/admin/resumen').set('Cookie','meraki.admin.sid=1; rol=admin; idAdministradora=1').expect(401);
   await request(app).get('/admin/login').expect(200);await request(app).get('/admin/admin.css').expect(200);
  });
  await t.test('Login inválido, administradora inactiva, CSRF y elevación por parámetros',async()=>{
   await login(request(app),'admin@example.test','incorrecta').expect(401);await login(request(app),'inactiva@example.test').expect(401);await login(request(app),'ausente@example.test').expect(401);
   await request(app).post('/api/admin/auth/login').send({correo:'admin@example.test',password:'Clave-ficticia-123'}).expect(403);
   await request(app).post('/api/admin/auth/login').set('X-Meraki-Action','1').set('Origin','https://otro.example').send({correo:'admin@example.test',password:'Clave-ficticia-123'}).expect(403);
   await request(app).post('/api/admin/auth/login').set('X-Meraki-Action','1').send({correo:'admin@example.test',password:'Clave-ficticia-123',rol:'admin'}).expect(401);
  });
  await t.test('Sesiones separadas y acceso de emprendedora denegado',async()=>{
   const otra=request.agent(app);await otra.post('/fixture/emprendedora').expect(200);await otra.get('/api/admin/emprendimientos').expect(401);
   await login(agent).expect(200);await agent.get('/fixture/privado').expect(401);await agent.get('/admin/').expect(200);
   await login(otra).expect(200);await otra.get('/fixture/privado').expect(200);await otra.post('/api/admin/auth/logout').set('X-Meraki-Action','1').expect(200);await otra.get('/fixture/privado').expect(200);await otra.get('/api/admin/emprendimientos').expect(401);
  });
  await t.test('Listado completo, sin suscripción, gratuito, pagado, vencido y cancelado con acceso',async()=>{
   const d=(await agent.get('/api/admin/emprendimientos').expect(200)).body;assert.equal(d.total,5);assert.equal(new Set(d.emprendimientos.map(x=>x.id_emprendimiento)).size,5);
   assert.deepEqual(d.emprendimientos.map(x=>x.periodo),['sin_suscripcion','gratuito','activa','vencida','gratuito']);
   assert.equal(d.emprendimientos[4].estado_cuenta,'inactiva');assert.equal(d.emprendimientos[4].estado_suscripcion,'cancelada');assert.equal(d.emprendimientos[4].acceso_vigente,true);
   assert(!/HASH-PRIVADO|password_hash|USUARIO-PRIVADO|TOKEN-PRIVADO|tarjeta_cifrada/.test(JSON.stringify(d)));
  });
  await t.test('Búsqueda literal, filtros separados, vacío y parámetros inválidos',async()=>{
   assert.equal((await agent.get('/api/admin/emprendimientos?q=Negocio%202').expect(200)).body.total,1);
   for(const estado of ['sin_suscripcion','activa','vencida','cancelada'])assert.equal((await agent.get('/api/admin/emprendimientos?estado='+estado).expect(200)).body.total,1);
   assert.equal((await agent.get('/api/admin/emprendimientos?cuenta=inactiva').expect(200)).body.total,1);
   assert.equal((await agent.get('/api/admin/emprendimientos?q=%27%20OR%201%3D1').expect(200)).body.total,0);
   await agent.get('/api/admin/emprendimientos?estado=otro').expect(400);await agent.get('/api/admin/emprendimientos?pagina=-1').expect(400);
  });
  await t.test('La búsqueda usa nombres y no coincide únicamente por ID o correo',async()=>{
   const anterior=(await pool.query('SELECT a.nombre AS responsable,e.nombre AS negocio FROM emprendedora a JOIN emprendimiento e USING(id_emprendedora) WHERE e.id_emprendimiento=5')).rows[0];
   try{
    await pool.query("UPDATE emprendedora SET nombre='Responsable sin número' WHERE id_emprendedora=5");
    await pool.query("UPDATE emprendimiento SET nombre='Estudio sin número' WHERE id_emprendimiento=5");
    assert.equal((await agent.get('/api/admin/emprendimientos?q=5').expect(200)).body.total,0);
    assert.equal((await agent.get('/api/admin/emprendimientos?q=Estudio%20sin').expect(200)).body.total,1);
    assert.equal((await agent.get('/api/admin/emprendimientos?q=Responsable%20sin').expect(200)).body.total,1);
   }finally{await pool.query('UPDATE emprendedora SET nombre=$1 WHERE id_emprendedora=5',[anterior.responsable]);await pool.query('UPDATE emprendimiento SET nombre=$1 WHERE id_emprendimiento=5',[anterior.negocio]);}
  });
  await t.test('Ingresos mensuales, límite civil de Santiago, duplicados y estados excluidos',async()=>{
   const d=(await agent.get('/api/admin/resumen?mes=2026-11').expect(200)).body;
   assert.equal(Number(d.mensual_registrado),13980);assert.equal(Number(d.total_registrado),24070);assert.equal(d.duplicados_excluidos,1);assert.equal(d.aprobados_sin_fecha,1);assert.equal(d.zona_horaria,'America/Santiago');
   assert.equal(Number((await agent.get('/api/admin/resumen?mes=2026-12').expect(200)).body.mensual_registrado),9990);
   assert.equal(Number((await agent.get('/api/admin/resumen?mes=2025-01').expect(200)).body.mensual_registrado),0);await agent.get('/api/admin/resumen?mes=2026-13').expect(400);
  });
  await t.test('Detalle e historial sin secretos y sin mezclar los abonos de reservas',async()=>{
   const d=(await agent.get('/api/admin/emprendimientos/3').expect(200)).body;assert.equal(d.cobros.length,8);assert.equal(d.emprendimiento.estado_inscripcion,'completada');
   assert(!/password_hash|token|usuario_oneclick|codigo_autorizacion|tarjeta_cifrada/.test(JSON.stringify(d)));
   assert.deepEqual((await agent.get('/api/admin/emprendimientos/1').expect(200)).body.cobros,[]);await agent.get('/api/admin/emprendimientos/999').expect(404);await agent.get('/api/admin/emprendimientos/x').expect(400);
   // Cobro de reserva muy superior: nunca debe entrar en la suma de mensualidades.
   await pool.query("INSERT INTO categoria(nombre) VALUES('Fixture')");await pool.query("INSERT INTO servicio(id_emprendimiento,id_categoria,nombre,precio,duracion_min,monto_abono) VALUES(1,1,'Fixture',1000000,60,500000)");
   await pool.query("INSERT INTO trabajadora(id_emprendimiento,nombre) VALUES(1,'Fixture')");await pool.query("INSERT INTO clienta(nombre,correo) VALUES('Fixture','fixture@example.test')");
   await pool.query("INSERT INTO reserva(id_emprendimiento,id_servicio,id_trabajadora,id_clienta,fecha_hora_inicio,fecha_hora_fin,precio_servicio,monto_abono) VALUES(1,1,1,1,'2030-01-01 10:00','2030-01-01 11:00',1000000,500000)");
   await pool.query("INSERT INTO abono(id_reserva,monto,estado) VALUES(1,500000,'aprobado')");assert.equal(Number((await agent.get('/api/admin/resumen?mes=2026-11').expect(200)).body.mensual_registrado),13980);
  });
  await t.test('Sesión vencida rechazada y regeneración del identificador al ingresar',async()=>{
   const vencida=request.agent(app);const r=await login(vencida).expect(200);
   const cookie=r.headers['set-cookie'].find(x=>x.startsWith('meraki.admin.sid='));assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
   const sid=decodeURIComponent(cookie.split(';')[0].split('=').slice(1).join('=')).slice(2).split('.')[0];
   const s=await new Promise((resolve,reject)=>store.get(sid,(e,v)=>e?reject(e):resolve(v)));
   s.cookie.expires=new Date(Date.now()-1000);await new Promise((resolve,reject)=>store.set(sid,s,e=>e?reject(e):resolve()));
   await vencida.get('/api/admin/resumen').expect(401);
   const renovada=await login(vencida).expect(200);assert.notEqual(renovada.headers['set-cookie'][0],cookie);
  });
  await t.test('Gestión comercial de solo lectura e invalidación inmediata por inactividad',async()=>{
   const antes=(await pool.query('SELECT row_to_json(s) AS fila FROM suscripcion s ORDER BY id_suscripcion')).rows;
   for(const metodo of ['post','patch','delete'])await agent[metodo]('/api/admin/emprendimientos/1').set('X-Meraki-Action','1').send({estado:'inactiva'}).expect(405);
   await agent.get('/api/admin/emprendimientos').expect(200);assert.deepEqual((await pool.query('SELECT row_to_json(s) AS fila FROM suscripcion s ORDER BY id_suscripcion')).rows,antes);
   await pool.query("UPDATE administradora SET activa=false WHERE correo='admin@example.test'");await agent.get('/api/admin/auth/yo').expect(401);await agent.get('/api/admin/resumen').expect(401);
  });
  await t.test('Límite de intentos repetidos y caducidad del límite',async()=>{
   let reloj=0;const limitada=express();limitada.use(express.json());montarAdministracion(limitada,{pool,Store:session.MemoryStore,limites:{ip:2,cuenta:2},ahora:()=>reloj});
   await login(request(limitada),'no@example.test','x').expect(401);await login(request(limitada),'no@example.test','x').expect(401);await login(request(limitada),'no@example.test','x').expect(429).expect('Retry-After','900');reloj=900001;await login(request(limitada),'no@example.test','x').expect(401);
  });
  await t.test('Aprovisionamiento explícito, unicidad y transferencia sin hashes manuales',async()=>{
   const nueva=await aprovisionar(pool,{accion:'crear',correo:'propietaria@example.test',password:'Otra-clave-ficticia-123'});assert.equal(nueva.activa,true);
   await assert.rejects(aprovisionar(pool,{accion:'crear',correo:'propietaria@example.test',password:'Otra-clave-ficticia-123'}));
   await assert.rejects(aprovisionar(pool,{accion:'desactivar',correo:'propietaria@example.test'}),/última/);
   await aprovisionar(pool,{accion:'crear',correo:'sucesora@example.test',password:'Otra-clave-ficticia-456'});
   await aprovisionar(pool,{accion:'desactivar',correo:'propietaria@example.test'});await login(request(app),'propietaria@example.test','Otra-clave-ficticia-123').expect(401);
  });
 }finally{if(pool)await pool.end();await base.query('DROP SCHEMA '+schema+' CASCADE');await base.end();}
});
