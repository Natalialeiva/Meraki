const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const express=require('express'),request=require('supertest'),{Pool}=require('pg');
const {crearSuscripciones,montarRutasSuscripcion}=require('../suscripciones');
const {PLAN,siguienteMes,cifrar,descifrar,validarPago,urlRetorno,normalizarTarjetaInscrita}=require('../suscripcion-plan');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});

test('Suscripción calcula un mes calendario y conserva el día al pasar febrero',()=>{
 assert.equal(siguienteMes('2026-11-04'),'2026-12-04');assert.equal(siguienteMes('2027-01-31'),'2027-02-28');
 assert.equal(siguienteMes('2027-02-28',31),'2027-03-31');assert.equal(siguienteMes('2028-01-31'),'2028-02-29');assert.equal(siguienteMes('2026-12-04'),'2027-01-04');
});
test('Suscripción cifra el identificador reutilizable y detecta alteración o cambio de clave',()=>{
 const texto=cifrar('identificador-privado','clave-prueba');assert(!texto.includes('identificador-privado'));assert.equal(descifrar(texto,'clave-prueba'),'identificador-privado');
 assert.throws(()=>descifrar(texto,'otra-clave'));assert.notEqual(texto,cifrar('identificador-privado','clave-prueba'));
});
test('Suscripción no admite producción mediante el servicio',()=>{
 assert.throws(()=>crearSuscripciones({pool:{},proveedor:{ambiente:'produccion'}}),/integración/);
});
test('Suscripción conserva el alias local y rechaza controlar el retorno desde otro Host',()=>{
 assert.equal(urlRetorno('http://localhost:3000','http://127.0.0.1:3000'),'http://127.0.0.1:3000/api/suscripcion/retorno');
 assert.equal(urlRetorno('http://localhost:3000','https://otro.example'),'http://localhost:3000/api/suscripcion/retorno');
 assert.equal(urlRetorno('https://meraki.example','https://otro.example'),'https://meraki.example/api/suscripcion/retorno');
 assert.throws(()=>urlRetorno('http://otro.example'));assert.throws(()=>urlRetorno('https://usuario:clave@meraki.example'));
});

test('Inscripción Oneclick acepta el formato real enmascarado y conserva solo los últimos cuatro',()=>{
 assert.deepEqual(normalizarTarjetaInscrita({card_number:'XXXXXXXXXXXX6623',card_type:'Visa'}),{ultimos4:'6623',tipo:'Visa'});
 assert.deepEqual(normalizarTarjetaInscrita({card_number:'************6623',card_type:'Visa'}),{ultimos4:'6623',tipo:'Visa'});
 assert.deepEqual(normalizarTarjetaInscrita({card_number:'6623',credit_card_type:'Visa'}),{ultimos4:'6623',tipo:'Visa'});
});
test('Inscripción Oneclick rechaza número completo, datos incompletos y tipo de tarjeta inválido',()=>{
 for(const card_number of ['4051885600446623','662','abc6623','',null,6623])assert.equal(normalizarTarjetaInscrita({card_number,card_type:'Visa'}),null);
 for(const card_type of ['',null,123,'x'.repeat(101)])assert.equal(normalizarTarjetaInscrita({card_number:'XXXXXXXXXXXX6623',card_type}),null);
 assert.equal(normalizarTarjetaInscrita({card_number:'6623'}),null);
});

