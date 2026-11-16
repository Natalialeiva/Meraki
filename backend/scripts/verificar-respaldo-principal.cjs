// Respalda la base principal sin escribir en ella. Restaura exclusivamente una base nueva.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {randomUUID,createHash}=require('node:crypto');
const {Client}=require('pg');
const raiz=path.resolve(__dirname,'../..');
const env=require('dotenv').parse(fs.readFileSync(path.join(raiz,'backend/.env')));
const config={host:env.DB_HOST,port:Number(env.DB_PORT),user:env.DB_USER,password:env.DB_PASSWORD};
const sqls=['009_intentos_webpay.sql','010_procesamiento_webpay.sql','011_reserva_invitada.sql','012_gestiones_reserva.sql'];
async function inventario(c){
 const tablas=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
 const datos={};
 for(const t of tablas){
  const q='"'+t.replaceAll('"','""')+'"';
  // Huella privada: nunca imprime filas, contactos, sesiones o tokens.
  datos[t]=(await c.query(`SELECT count(*)::int cantidad,md5(coalesce(string_agg(fila,E'\\n' ORDER BY fila),'')) huella FROM (SELECT row_to_json(t)::text fila FROM public.${q} t) s`)).rows[0];
 }
 const catalogo=(await c.query("SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
 const indices=(await c.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname")).rows;
 // PostgreSQL puede reasignar nombres automáticos NOT NULL al restaurar;
 // comparar su tabla/definición, y conservar nombres de las demás restricciones.
 const restricciones=(await c.query("SELECT conrelid::regclass::text tabla,CASE WHEN contype='n' THEN '' ELSE conname END nombre,pg_get_constraintdef(oid) definicion FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2,3")).rows;
 // El parser reescribe varchar[]::text[] como casts de cada literal al restaurar.
 for(const r of restricciones)r.definicion=r.definicion.replace(/\(ARRAY\[([^\]]*)\]\)::text\[\]/g,'ARRAY[$1]').replace(/\(('(?:[^']|'')*'::character varying)\)::text/g,'$1');
 const extensiones=(await c.query('SELECT extname,extversion FROM pg_extension ORDER BY extname')).rows;
 return {datos,catalogo,indices,restricciones,extensiones};
}
function ejecutar(nombre,args,extra={}){
 const bin=process.env.MERAKI_PG_BIN||'C:/Program Files/PostgreSQL/18/bin';
 const r=spawnSync(path.join(bin,nombre+(process.platform==='win32'?'.exe':'')),args,{env:{...process.env,PGPASSWORD:config.password,...extra},encoding:'utf8',windowsHide:true});
 if(r.error||r.status!==0)throw Error(nombre+' falló; no se imprime salida privada');
 return r.stdout;
}
async function main(){
 if(!process.argv.includes('--verificar'))throw Error('Requiere --verificar: respaldo privado y restauración temporal');
 if(env.DB_NAME!=='meraki_db'||!['localhost','127.0.0.1','::1'].includes(config.host))throw Error('Solo meraki_db local');
 const basePrivada=path.join(os.homedir(),'AppData/Local/Meraki/respaldos');
 fs.mkdirSync(basePrivada,{recursive:true});
 const carpeta=fs.mkdtempSync(path.join(basePrivada,'principal-'));
 const archivo=path.join(carpeta,'meraki_db.dump');
 const temporal='meraki_verificacion_'+Date.now()+'_'+randomUUID().replaceAll('-','').slice(0,8);
 const admin=new Client({...config,database:'postgres'}),origen=new Client({...config,database:'meraki_db'});
 let creada=false,oid,destino,transaccion=false;
 try{
  await admin.connect();await origen.connect();
  await origen.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');transaccion=true;
  const snapshot=(await origen.query('SELECT pg_export_snapshot() snapshot')).rows[0].snapshot;
  const antes=await inventario(origen);
  const requisitos={
   '009_intentos_webpay.sql':['abono.fase_webpay','abono.sesion_webpay','abono.fecha_fase_webpay'],
   '010_procesamiento_webpay.sql':['abono.operacion_webpay','abono.tipo_operacion_webpay','abono.estado_proceso_webpay','abono.fecha_operacion_webpay','abono.commit_webpay_reclamado_en'],
   '011_reserva_invitada.sql':['contacto_reserva_invitada.id_reserva','intento_reserva_invitada.contexto_hash'],
   '012_gestiones_reserva.sql':['reserva.asistencia_confirmada_en','solicitud_cancelacion.id_solicitud']
  };
  const presentes=new Set(antes.catalogo.map(r=>r.table_name+'.'+r.column_name));
  const pendientes=sqls.filter(s=>{
   const n=requisitos[s].filter(k=>presentes.has(k)).length;
   if(n && n!==requisitos[s].length)throw Error('Migración parcial: '+s);
   return n===0;
  });
  if(process.argv.includes('--aplicar-009-012')){
   const sesiones=(await origen.query('SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()')).rows[0].n;
   if(sesiones)throw Error('Detener backend y otras conexiones antes de migrar');
  }
  const args=['-h',config.host,'-p',String(config.port),'-U',config.user];
  ejecutar('pg_dump',[...args,'-d','meraki_db','--format=custom','--snapshot='+snapshot,'--file='+archivo]);
  await origen.query('ROLLBACK');transaccion=false;
  ejecutar('pg_restore',['--list',archivo]);
  await admin.query('CREATE DATABASE '+temporal+' TEMPLATE template0');creada=true;
  oid=(await admin.query('SELECT oid FROM pg_database WHERE datname=$1',[temporal])).rows[0].oid;
  ejecutar('pg_restore',[...args,'-d',temporal,'--exit-on-error','--single-transaction',archivo]);
  destino=new Client({...config,database:temporal});await destino.connect();
  const recuperado=await inventario(destino);
  const diferencias=Object.keys(antes).filter(k=>JSON.stringify(antes[k])!==JSON.stringify(recuperado[k]));
  if(diferencias.length)throw Error('El respaldo restaurado no coincide en: '+diferencias.join(', '));
  // Ensayo de compatibilidad exclusivamente sobre la restauración efímera.
  const aplicadas=[];
  for(const archivoSql of pendientes){
   await destino.query(fs.readFileSync(path.join(raiz,'database',archivoSql),'utf8'));aplicadas.push(archivoSql);
  }
  for(const [tabla,valor]of Object.entries(antes.datos)){
   const n=(await destino.query('SELECT count(*)::int n FROM public."'+tabla.replaceAll('"','""')+'"')).rows[0].n;
   if(n!==valor.cantidad)throw Error('Cambió cantidad de registros al ensayar migraciones');
  }
  // Comparación de todos los campos históricos, excluyendo solo columnas nuevas.
  for(const [tabla,valor]of Object.entries(antes.datos)){
   const columnas=antes.catalogo.filter(r=>r.table_name===tabla).map(r=>'"'+r.column_name.replaceAll('"','""')+'"').join(',');
   const q='"'+tabla.replaceAll('"','""')+'"';
   const huella=(await destino.query(`SELECT md5(coalesce(string_agg(fila,E'\\n' ORDER BY fila),'')) huella FROM (SELECT row_to_json(t)::text fila FROM (SELECT ${columnas} FROM public.${q}) t) s`)).rows[0].huella;
   if(huella!==valor.huella)throw Error('Cambió contenido histórico al ensayar migraciones');
  }
  const informe={fecha:new Date().toISOString(),base:'meraki_db',respaldo:archivo,sha256:createHash('sha256').update(fs.readFileSync(archivo)).digest('hex'),restauracionVerificada:true,migracionesEnsayadas:aplicadas,datosConservados:true,cantidades:Object.fromEntries(Object.entries(antes.datos).map(([t,v])=>[t,v.cantidad])),principalModificada:false};
  fs.writeFileSync(path.join(carpeta,'verificacion.json'),JSON.stringify(informe,null,2));
  if(process.argv.includes('--aplicar-009-012')){
   await origen.query('ROLLBACK');transaccion=false;
   await origen.query('BEGIN');transaccion=true;
   await origen.query("SET LOCAL lock_timeout='5s'");
   await origen.query('LOCK TABLE '+Object.keys(antes.datos).map(t=>'public."'+t.replaceAll('"','""')+'"').join(',')+' IN ACCESS EXCLUSIVE MODE');
   if((await origen.query('SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()')).rows[0].n)throw Error('Hay conexiones nuevas: no migrar');
   if(JSON.stringify(await inventario(origen))!==JSON.stringify(antes))throw Error('La principal cambió desde el respaldo');
   for(const archivoSql of pendientes){
    const sql=fs.readFileSync(path.join(raiz,'database',archivoSql),'utf8').replace(/^\s*(BEGIN|COMMIT);\s*$/gm,'');
    await origen.query(sql);
   }
   // El resultado debe coincidir íntegramente con el ensayo restaurado.
   if(JSON.stringify(await inventario(origen))!==JSON.stringify(await inventario(destino)))throw Error('Actualización distinta del ensayo; rollback');
   await origen.query('COMMIT');transaccion=false;
   informe.principalModificada=pendientes.length>0;informe.migracionesAplicadas=pendientes;
   fs.writeFileSync(path.join(carpeta,'verificacion.json'),JSON.stringify(informe,null,2));
  }
  console.log(JSON.stringify(informe,null,2));
 }finally{
  if(transaccion)await origen.query('ROLLBACK').catch(()=>{});
  await origen.end().catch(()=>{});if(destino)await destino.end().catch(()=>{});
  if(creada){
   const actual=(await admin.query('SELECT oid FROM pg_database WHERE datname=$1',[temporal])).rows[0];
   if(actual?.oid!==oid)throw Error('Identidad temporal cambió: no eliminar');
   await admin.query('DROP DATABASE '+temporal);
   console.log('Restauración temporal eliminada; respaldo privado conservado.');
  }
  await admin.end().catch(()=>{});
 }
}
main().catch(e=>{console.error('Verificación detenida: '+(e.code||e.message));process.exitCode=1;});
