const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Pool}=require('pg'),express=require('express'),request=require('supertest'),sharp=require('sharp');
const {montarFotos,crearAlmacen,LIMITE}=require('../fotos-servicios');const {montarRestricciones}=require('../acceso-suscripcion');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
test('Fotografías: PostgreSQL aislado, permisos y conservación ante fallos',{skip:process.env.MERAKI_DB_TEST!=='1'},async t=>{
 assert.match(process.env.DB_NAME||'',/^meraki_mvp_ejecucion_\d+_[a-f0-9]{8}$/);
 const cfg={host:process.env.DB_HOST,port:+process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD};
 const admin=new Pool(cfg),schema='meraki_fotos_'+Date.now(),carpeta=await fs.mkdtemp(path.join(os.tmpdir(),'meraki-fotos-integracion-'));let pool;
 try{
  await admin.query('CREATE SCHEMA '+schema);pool=new Pool({...cfg,options:'-c search_path='+schema+',public'});
  for(const f of ['schema.sql','008_suscripcion_oneclick.sql','seed.sql'])await pool.query(await fs.readFile(path.join(__dirname,'../../database',f),'utf8'));
  await pool.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash) VALUES('Otra','Fixture','FOTO-OTRA','otra-foto@example.test','sin-login')");
  await pool.query("INSERT INTO emprendimiento(id_emprendedora,nombre) VALUES(2,'Otro negocio')");
  await pool.query("INSERT INTO servicio(id_emprendimiento,id_categoria,nombre,precio,duracion_min,monto_abono) VALUES(2,1,'Otro servicio',10000,30,1000)");
  await pool.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,monto_mensual,estado,acceso_hasta) VALUES(1,CURRENT_DATE,9990,'prueba','2099-01-01'),(2,CURRENT_DATE,9990,'prueba','2099-01-01')");
  const filasAntes=(await pool.query('SELECT * FROM servicio ORDER BY id_servicio')).rows;
  let falloDisco=false,falloSQL=false,commitIncierto=false;const disco=crearAlmacen(carpeta);
  const almacen={...disco,guardar:async(n,b)=>{if(falloDisco)throw Error('Disco simulado');return disco.guardar(n,b);}};
  const conexion={query:(...a)=>pool.query(...a),connect:async()=>{const c=await pool.connect();return {release:()=>c.release(),query:async(sql,args)=>{if(falloSQL&&/INSERT INTO imagen_servicio/.test(sql))throw Error('SQL simulado');const r=await c.query(sql,args);if(commitIncierto&&sql==='COMMIT'){commitIncierto=false;throw Error('Respuesta de commit perdida');}return r;}};}};
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.session={idEmprendedora:Number(req.get('X-Fixture-Cuenta'))};next();});
  const verificarSesion=(req,res,next)=>[1,2].includes(req.session.idEmprendedora)?next():res.sendStatus(401);
  montarRestricciones(app,conexion,verificarSesion);montarFotos(app,{pool:conexion,almacen,verificarSesion});
  const propio=(metodo,ruta='/api/servicios/1/imagen')=>request(app)[metodo](ruta).set('X-Fixture-Cuenta','1').set('X-Meraki-Action','1');
  const png=await sharp({create:{width:32,height:24,channels:3,background:'#cc88aa'}}).png().toBuffer();
  const subir=()=>propio('put').set('Content-Type','image/png').set('X-Meraki-Nombre','fixture.png').send(png);
  let primera;
  await t.test('Sin imagen, carga y lectura pública segura',async()=>{
   assert.equal((await propio('get').expect(200)).body.imagen,null);
   primera=(await subir().expect(200)).body.imagen;assert.match(primera.url,/^\/media\/servicios\/[a-f0-9-]+\.webp$/);
   const r=await request(app).get(primera.url).expect(200);assert.match(r.headers['content-type'],/image\/webp/);assert.equal(r.headers['x-content-type-options'],'nosniff');
   assert.equal((await sharp(await disco.leer(primera.url.split('/').pop())).metadata()).format,'webp');
   await pool.query('UPDATE servicio SET activo=false WHERE id_servicio=1');
   await request(app).get(primera.url).expect(404);await request(app).get(primera.url).set('X-Fixture-Cuenta','1').expect(200);
   await pool.query('UPDATE servicio SET activo=true WHERE id_servicio=1');
  });
  await t.test('Autenticación, propiedad, CSRF y vigencia',async()=>{
   await request(app).get('/api/servicios/1/imagen').expect(401);
   await request(app).put('/api/servicios/1/imagen').expect(401);
   await request(app).get('/api/servicios/1/imagen').set('X-Fixture-Cuenta','2').expect(404);
   await request(app).put('/api/servicios/1/imagen').set('X-Fixture-Cuenta','2').set('X-Meraki-Action','1').set('Content-Type','image/png').send(png).expect(404);
   await request(app).delete('/api/servicios/1/imagen').set('X-Fixture-Cuenta','2').set('X-Meraki-Action','1').expect(404);
   await propio('put').set('Origin','https://ajeno.example').set('Content-Type','image/png').send(png).expect(403);
   await pool.query("UPDATE suscripcion SET acceso_hasta='2000-01-01' WHERE id_emprendedora=1");await subir().expect(402);await propio('delete').expect(402);
   await pool.query("UPDATE suscripcion SET acceso_hasta='2099-01-01' WHERE id_emprendedora=1");
  });
  await t.test('Archivos falsos, tamaño y fallos conservan la imagen anterior',async()=>{
   await propio('put').set('Content-Type','image/png').set('X-Meraki-Nombre','falsa.png').send(Buffer.from('<script>alert(1)</script>')).expect(415);
   await propio('put').set('Content-Type','image/png').set('X-Meraki-Nombre','grande.png').send(Buffer.alloc(LIMITE+1)).expect(413);
   falloDisco=true;await subir().expect(503);falloDisco=false;
   falloSQL=true;await subir().expect(503);falloSQL=false;
   assert.equal((await propio('get').expect(200)).body.imagen.url,primera.url);await request(app).get(primera.url).expect(200);
   assert.equal((await fs.readdir(carpeta)).length,1);
  });
  await t.test('Reemplazo confirmado y eliminación',async()=>{
   const nueva=(await subir().expect(200)).body.imagen;assert.notEqual(nueva.url,primera.url);
   await request(app).get(primera.url).expect(404);await request(app).get(nueva.url).expect(200);
   assert.equal((await fs.readdir(carpeta)).length,1);
   await propio('delete').expect(200);assert.equal((await propio('get').expect(200)).body.imagen,null);await request(app).get(nueva.url).expect(404);
  });
  await t.test('Commit sin respuesta nunca elimina el archivo que quedó referenciado',async()=>{
   await subir().expect(200);commitIncierto=true;await subir().expect(503);
   const actual=(await propio('get').expect(200)).body.imagen;await request(app).get(actual.url).expect(200);
   assert.deepEqual((await pool.query('SELECT * FROM servicio ORDER BY id_servicio')).rows,filasAntes);
  });
 }finally{
  if(pool)await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();
  for(const n of await fs.readdir(carpeta)){assert.match(n,/^[a-f0-9-]{36}\.webp$/);await fs.unlink(path.join(carpeta,n));}await fs.rmdir(carpeta);
 }
});
