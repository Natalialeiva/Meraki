process.env.MERAKI_SUSCRIPCIONES_AUTOMATICAS='0';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {raiz,backendRequire,leerConfig,archivo}=require('./config.cjs');
const {Pool}=backendRequire('pg');
const principal=backendRequire('dotenv').parse(fs.readFileSync(path.join(raiz,'backend','.env')));
const config=leerConfig();
const main=new Pool({host:principal.DB_HOST,port:Number(principal.DB_PORT),database:principal.DB_NAME,user:principal.DB_USER,password:principal.DB_PASSWORD,max:1});
const lector=new Pool({host:config.DB_HOST,port:Number(config.DB_PORT),database:config.DB_NAME,user:config.DB_USER,password:config.DB_PASSWORD,max:1});
const quote=s=>'"'+s.replaceAll('"','""')+'"';
async function huellas(pool){
    const o={};
    for(const {table_name} of (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows){
        o[table_name]=(await pool.query(`SELECT count(*)::int AS filas,md5(COALESCE(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text)::text,'')) AS huella FROM public.${quote(table_name)} d`)).rows[0];
    }
    return o;
}
async function get(ruta){const r=await fetch('http://localhost:3001'+ruta);assert.equal(r.status,200,ruta);return r.json();}
(async()=>{
    const antes=await huellas(main),demoAntes=await huellas(lector);
    const db=await get('/api/estado-db');assert.equal(db.base_datos,'meraki_demo');
    const negocios=await get('/api/emprendimientos');assert.equal(negocios.length,1);
    const servicios=await get('/api/emprendimientos/'+negocios[0].id_emprendimiento+'/servicios');assert.equal(servicios.length,1);assert.equal(servicios[0].reservable,true);
    const profesionales=await get('/api/servicios/'+servicios[0].id_servicio+'/trabajadoras');assert.equal(profesionales.length,1);
    const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const siguiente=new Date(hoy+'T12:00:00Z');siguiente.setUTCDate(siguiente.getUTCDate()+1);const fecha=siguiente.toISOString().slice(0,10);
    const horas=await get('/api/disponibilidad?'+new URLSearchParams({id_servicio:servicios[0].id_servicio,id_trabajadora:profesionales[0].id_trabajadora,fecha}));assert.equal(horas.length,9);
    const bloqueadas=[];
    for(const [metodo,ruta] of [['POST','/api/clientas'],['POST','/api/reservas'],['POST','/api/abonos/cliente/iniciar'],['POST','/api/abonos/1/recuperar'],['GET','/api/abonos/retorno?token_ws=DEMO'],['POST','/api/suscripcion/inscribir'],['POST','/api/suscripcion/reintentar'],['GET','/api/suscripcion/retorno?TBK_TOKEN=DEMO'],['POST','/api/notificaciones/1/reintentar'],['POST','/api/servicios'],['PATCH','/api/trabajadoras/1'],['DELETE','/api/horarios/1'],['POST','/api/bloqueos'],['POST','/api/auth/login']]){
        const r=await fetch('http://localhost:3001'+ruta,{method:metodo,headers:{'Content-Type':'application/json'},body:metodo==='GET'?undefined:JSON.stringify({id_servicio:servicios[0].id_servicio})});
        assert.equal(r.status,405,ruta);assert.equal((await r.json()).codigo,'DEMO_SOLO_LECTURA');bloqueadas.push(metodo+' '+ruta);
    }
    // Sentencia sin filas afectables: PostgreSQL debe rechazarla antes de ejecutarla.
    await assert.rejects(lector.query('UPDATE servicio SET nombre=nombre WHERE FALSE'),e=>e.code==='25006'||e.code==='42501');
    const accesoPrincipal=new Pool({host:config.DB_HOST,port:Number(config.DB_PORT),database:'meraki_db',user:config.DB_USER,password:config.DB_PASSWORD,max:1});
    try{await assert.rejects(accesoPrincipal.query('SELECT 1 FROM public.reserva LIMIT 0'),e=>e.code==='42501');}finally{await accesoPrincipal.end();}
    const estado=await get('/demo/estado');assert.deepEqual(estado.intentosExternos,{webpay:0,oneclick:0,correo:0});assert.equal(estado.renovacionesAutomaticas,false);
    const sus=(await lector.query('SELECT renovacion_automatica,tarjeta_cifrada,usuario_oneclick FROM suscripcion')).rows;
    assert.equal(sus.length,1);assert.equal(sus[0].renovacion_automatica,false);assert.equal(sus[0].tarjeta_cifrada,null);assert.equal(sus[0].usuario_oneclick,null);
    const despues=await huellas(main),demoDespues=await huellas(lector);
    assert.deepEqual(antes,despues);assert.deepEqual(demoAntes,demoDespues);
    const auditoria=JSON.parse(fs.readFileSync(archivo+'.audit.json'));assert.deepEqual(auditoria.antes,despues);
    const resultado={basePrincipalIntactaDesdePreparacion:true,demoSinEscrituras:true,reservasPrincipal:despues.reserva.filas,abonosPrincipal:despues.abono.filas,clientasPrincipal:despues.clienta.filas,servicioReservable:true,profesionales:profesionales.length,horariosDisponibles:horas.length,fechaComprobada:fecha,rutasBloqueadas:bloqueadas,intentosExternos:estado.intentosExternos,lectorSinAccesoATablasPrincipales:true};
    fs.writeFileSync(archivo+'.verify.json',JSON.stringify(resultado,null,2));console.log(JSON.stringify(resultado));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{await main.end();await lector.end();});
