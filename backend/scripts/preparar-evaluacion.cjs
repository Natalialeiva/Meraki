// Solo instala una base NUEVA de evaluación. No elimina ni reutiliza bases.
const fs=require('node:fs'),path=require('node:path'),{randomBytes,randomUUID}=require('node:crypto');
const {Client}=require('pg'),bcrypt=require('bcrypt');
const {leer}=require('./configuracion-evaluacion.cjs');
const migraciones=['schema.sql','migracion_abonos_reintentos.sql','002_agregar_token_consulta.sql','003_notificaciones_correo.sql','004_fecha_inicio_envio.sql','005_revision_notificaciones.sql','006_correccion_correo_reserva.sql','007_clienta_correo_unico.sql','007_nombre_reserva.sql','008_suscripcion_oneclick.sql','009_intentos_webpay.sql','010_procesamiento_webpay.sql','011_reserva_invitada.sql','012_gestiones_reserva.sql','013_servicio_abono_clp.sql'];
async function datos(c){
 const hash=await bcrypt.hash('Meraki-Evaluacion-2026!',12);
 const ids=[];
 for(const [nombre,correo,negocio,comuna]of [['Valentina','equipo@example.test','Estudio Evaluación — equipo ficticio','Santiago'],['Daniela','sola@example.test','Estudio Evaluación — atención individual','Providencia']]){
  const id=(await c.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash) VALUES($1,'Ficticia',$2,$3,$4) RETURNING id_emprendedora",[nombre,'EVAL-'+nombre,correo,hash])).rows[0].id_emprendedora;
  const emp=(await c.query("INSERT INTO emprendimiento(id_emprendedora,nombre,descripcion,comuna,direccion) VALUES($1,$2,'Datos ficticios para evaluación académica; sin transacciones externas.',$3,'Dirección ficticia, sin ubicación confirmada') RETURNING id_emprendimiento",[id,negocio,comuna])).rows[0].id_emprendimiento;
  await c.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,fecha_fin_prueba,acceso_hasta,estado,monto_mensual,renovacion_automatica) VALUES($1,CURRENT_DATE,(CURRENT_DATE+interval '1 month')::date,(CURRENT_DATE+interval '1 month')::date,'prueba',9990,false)",[id]);
  const cat=(await c.query("INSERT INTO categoria(nombre) VALUES($1) RETURNING id_categoria",[id===1?'Manicure':'Peluquería'])).rows[0].id_categoria;
  const servicio=(await c.query("INSERT INTO servicio(id_emprendimiento,id_categoria,nombre,descripcion,precio,duracion_min,monto_abono) VALUES($1,$2,$3,'Servicio ficticio, no corresponde a una oferta comercial real.',20000,60,5000) RETURNING id_servicio",[emp,cat,id===1?'Manicure de evaluación':'Corte de evaluación'])).rows[0].id_servicio;
  const personas=[];
  for(let n=1;n<=(id===1?2:1);n++){
   const t=(await c.query("INSERT INTO trabajadora(id_emprendimiento,nombre) VALUES($1,$2) RETURNING id_trabajadora",[emp,'Profesional ficticia '+id+'-'+n])).rows[0].id_trabajadora;personas.push(t);
   await c.query('INSERT INTO trabajadora_servicio(id_trabajadora,id_servicio) VALUES($1,$2)',[t,servicio]);
   await c.query("INSERT INTO horario_atencion(id_trabajadora,dia_semana,hora_inicio,hora_fin) SELECT $1,dia,'09:00','18:00' FROM unnest(ARRAY['lunes','martes','miercoles','jueves','viernes','sabado','domingo']) dia",[t]);
  }
  ids.push({emp,servicio,personas});
 }
 const clienta=(await c.query("INSERT INTO clienta(nombre,correo) VALUES('Contacto ficticio','contacto@example.test') RETURNING id_clienta")).rows[0].id_clienta;
 const primero=ids[0];
 // Los estados son fixtures explícitos: no hay abonos ni aceptación de proveedores.
 for(let mes=0;mes<6;mes++)for(const [n,estado]of ['pendiente_abono','confirmada','cancelada','atendida','no_atendida'].entries()){
  await c.query(`INSERT INTO reserva(id_emprendimiento,id_servicio,id_trabajadora,id_clienta,fecha_hora_inicio,fecha_hora_fin,estado,precio_servicio,monto_abono,token_consulta,nombre_clienta)
   VALUES($1,$2,$3,$4,date_trunc('month',CURRENT_DATE)::timestamp-($5::int*interval '1 month')+($6::int*interval '1 day')+interval '10 hours',date_trunc('month',CURRENT_DATE)::timestamp-($5::int*interval '1 month')+($6::int*interval '1 day')+interval '11 hours',$7,20000,5000,$8,'Contacto ficticio')`,[primero.emp,primero.servicio,primero.personas[n%2],clienta,mes,n+1,estado,randomUUID()]);
 }
 await c.query(`INSERT INTO reserva(id_emprendimiento,id_servicio,id_trabajadora,id_clienta,fecha_hora_inicio,fecha_hora_fin,estado,precio_servicio,monto_abono,token_consulta,nombre_clienta)
  VALUES($1,$2,$3,$4,CURRENT_DATE+interval '1 day 09:00',CURRENT_DATE+interval '1 day 10:00','confirmada',20000,5000,$5,'Contacto ficticio')`,[primero.emp,primero.servicio,primero.personas[0],clienta,randomUUID()]);
 await c.query("INSERT INTO notificacion_correo(id_reserva,estado,intentos,ultimo_error) SELECT id_reserva,'pendiente',0,'Registro ficticio para evaluación; no se ha enviado ningún correo.' FROM reserva WHERE estado='confirmada' ORDER BY id_reserva DESC LIMIT 1");
 // Ejemplo local sin token, fecha de pago ni código de autorización externo.
 await c.query("INSERT INTO abono(id_reserva,monto,estado,buy_order) SELECT id_reserva,5000,'pendiente','EVAL-SIN-PROVEEDOR-1' FROM reserva WHERE estado='pendiente_abono' ORDER BY id_reserva LIMIT 1");
}
async function main(){
 if(process.argv.includes('--configurar')){
  const destino=path.join(__dirname,'../.env');
  const plantilla=fs.readFileSync(path.join(__dirname,'../.env.example'),'utf8').replace(/^SESSION_SECRET=.*$/m,'SESSION_SECRET='+randomBytes(32).toString('hex'));
  fs.writeFileSync(destino,plantilla,{flag:'wx'});console.log('Configuración local creada. Edita DB_USER y DB_PASSWORD en backend/.env. No compartas ese archivo.');return;
 }
 if(!process.argv.includes('--crear'))throw Error('Usa --configurar o --crear.');
 const env=leer(),config={host:env.DB_HOST,port:Number(env.DB_PORT),user:env.DB_USER,password:env.DB_PASSWORD};
 const admin=new Client({...config,database:'postgres'});let c;
 await admin.connect();
 try{
  if((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[env.DB_NAME])).rowCount)throw Error('La base ya existe. No se cambió ni reutilizó. Para otra instalación, elige otro nombre meraki_evaluacion_ en .env.');
  await admin.query('CREATE DATABASE "'+env.DB_NAME+'" TEMPLATE template0');
  c=new Client({...config,database:env.DB_NAME,options:'-c timezone=America/Santiago'});await c.connect();
  if((await c.query('SELECT current_database() nombre')).rows[0].nombre!==env.DB_NAME)throw Error('Destino inesperado.');
  await c.query('BEGIN');
  try{
   // Exportación fiel de estructura: no reaplicar migraciones sobre ella.
   const sql=fs.readFileSync(path.join(__dirname,'../../database/entrega-esquema.sql'),'utf8').replace(/^\\.*$/gm,'');
   await c.query(sql);
   await c.query('SET search_path TO public');
   await datos(c);await c.query('COMMIT');
  }catch(error){await c.query('ROLLBACK');throw error;}
  console.log('Restauración del esquema original completada. Base nueva: '+env.DB_NAME+'. Datos ficticios listos. Sin pagos ni envíos.');
 }finally{if(c)await c.end();await admin.end();}
}
if(require.main===module)main().catch(e=>{console.error(e.code==='EEXIST'?'Ya existe backend/.env. Se conserva intacto.':e.code?'Error de instalación: '+e.code+'. Revisa conexión, permisos y que la base sea nueva.':e.message);process.exitCode=1;});
module.exports={migraciones};