test('Suscripciones Oneclick: PostgreSQL aislado y proveedor simulado',{skip:process.env.MERAKI_DB_TEST!=='1'},async t=>{
 const esquema='meraki_sub_test_'+Date.now();assert.match(esquema,/^meraki_sub_test_\d+$/);
 const configuracion={host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD};
 const admin=new Pool(configuracion);let pool;
 let fecha='2026-11-04',inicios=0,finalizaciones=0,cargos=0,consultas=0,revocaciones=0,modo='aprobar',modoFin='aprobar',esperarCargo;
 const respuestas=new Map(),consentimiento={acepta_renovacion:true,version_plan:PLAN.version};
 const responder=(p,aprobado=true)=>({buy_order:p.orden_compra,details:[{buy_order:p.orden_tienda,commerce_code:p.codigo_comercio,amount:Number(p.monto),status:aprobado?'AUTHORIZED':'FAILED',response_code:aprobado?0:-1,authorization_code:'PRUEBA'}]});
 const proveedor={ambiente:'integracion',codigoComercio:'tienda-simulada',
  async iniciar(usuario,correo,retorno){inicios++;assert.match(retorno,/\/api\/suscripcion\/retorno$/);return{token:'token-inscripcion-'+inicios,url_webpay:'https://webpay3gint.transbank.cl/webpayserver/bp_multicode_inscription.cgi'};},
  async finalizar(){finalizaciones++;if(modoFin==='timeout')throw Error('Simulado');return modoFin==='rechazar'?{response_code:-1}:{response_code:0,tbk_user:'identificador-privado-tbk',card_number:'XXXXXXXXXXXX6623',card_type:'Visa'};},
  async eliminar(token){assert.equal(token,'identificador-privado-tbk');revocaciones++;},
  async autorizar(usuario,token,p){assert.equal(token,'identificador-privado-tbk');cargos++;let r=responder(p,modo!=='rechazar');
   if(modo==='monto')r.details[0].amount=1;respuestas.set(p.orden_compra,r);
   if(esperarCargo)await esperarCargo();if(modo==='timeout')throw Error('Respuesta perdida después de autorizar');return r;},
  async consultar(orden){consultas++;return respuestas.get(orden);}
 };
 try{
  assert((await admin.query("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='btree_gist') AS instalada")).rows[0].instalada);
  await admin.query('CREATE SCHEMA '+esquema);pool=new Pool({...configuracion,options:'-c search_path='+esquema+',public'});
  for(const archivo of ['schema.sql','002_agregar_token_consulta.sql','seed.sql','008_suscripcion_oneclick.sql'])await pool.query(fs.readFileSync(path.join(__dirname,'../../database',archivo),'utf8'));
  // Idempotencia de la migración y aislamiento estricto durante las operaciones de negocio.
  await pool.query(fs.readFileSync(path.join(__dirname,'../../database/008_suscripcion_oneclick.sql'),'utf8'));
  await pool.end();pool=new Pool({...configuracion,options:'-c search_path='+esquema});
  const opciones=()=>({pool,proveedor,secreto:'clave-prueba-suscripcion',hoy:()=>fecha,base:'http://127.0.0.1:3000'});
  let servicio=crearSuscripciones(opciones());
  const app=express();app.use(express.json());app.use(express.urlencoded({extended:false}));
  // La autenticación real ya se prueba en integracion.test.js; aquí se fija una identidad de prueba.
  app.use((req,res,next)=>{if(req.get('X-Test-Cuenta'))req.session={idEmprendedora:Number(req.get('X-Test-Cuenta'))};next();});
  montarRutasSuscripcion(app,servicio,(req,res,next)=>req.session?next():res.status(401).json({mensaje:'Sin sesión'}));
  const post=(ruta,datos=consentimiento,cuenta=1)=>request(app).post('/api/suscripcion/'+ruta).set('X-Test-Cuenta',String(cuenta)).set('X-Meraki-Action','1').send(datos);
  let token;
  await t.test('Suscripción exige sesión, cabecera y consentimiento del plan exacto',async()=>{
   await request(app).get('/api/suscripcion').expect(401);await request(app).post('/api/suscripcion/inscribir').send(consentimiento).expect(401);
   await request(app).post('/api/suscripcion/inscribir').set('X-Test-Cuenta','1').send(consentimiento).expect(403);
   for(const datos of [{},{...consentimiento,acepta_renovacion:false},{...consentimiento,version_plan:'otro'},{...consentimiento,monto:1}])await post('inscribir',datos).expect(400);
   assert.equal(inicios,0);assert.equal((await servicio.obtener(1)).suscripcion,null);
  });
  await t.test('Inscripción concurrente inicia una sola vez y no crea cargos',async()=>{
   const r=await Promise.all([post('inscribir'),post('inscribir')]);assert.deepEqual(r.map(x=>x.status).sort(),[200,409]);token=r.find(x=>x.status===200).body.token;
   assert.equal(inicios,1);assert.equal(cargos,0);assert.equal((await pool.query('SELECT * FROM suscripcion')).rows.length,1);
   assert(!(await pool.query('SELECT token_hash FROM inscripcion_suscripcion')).rows[0].token_hash.includes(token));
  });
  await t.test('Retorno GET confirma una sola vez y concede un mes sin cobrar',async()=>{
   await request(app).get('/api/suscripcion/retorno').query({TBK_TOKEN:token}).expect(303);
   await request(app).post('/api/suscripcion/retorno').send({TBK_TOKEN:token}).expect(303);
   assert.equal(finalizaciones,1);assert.equal(cargos,0);
   const d=await servicio.obtener(1);assert.equal(d.suscripcion.estado,'prueba');assert.equal(d.suscripcion.fecha_fin_prueba,'2026-12-04');assert.equal(d.suscripcion.fecha_proximo_cobro,'2026-12-04');
   assert(!JSON.stringify(d).includes('identificador-privado'));assert(!JSON.stringify(d).includes('tarjeta_cifrada'));assert(!JSON.stringify(d).includes('usuario_oneclick'));
   assert.equal(d.suscripcion.tarjeta_ultimos4,'6623');assert.equal(d.suscripcion.tarjeta_tipo,'Visa');
   assert.equal(descifrar((await pool.query('SELECT tarjeta_cifrada FROM suscripcion')).rows[0].tarjeta_cifrada,'clave-prueba-suscripcion'),'identificador-privado-tbk');
   await post('inscribir').expect(409);
  });
  await t.test('Propiedad: otra cuenta no ve ni cancela la suscripción ajena',async()=>{
   assert.equal((await request(app).get('/api/suscripcion').set('X-Test-Cuenta','999').expect(200)).body.suscripcion,null);
   await post('cancelar',{},999).expect(404);await post('reintentar',consentimiento,999).expect(409);
   await request(app).get('/api/suscripcion/retorno').query({TBK_TOKEN:'inventado'}).expect(404);assert.equal(finalizaciones,1);
  });
  await t.test('Antes del vencimiento no cobra; procesadores concurrentes cobran solo una vez',async()=>{
   fecha='2026-12-03';await servicio.ciclo();assert.equal(cargos,0);
   fecha='2026-12-04';await Promise.all(Array.from({length:5},()=>servicio.procesar(1)));assert.equal(cargos,1);
   const d=await servicio.obtener(1);assert.equal(d.capacidades.configurar,true);assert.equal(d.suscripcion.estado,'activa');assert.equal(d.suscripcion.acceso_hasta,'2027-01-04');assert.equal(Number(d.pagos[0].monto),9990);
   await servicio.ciclo();assert.equal(cargos,1);
  });
  await t.test('Rechazo no extiende acceso ni se reintenta sin consentimiento nuevo',async()=>{
   fecha='2027-01-04';modo='rechazar';await servicio.procesar(1);assert.equal(cargos,2);await servicio.procesar(1);assert.equal(cargos,2);
   const d=await servicio.obtener(1);assert.equal(d.capacidades.configurar,false);assert.equal(d.suscripcion.estado,'vencida');assert.equal(d.suscripcion.acceso_hasta,'2027-01-04');assert.equal(d.pagos[0].estado,'rechazado');
   await post('reintentar',{...consentimiento,acepta_renovacion:false}).expect(400);await post('reintentar').expect(200);modo='aprobar';
   await Promise.all([servicio.procesar(1),servicio.procesar(1)]);assert.equal(cargos,3);assert.equal((await servicio.obtener(1)).suscripcion.acceso_hasta,'2027-02-04');
  });
  await t.test('Timeout tras autorizar se recupera por consulta incluso tras reiniciar, sin otro cargo',async()=>{
   fecha='2027-02-04';modo='timeout';assert.equal(await servicio.procesar(1),'revision');assert.equal(cargos,4);
   assert.equal((await servicio.obtener(1)).pagos[0].proceso,'revision');await post('reintentar').expect(409);
   servicio=crearSuscripciones(opciones());assert.equal(await servicio.procesar(1),'aprobado');assert.equal(cargos,4);assert(consultas>0);
   assert.equal((await servicio.obtener(1)).suscripcion.acceso_hasta,'2027-03-04');modo='aprobar';
  });
  await t.test('Respuesta con monto incorrecto queda en revisión y nunca se vuelve a autorizar',async()=>{
   fecha='2027-03-04';modo='monto';await servicio.procesar(1);assert.equal(cargos,5);await servicio.procesar(1);assert.equal(cargos,5);
   assert.equal((await servicio.obtener(1)).suscripcion.acceso_hasta,'2027-03-04');
   const p=(await pool.query('SELECT * FROM pago_suscripcion ORDER BY id_pago_suscripcion DESC LIMIT 1')).rows[0];respuestas.set(p.orden_compra,responder(p));
   assert.equal(await servicio.procesar(1),'aprobado');modo='aprobar';assert.equal(cargos,5);
  });
  await t.test('Fallo de persistencia después del cargo recupera sin duplicar y no adelanta vigencia',async()=>{
   fecha='2027-04-04';await pool.query("ALTER TABLE pago_suscripcion ADD CONSTRAINT fallo_prueba CHECK(estado<>'aprobado') NOT VALID");
   await servicio.procesar(1);assert.equal(cargos,6);assert.equal((await servicio.obtener(1)).suscripcion.acceso_hasta,'2027-04-04');
   await pool.query('ALTER TABLE pago_suscripcion DROP CONSTRAINT fallo_prueba');assert.equal(await servicio.procesar(1),'aprobado');assert.equal(cargos,6);
  });
  await t.test('Cancelación conserva período, revoca tarjeta y detiene renovaciones',async()=>{
   fecha='2027-04-05';await post('cancelar',{}).expect(200);assert.equal(revocaciones,1);
   const d=await servicio.obtener(1);assert.equal(d.capacidades.configurar,true);assert.equal(d.suscripcion.estado,'cancelada');assert.equal(d.suscripcion.acceso_hasta,'2027-05-04');assert.equal(d.suscripcion.renovacion_automatica,false);
   fecha='2027-05-04';await servicio.ciclo();assert.equal(cargos,6);
  });
  await t.test('Reinscripción no regala otra prueba y renueva el período vencido',async()=>{
   token=(await post('inscribir').expect(200)).body.token;await request(app).post('/api/suscripcion/retorno').send({TBK_TOKEN:token}).expect(303);
   assert.equal((await servicio.obtener(1)).suscripcion.fecha_fin_prueba,'2026-12-04');assert.equal(cargos,6);
   await servicio.procesar(1);assert.equal(cargos,7);assert.equal((await servicio.obtener(1)).suscripcion.acceso_hasta,'2027-06-04');
  });
  await t.test('Procesador atrasado cobra un solo mes desde hoy, sin acumular mensualidades',async()=>{
   fecha='2027-08-10';await servicio.ciclo();assert.equal(cargos,8);const d=await servicio.obtener(1);assert.equal(d.suscripcion.acceso_hasta,'2027-09-10');
   await servicio.ciclo();assert.equal(cargos,8);
  });
  await t.test('Cancelación concurrente espera el cargo en curso y bloquea los siguientes',async()=>{
   fecha='2027-09-10';let liberar,comenzo;const inicio=new Promise(r=>{comenzo=r;});esperarCargo=()=>{comenzo();return new Promise(r=>{liberar=r;});};
   const cobro=servicio.procesar(1);await Promise.race([inicio,new Promise((_,rechazar)=>setTimeout(()=>rechazar(Error('El cobro simulado no comenzó')),1500))]);const cancelacion=servicio.cancelar(1);liberar();await Promise.all([cobro,cancelacion]);esperarCargo=null;
   assert.equal((await servicio.obtener(1)).suscripcion.renovacion_automatica,false);assert.equal(cargos,9);
   fecha='2027-10-10';await servicio.ciclo();assert.equal(cargos,9);
  });
  await t.test('Inscripción rechazada o incierta no activa renovación ni concede otro mes',async()=>{
   modoFin='rechazar';token=(await post('inscribir').expect(200)).body.token;await request(app).get('/api/suscripcion/retorno').query({TBK_TOKEN:token}).expect(409);
   assert.equal((await servicio.obtener(1)).suscripcion.renovacion_automatica,false);
   modoFin='timeout';token=(await post('inscribir').expect(200)).body.token;await request(app).get('/api/suscripcion/retorno').query({TBK_TOKEN:token}).expect(502);
   await post('inscribir').expect(409);await post('cancelar',{}).expect(200);
   await request(app).get('/api/suscripcion/retorno').query({TBK_TOKEN:token}).expect(409);assert.equal(cargos,9);
  });
  await t.test('Órdenes, comercio y respuesta incompleta nunca acreditan un pago',async()=>{
   const p=(await pool.query('SELECT * FROM pago_suscripcion ORDER BY id_pago_suscripcion DESC LIMIT 1')).rows[0];const r=responder(p);
   assert.equal(validarPago({...r,buy_order:'otra'},p),'incierto');assert.equal(validarPago({...r,details:[]},p),'incierto');
   assert.equal(validarPago({...r,details:[{...r.details[0],commerce_code:'otro'}]},p),'incierto');assert.equal(validarPago({...r,details:[{...r.details[0],response_code:null}]},p),'incierto');
  });
  await t.test('Procesador por lotes no deja una renovación detrás de cincuenta pagos inciertos',async()=>{
   modo='aprobar';const antes=cargos;
   for(let indice=0;indice<51;indice++){
    const cuenta=(await pool.query(`INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash)
     VALUES('Lote','Prueba',$1,$2,'hash-solo-prueba') RETURNING id_emprendedora`,['lote-'+indice,'lote'+indice+'@meraki.test'])).rows[0].id_emprendedora;
    const s=(await pool.query(`INSERT INTO suscripcion(id_emprendedora,fecha_inicio,fecha_proximo_cobro,monto_mensual,estado,
     renovacion_automatica,usuario_oneclick,tarjeta_cifrada,dia_cobro) VALUES($1,'2027-09-10','2027-10-10',9990,'vencida',TRUE,'usuario-simulado',$2,10)
     RETURNING id_suscripcion`,[cuenta,indice===50?cifrar('identificador-privado-tbk','clave-prueba-suscripcion'):null])).rows[0].id_suscripcion;
    if(indice<50)await pool.query(`INSERT INTO pago_suscripcion(id_suscripcion,monto,periodo_inicio,periodo_fin,orden_compra,orden_tienda,codigo_comercio,proceso,dia_cobro)
     VALUES($1,9990,'2027-10-10','2027-11-10',$2,$3,'tienda-simulada','revision',10)`,[s,'incierto-'+indice,'tienda-'+indice]);
   }
   const procesador=crearSuscripciones(opciones());await procesador.ciclo();assert.equal(cargos,antes);
   await procesador.ciclo();assert.equal(cargos,antes+1);
  });
 }finally{if(pool)await pool.end();await admin.query('DROP SCHEMA IF EXISTS '+esquema+' CASCADE');await admin.end();}
});
