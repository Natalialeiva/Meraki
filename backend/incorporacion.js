const {PLAN}=require('./suscripcion-plan');
function normalizarNegocio(datos,{creacion=false}={}){
 const fallo=()=>{throw Object.assign(Error('Revisa nombre, comuna y datos del negocio. Las coordenadas son opcionales y deben enviarse juntas.'),{http:400});};
 if(!datos||typeof datos!=='object'||Array.isArray(datos))fallo();
 const limites={nombre:150,descripcion:1000,direccion:200,comuna:100,telefono:20,latitud:null,longitud:null};
 const campos=Object.keys(datos),salida={};if(!campos.length)fallo();
 for(const k of campos){
  if(!Object.hasOwn(limites,k))fallo();if(['latitud','longitud'].includes(k))continue;
  const v=datos[k];if(v===null&&k!=='nombre'){salida[k]=null;continue;}
  if(typeof v!=='string'||v.trim().length>limites[k]||/[\u0000-\u001f\u007f]/.test(v)||(k==='nombre'&&!v.trim()))fallo();
  salida[k]=v.trim();
 }
 if(creacion&&(!salida.nombre||!salida.comuna))fallo();
 if(Object.hasOwn(datos,'latitud')||Object.hasOwn(datos,'longitud')){
  if(!Object.hasOwn(datos,'latitud')||!Object.hasOwn(datos,'longitud'))fallo();
  if(datos.latitud===null&&datos.longitud===null){salida.latitud=null;salida.longitud=null;}
  else for(const [k,max]of [['latitud',90],['longitud',180]]){
   const v=datos[k];if(typeof v!=='number'&&!(typeof v==='string'&&/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(v.trim())))fallo();
   const n=Number(v);if(!Number.isFinite(n)||Math.abs(n)>max)fallo();salida[k]=n;
  }
 }
 return salida;
}
async function crearCuenta(pool,datos){
 const db=await pool.connect();try{
  await db.query('BEGIN');
  // Serializa comprobación normalizada y alta, también ante peticiones concurrentes.
  await db.query('SELECT pg_advisory_xact_lock(718,1)');
  if((await db.query("SELECT 1 FROM emprendedora WHERE lower(btrim(correo))=$1 OR upper(replace(btrim(rut),'.',''))=$2",[datos[3],datos[2]])).rowCount)throw Object.assign(Error('DUPLICADO'),{code:'23505'});
  const r=await db.query('INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash,telefono) VALUES($1,$2,$3,$4,$5,$6) RETURNING id_emprendedora,nombre,apellido,rut,correo,telefono,estado,fecha_registro',datos);
  const id=r.rows[0].id_emprendedora;
  await db.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,fecha_fin_prueba,acceso_hasta,monto_mensual,estado,renovacion_automatica) VALUES($1,(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date,((CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date+make_interval(months=>$2))::date,((CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date+make_interval(months=>$2))::date,$3,'prueba',false)",[id,PLAN.mesesGratis,PLAN.monto]);
  await db.query('COMMIT');return r;
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
}
function montarIncorporacion(app,pool,verificarSesion){
 app.post('/api/emprendimientos',verificarSesion,async(req,res)=>{
  if(req.get('Sec-Fetch-Site')==='cross-site'||(req.get('Origin')&&req.get('Origin')!==req.protocol+'://'+req.get('Host')))return res.status(403).json({mensaje:'Solicitud no autorizada'});
  try{
   const d=normalizarNegocio(req.body,{creacion:true});
   const r=await pool.query('INSERT INTO emprendimiento(id_emprendedora,nombre,descripcion,direccion,comuna,telefono,latitud,longitud) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id_emprendimiento,nombre,descripcion,direccion,comuna,telefono,latitud,longitud,estado',[req.session.idEmprendedora,d.nombre,d.descripcion||null,d.direccion||null,d.comuna,d.telefono||null,d.latitud??null,d.longitud??null]);
   res.status(201).json({mensaje:'Emprendimiento registrado correctamente',emprendimiento:r.rows[0]});
  }catch(e){res.status(e.http||(e.code==='23505'?409:503)).json({mensaje:e.http?e.message:e.code==='23505'?'Tu cuenta ya tiene un emprendimiento. Consulta tu perfil.':'No se pudo registrar el emprendimiento'});}
 });
}
module.exports={normalizarNegocio,crearCuenta,montarIncorporacion};
