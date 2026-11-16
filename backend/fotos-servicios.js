const express=require('express'),sharp=require('sharp'),fs=require('node:fs/promises'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const LIMITE=5*1024*1024,PREFIJO='/media/servicios/';
const nombreSeguro=n=>typeof n==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/.test(n);
const error=(http,mensaje)=>Object.assign(Error(mensaje),{http});
async function convertir(buffer,mime,nombre){
 const formatos={'image/jpeg':['jpeg',/\.jpe?g$/i],'image/png':['png',/\.png$/i],'image/webp':['webp',/\.webp$/i]},esperado=Object.hasOwn(formatos,mime)?formatos[mime]:null;
 if(!Buffer.isBuffer(buffer)||!buffer.length)throw error(400,'Selecciona una fotografía.');
 if(buffer.length>LIMITE)throw error(413,'La fotografía no puede superar 5 MB.');
 if(!esperado||typeof nombre!=='string'||nombre.length>200||/[\\/\u0000-\u001f]/.test(nombre)||!esperado[1].test(nombre))throw error(415,'Utiliza un archivo JPG, PNG o WebP con su extensión correcta.');
 const firma=esperado[0]==='png'?buffer.subarray(0,8).toString('hex')==='89504e470d0a1a0a':esperado[0]==='jpeg'?buffer.subarray(0,3).toString('hex')==='ffd8ff':buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP';
 if(!firma)throw error(415,'El contenido no corresponde al formato indicado.');
 try{
  const imagen=sharp(buffer,{limitInputPixels:16000000,failOn:'warning'}),meta=await imagen.metadata();
  if(meta.format!==esperado[0]||(meta.pages||1)!==1)throw error(415,'El contenido no corresponde a una fotografía admitida.');
  return await imagen.rotate().resize({width:1920,height:1920,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
 }catch(e){if(e.http)throw e;throw error(415,'La imagen está dañada, es demasiado grande o su contenido no está permitido.');}
}
function crearAlmacen(carpeta=process.env.MERAKI_FOTOS_DIR||path.join(__dirname,'almacenamiento/fotos-servicios')){
 const raiz=path.resolve(carpeta),destino=n=>{if(!nombreSeguro(n))throw error(400,'Archivo no válido');return path.join(raiz,n);};
 return {
  async guardar(n,datos){await fs.mkdir(raiz,{recursive:true});const f=await fs.open(destino(n),'wx',0o600);try{await f.writeFile(datos);await f.sync();}finally{await f.close();}},
  async borrar(n){try{await fs.unlink(destino(n));}catch(e){if(e.code!=='ENOENT')throw e;}},
  async leer(n){return fs.readFile(destino(n));}
 };
}
function montarFotos(app,{pool,verificarSesion,almacen=crearAlmacen()}){
 const id=req=>{const n=Number(req.params.id);if(!Number.isSafeInteger(n)||n<=0||n>2147483647)throw error(400,'Servicio no válido');return n;};
 const proteger=(req,res,next)=>{res.set('Cache-Control','no-store');if(req.get('X-Meraki-Action')!=='1'||req.get('Sec-Fetch-Site')==='cross-site'||(req.get('Origin')&&req.get('Origin')!==req.protocol+'://'+req.get('Host')))return res.status(403).json({mensaje:'Solicitud no autorizada'});next();};
 const propio=async(db,req,bloquear=false)=>{const r=await db.query('SELECT s.id_servicio FROM servicio s JOIN emprendimiento e USING(id_emprendimiento) WHERE s.id_servicio=$1 AND e.id_emprendedora=$2'+(bloquear?' FOR UPDATE OF s':''),[id(req),req.session.idEmprendedora]);if(!r.rowCount)throw error(404,'Servicio no encontrado');};
 const actuales=async(db,n)=>(await db.query("SELECT id_imagen,url FROM imagen_servicio WHERE id_servicio=$1 AND url LIKE '/media/servicios/%' ORDER BY id_imagen DESC",[n])).rows;
 const responder=(res,e)=>res.status(e.http||503).json({mensaje:e.http?e.message:'No se pudo confirmar la operación. Actualiza la fotografía antes de intentar nuevamente.'});
 app.get('/api/servicios/:id/imagen',verificarSesion,async(req,res)=>{res.set('Cache-Control','no-store');try{await propio(pool,req);const imagen=(await actuales(pool,id(req)))[0];res.json({imagen:imagen||null});}catch(e){responder(res,e);}});
 const raw=express.raw({type:()=>true,limit:LIMITE,inflate:false});
 const recibir=(req,res,next)=>raw(req,res,e=>e?res.status(e.status===413?413:415).json({mensaje:e.status===413?'La fotografía no puede superar 5 MB.':'Formato de carga no permitido.'}):next());
 async function cambiar(req,res,eliminar){
  let db,nuevo,commitIntentado=false,confirmado=false;
  try{
   db=await pool.connect();await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'");
   await propio(db,req,true);const anteriores=await actuales(db,id(req));
   if(!eliminar){
    let nombre;try{nombre=decodeURIComponent(req.get('X-Meraki-Nombre')||'');}catch{throw error(400,'Nombre de archivo no válido');}
    const datos=await convertir(req.body,(req.get('Content-Type')||'').split(';')[0].toLowerCase(),nombre);
    nuevo=randomUUID()+'.webp';await almacen.guardar(nuevo,datos);
   }
   await db.query("DELETE FROM imagen_servicio WHERE id_servicio=$1 AND url LIKE '/media/servicios/%'",[id(req)]);
   let imagen=null;
   if(nuevo)imagen=(await db.query("INSERT INTO imagen_servicio(id_servicio,url,descripcion) VALUES($1,$2,'Fotografía del servicio') RETURNING id_imagen,url",[id(req),PREFIJO+nuevo])).rows[0];
   commitIntentado=true;await db.query('COMMIT');confirmado=true;
   let limpiezaPendiente=false;
   for(const anterior of anteriores){const n=anterior.url.slice(PREFIJO.length);if(nombreSeguro(n))try{await almacen.borrar(n);}catch{limpiezaPendiente=true;}}
   res.json({imagen,mensaje:eliminar?'Fotografía retirada.':'Fotografía guardada.',limpiezaPendiente});
  }catch(e){
   if(db&&!confirmado)await db.query('ROLLBACK').catch(()=>{});
   // COMMIT sin respuesta puede haber persistido: nunca borrar su archivo a ciegas.
   if(nuevo&&!commitIntentado)await almacen.borrar(nuevo).catch(()=>{});
   responder(res,e);
  }finally{db?.release();}
 }
 app.put('/api/servicios/:id/imagen',verificarSesion,proteger,recibir,(req,res)=>cambiar(req,res,false));
 app.delete('/api/servicios/:id/imagen',verificarSesion,proteger,(req,res)=>cambiar(req,res,true));
 app.get('/media/servicios/:archivo',async(req,res)=>{
  const n=req.params.archivo;if(!nombreSeguro(n))return res.sendStatus(404);
  const cuenta=Number.isSafeInteger(req.session?.idEmprendedora)?req.session.idEmprendedora:null;
  try{const r=await pool.query('SELECT 1 FROM imagen_servicio i JOIN servicio s USING(id_servicio) JOIN emprendimiento e USING(id_emprendimiento) WHERE i.url=$1 AND ((s.activo=true AND e.estado=true) OR e.id_emprendedora=$2)',[PREFIJO+n,cuenta]);if(!r.rowCount)return res.sendStatus(404);
   const datos=await almacen.leer(n);res.set({'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox"}).send(datos);
  }catch{return res.sendStatus(404);}
 });
}
module.exports={montarFotos,crearAlmacen,convertir,LIMITE};
