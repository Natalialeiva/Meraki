const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const express=require('express'),session=require('express-session'),request=require('supertest'),bcrypt=require('bcrypt'),{Pool}=require('pg');
const {montarAdministracion}=require('../administracion'),{cancelar}=require('../admin-gestion');
const {crearSuscripciones}=require('../suscripciones'),{cifrar}=require('../suscripcion-plan');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
test('Gestión administrativa aislada: permisos, auditoría y cancelación sin proveedores',{skip:process.env.MERAKI_DB_TEST!=='1',timeout:120000},async t=>{
 assert.match(process.env.DB_NAME||'',/^meraki_mvp_ejecucion_\d+_[a-f0-9]{8}$/);
 const cfg={host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME};
 const base=new Pool(cfg),schema='meraki_admin_gestion_'+Date.now();let pool;
 try{
  await base.query('CREATE SCHEMA '+schema);pool=new Pool({...cfg,options:'-c search_path='+schema+',public -c timezone=UTC'});
  for(const f of ['schema.sql','008_suscripcion_oneclick.sql','014_administradoras.sql','015_auditoria_administrativa.sql'])await pool.query(fs.readFileSync(path.join(__dirname,'../../database',f),'utf8'));
  const h=await bcrypt.hash('Adriana-fixture-123',4),hn=await bcrypt.hash('Natalia-fixture-456',4);
  await pool.query("INSERT INTO administradora(correo,password_hash) VALUES('adriana@example.test',$1),('natalia@example.test',$2)",[h,hn]);
  for(let n=1;n<=6;n++){
   await pool.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash) VALUES($1,'Fixture',$2,$3,'HASH-NO-PUBLICAR')",['Cuenta '+n,'ADMIN-GESTION-'+n,'cuenta'+n+'@example.test']);
   if(n!==6)await pool.query("INSERT INTO emprendimiento(id_emprendedora,nombre) VALUES($1,$2)",[n,'Estudio '+n]);
  }
  for(const [n,estado,vigencia,prueba]of [[1,'prueba',20,true],[2,'activa',-2,false],[3,'activa',20,false],[4,'activa',20,false],[5,'cancelada',20,false]]){
   await pool.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,acceso_hasta,fecha_fin_prueba,fecha_proximo_cobro,monto_mensual,estado,renovacion_automatica,tarjeta_cifrada,usuario_oneclick) VALUES($1,CURRENT_DATE-30,CURRENT_DATE+$2::int,CASE WHEN $3 THEN CURRENT_DATE+20 ELSE CURRENT_DATE-1 END,CURRENT_DATE-1,9990,$4,TRUE,$5,'USUARIO-SECRETO')",[n,vigencia,prueba,estado,cifrar('TOKEN-SECRETO',process.env.SESSION_SECRET)]);
  }
  await pool.query("INSERT INTO pago_suscripcion(id_suscripcion,monto,estado,proceso,codigo_respuesta,codigo_autorizacion,fecha_pago) VALUES(3,9990,'rechazado','finalizado',-1,NULL,NULL),(4,9990,'aprobado','finalizado',0,'NO-PUBLICAR',CURRENT_TIMESTAMP)");
  const app=express();app.use(express.json());let reloj=Date.now();const {store}=montarAdministracion(app,{pool,Store:session.MemoryStore,ahora:()=>reloj});
  app.use(session({name:'meraki.sid',secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false}));
  app.post('/fixture/bo',(req,res)=>{req.session.idEmprendedora=1;res.sendStatus(200);});
  const a=request.agent(app),n=request.agent(app),anon=request(app);
  const login=(agent,correo,password)=>agent.post('/api/admin/auth/login').set('X-Meraki-Action','1').send({correo,password});
  let csrf;
  await t.test('Solo cuentas administrativas individuales; contraseña errónea y CSRF',async()=>{
   await login(a,'adriana@example.test','incorrecta').expect(401);
   await login(a,'adriana@example.test','Natalia-fixture-456').expect(401);
   await request(app).post('/api/admin/auth/login').send({correo:'adriana@example.test',password:'Adriana-fixture-123'}).expect(403);
   await login(a,'adriana@example.test','Adriana-fixture-123').expect(200);await login(n,'natalia@example.test','Natalia-fixture-456').expect(200);
   const yo=(await a.get('/api/admin/auth/yo').expect(200)).body;csrf=yo.csrf;assert.match(csrf,/^[a-f0-9]{64}$/);assert.equal(yo.correo,'adriana@example.test');
  });
  await t.test('Anónima y emprendedora no acceden a ninguna ruta administrativa',async()=>{
   const bo=request.agent(app);await bo.post('/fixture/bo').expect(200);
   for(const url of ['/indicadores','/emprendedoras','/emprendedoras/1','/historial']){await anon.get('/api/admin'+url).expect(401);await bo.get('/api/admin'+url).expect(401);}
   await bo.post('/api/admin/suscripciones/1/cancelar').set('X-Meraki-Action','1').send({motivo:'No autorizada',clave:randomUUID()}).expect(401);
  });
  await t.test('Listado incluye cuentas sin emprendimiento y respeta filtros y límites',async()=>{
   const d=(await a.get('/api/admin/emprendedoras').expect(200)).body;assert.equal(d.total,6);assert.equal(d.emprendedoras.at(-1).nombre,null);
   assert.equal((await a.get('/api/admin/emprendedoras?q=Estudio%202').expect(200)).body.total,1);
   assert.equal((await a.get('/api/admin/emprendedoras?estado=cancelada').expect(200)).body.total,1);
   assert.equal((await a.get('/api/admin/emprendedoras?estado=gratuito').expect(200)).body.total,1);
   assert.equal((await a.get('/api/admin/emprendedoras?pagina=2').expect(200)).body.total,6);
   assert.equal((await a.get('/api/admin/emprendedoras?q=No-existe').expect(200)).body.total,0);
   await a.get('/api/admin/emprendedoras?estado=inventado').expect(400);
   assert.doesNotMatch(JSON.stringify(d),/HASH-NO-PUBLICAR|TOKEN-SECRETO|USUARIO-SECRETO|tarjeta_cifrada|password_hash/);
  });
  await t.test('Indicadores usan estados vigentes, último pago y solo suscripciones',async()=>{
   const r=(await a.get('/api/admin/indicadores').expect(200)).body;assert.deepEqual(r,{emprendedoras:6,activas:2,gratuitas:1,canceladas:1,problemas_pago:1,pagos_aprobados:1});
   const d=(await a.get('/api/admin/emprendedoras/4').expect(200)).body;assert.equal(d.cobros.length,1);assert.equal(d.cobros[0].estado,'aprobado');assert.equal(d.emprendimiento.monto_mensual,'9990.00');
   assert.doesNotMatch(JSON.stringify(d),/TOKEN-SECRETO|USUARIO-SECRETO|NO-PUBLICAR|tarjeta_cifrada|password_hash|codigo_autorizacion/);
   await a.get('/api/admin/emprendedoras/99999').expect(404);
  });
  const enviar=(agent,sid,datos,token=csrf)=>agent.post('/api/admin/suscripciones/'+sid+'/cancelar').set('X-Meraki-Action','1').set('X-Meraki-CSRF',token).send(datos);
  await t.test('CSRF, origen, campos y motivo obligatorios; nada se escribe al fallar',async()=>{
   await enviar(a,1,{motivo:'Motivo de ejemplo',clave:randomUUID()},'a'.repeat(64)).expect(403);
   await enviar(a,1,{motivo:'corto',clave:randomUUID()}).expect(400);
   await enviar(a,1,{motivo:'Motivo de ejemplo',clave:randomUUID(),estado:'activa'}).expect(400);
   await a.post('/api/admin/suscripciones/1/cancelar').set('X-Meraki-Action','1').set('X-Meraki-CSRF',csrf).set('Origin','https://externo.example').send({motivo:'Motivo de ejemplo',clave:randomUUID()}).expect(403);
   assert.equal((await pool.query('SELECT count(*)::int n FROM historial_administrativo')).rows[0].n,0);
  });
  await t.test('Cancelación conserva acceso, inscripción cifrada e historial financiero; solo local',async()=>{
   const antes=(await pool.query('SELECT acceso_hasta,tarjeta_cifrada FROM suscripcion WHERE id_suscripcion=1')).rows[0];
   const p=(await pool.query('SELECT to_jsonb(p) fila FROM pago_suscripcion p ORDER BY id_pago_suscripcion')).rows;
   const d=(await enviar(a,1,{motivo:'Se solicita detener futuras renovaciones',clave:randomUUID()}).expect(200)).body;assert.equal(d.inscripcion_oneclick,'sin_modificar');
   const despues=(await pool.query('SELECT acceso_hasta,tarjeta_cifrada,estado,renovacion_automatica,reintento_autorizado FROM suscripcion WHERE id_suscripcion=1')).rows[0];assert.equal(despues.estado,'cancelada');assert.equal(despues.renovacion_automatica,false);assert.equal(despues.reintento_autorizado,false);assert.deepEqual(despues.acceso_hasta,antes.acceso_hasta);assert.equal(despues.tarjeta_cifrada,antes.tarjeta_cifrada);assert.deepEqual((await pool.query('SELECT to_jsonb(p) fila FROM pago_suscripcion p ORDER BY id_pago_suscripcion')).rows,p);
  });
  await t.test('Dos solicitudes simultáneas y respuesta perdida: una sola cancelación auditada',async()=>{
   const body={motivo:'Cancelación concurrente de demostración',clave:randomUUID()};const antes=(await pool.query('SELECT count(*)::int n FROM historial_administrativo')).rows[0].n;
   const r=await Promise.all([enviar(a,2,body),enviar(a,2,body)]);assert(r.every(x=>x.status===200));assert(r.some(x=>x.body.recuperada));
   await enviar(a,2,body).expect(200);assert.equal((await pool.query('SELECT count(*)::int n FROM historial_administrativo')).rows[0].n,antes+1);
   await enviar(a,2,{...body,motivo:'Otro contenido para la misma clave'}).expect(409);
   await enviar(a,2,{motivo:'Ya cancelada, no repetir cambios',clave:randomUUID()}).expect(200);assert.equal((await pool.query('SELECT count(*)::int n FROM historial_administrativo')).rows[0].n,antes+1);
  });
  await t.test('Compatible con el candado financiero y bloquea cobros futuros sin proveedor',async()=>{
   const db=await pool.connect();await db.query('SELECT pg_advisory_lock(509,3)');try{await enviar(a,3,{motivo:'Operación en curso debe esperar',clave:randomUUID()}).expect(409);}finally{await db.query('SELECT pg_advisory_unlock(509,3)');db.release();}
   let externos=0;const prohibido=async()=>{externos++;throw Error('Proveedor prohibido');};const servicio=crearSuscripciones({pool,proveedor:{ambiente:'integracion',autorizar:prohibido,consultar:prohibido,eliminar:prohibido},secreto:process.env.SESSION_SECRET});assert.equal(await servicio.procesar(2),'omitida');await assert.rejects(servicio.procesar(2,{manual:true}),e=>e.estado===409);assert.equal(externos,0);
  });
  await t.test('Cobro incierto bloquea cancelación sin modificarlo',async()=>{
   await pool.query("INSERT INTO pago_suscripcion(id_suscripcion,monto,estado,proceso) VALUES(3,9990,'pendiente','revision')");
   const antes=(await pool.query('SELECT to_jsonb(s) fila FROM suscripcion s WHERE id_suscripcion=3')).rows[0].fila;
   await enviar(a,3,{motivo:'Existe resultado incierto pendiente',clave:randomUUID()}).expect(409);
   assert.deepEqual((await pool.query('SELECT to_jsonb(s) fila FROM suscripcion s WHERE id_suscripcion=3')).rows[0].fila,antes);
  });
  await t.test('Fallo al registrar auditoría revierte toda la cancelación',async()=>{
   const antes=(await pool.query('SELECT to_jsonb(s) fila FROM suscripcion s WHERE id_suscripcion=4')).rows[0].fila;
   await assert.rejects(cancelar(pool,{administradora:999999,suscripcion:4,motivo:'Prueba de rollback por referencia inválida',clave:randomUUID()}));
   assert.deepEqual((await pool.query('SELECT to_jsonb(s) fila FROM suscripcion s WHERE id_suscripcion=4')).rows[0].fila,antes);
  });
  await t.test('Auditoría identifica actor, motivo, fecha Santiago y resultado sin secretos',async()=>{
   const h=(await a.get('/api/admin/historial').expect(200)).body;assert.equal(h.total,2);assert(h.acciones.every(x=>x.administradora==='adriana@example.test'));assert(h.acciones.every(x=>x.resultado==='cancelada_localmente'));assert.match(h.acciones[0].fecha,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);assert.doesNotMatch(JSON.stringify(h),/TOKEN-SECRETO|USUARIO-SECRETO|tarjeta_cifrada|huella|clave/);
   await a.delete('/api/admin/historial/1').set('X-Meraki-Action','1').expect(405);
  });
  await t.test('Sesión absoluta caducada y logout administrativo',async()=>{
   await n.post('/api/admin/auth/logout').set('X-Meraki-Action','1').expect(200);await n.get('/api/admin/historial').expect(401);
   reloj+=8*60*60*1000+1;await a.get('/api/admin/historial').expect(401);
  });
 }finally{if(pool)await pool.end();await base.query('DROP SCHEMA '+schema+' CASCADE');await base.end();}
});
test('Panel usa los estilos actuales y no agrega fuentes, colores ni enlaces públicos',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../frontend/admin/index.html'),'utf8');assert.match(html,/back-office\/gestion.css/);assert.match(html,/back-office\/tema-rosa.css/);assert.match(html,/front-office\/diseno-tokens.css/);assert.match(html,/confirmacionCancelacion/);assert.match(html,/role="status"/);
 const css=fs.readFileSync(path.join(__dirname,'../../frontend/admin/admin.css'),'utf8').split('/* Extensión local:')[1];assert(!/#[0-9a-f]{3,8}\b|@font-face|font-family:\s*(Arial|Roboto|Inter|Poppins)/i.test(css));assert.match(css,/@media\(max-width:800px\)/);
});
