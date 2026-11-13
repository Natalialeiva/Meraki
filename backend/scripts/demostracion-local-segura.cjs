// Inicia el Meraki original con PostgreSQL efímero. No contiene otra interfaz.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {randomBytes,randomUUID}=require('node:crypto');
const {Client,Pool}=require('pg');
const raiz=path.join(__dirname,'../..');
const verificar=process.argv.includes('--verificar');
async function ejecutar(){
    // No detener ni reemplazar un servidor que ya exista.
    await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(3000,'127.0.0.1',()=>s.close(resolve));});
    const privado=require('dotenv').parse(fs.readFileSync(path.join(raiz,'backend/.env')));
    if(!['localhost','127.0.0.1','::1'].includes(privado.DB_HOST))throw Object.assign(Error(),{code:'POSTGRESQL_DEBE_SER_LOCAL'});
    const conexion={host:privado.DB_HOST,port:Number(privado.DB_PORT),user:privado.DB_USER,password:privado.DB_PASSWORD};
    const base='meraki_muestra_'+Date.now()+'_'+randomBytes(4).toString('hex');
    if(!/^meraki_muestra_\d+_[a-f0-9]{8}$/.test(base))throw Error('Nombre temporal inválido');
    const admin=new Client({...conexion,database:'postgres',application_name:'meraki_muestra_creador'});
    let creada=false,oid,fixture,pool,servidor,store;
    let detener;const hastaDetener=new Promise(resolve=>detener=resolve);
    const cerrar=()=>detener();process.once('SIGINT',cerrar);process.once('SIGTERM',cerrar);
    const http=require('node:http'),https=require('node:https');
    const originales=[http.request,https.request,global.fetch];
    const local=host=>['127.0.0.1','localhost','::1','[::1]'].includes(host);
    try{
        await admin.connect();
        if((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[base])).rowCount)throw Error('La base temporal ya existe');
        await admin.query('CREATE DATABASE '+base+' TEMPLATE template0');creada=true;
        oid=(await admin.query('SELECT oid FROM pg_database WHERE datname=$1',[base])).rows[0].oid;
        fixture=new Pool({...conexion,database:base,options:'-c timezone=America/Santiago'});
        if((await fixture.query('SELECT current_database() nombre')).rows[0].nombre!==base)throw Error('Destino incorrecto');
        console.log('Base efímera confirmada: '+base+'. No se utilizarán meraki_db ni meraki_demo.');
        for(const archivo of ['schema.sql','migracion_abonos_reintentos.sql','002_agregar_token_consulta.sql',
            '003_notificaciones_correo.sql','004_fecha_inicio_envio.sql','005_revision_notificaciones.sql',
            '006_correccion_correo_reserva.sql','007_clienta_correo_unico.sql','007_nombre_reserva.sql',
            '008_suscripcion_oneclick.sql','009_intentos_webpay.sql','010_procesamiento_webpay.sql']){
            await fixture.query(fs.readFileSync(path.join(raiz,'database',archivo),'utf8'));
        }
        const clave='Meraki-Demo-Local!';
        const hash=await require('bcrypt').hash(clave,8);
        for(const [n,comuna] of [[1,'Santiago'],[2,'Providencia']]){
            await fixture.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash) VALUES($1,'Ficticia',$2,$3,$4)",['Cuenta '+n,'DEMOSTRACION-'+n,'demo'+n+'@example.test',hash]);
            await fixture.query('INSERT INTO emprendimiento(id_emprendedora,nombre,comuna,direccion) VALUES($1,$2,$3,$4)',[n,'Demostración ficticia '+n,comuna,'Dirección ficticia '+n]);
            await fixture.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,estado,monto_mensual,acceso_hasta) VALUES($1,CURRENT_DATE,'prueba',9990,'2099-01-01')",[n]);
        }
        await fixture.query("INSERT INTO categoria(nombre) VALUES('Manicure'),('Peluquería')");
        await fixture.query("INSERT INTO servicio(id_emprendimiento,id_categoria,nombre,precio,duracion_min,monto_abono) VALUES(1,1,'Manicure ficticia',20000,60,5000),(1,2,'Corte ficticio',15000,60,5000),(2,1,'Servicio ficticio',20000,60,5000)");
        await fixture.query("INSERT INTO trabajadora(id_emprendimiento,nombre) VALUES(1,'Profesional Uno'),(1,'Profesional Dos'),(2,'Profesional Tres')");
        await fixture.query('INSERT INTO trabajadora_servicio VALUES(1,1),(2,2),(3,3)');
        await fixture.query("INSERT INTO horario_atencion(id_trabajadora,dia_semana,hora_inicio,hora_fin) SELECT t.id_trabajadora,dia,'09:00','18:00' FROM trabajadora t CROSS JOIN unnest(ARRAY['lunes','martes','miercoles','jueves','viernes','sabado','domingo']) dia");
        await fixture.query("INSERT INTO clienta(nombre,correo) VALUES('Contacto ficticio','contacto@example.test')");
        const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        const manana=new Date(hoy+'T12:00:00Z');manana.setUTCDate(manana.getUTCDate()+1);const fecha=manana.toISOString().slice(0,10);
        // Estos estados son fixtures, no resultados de pagos.
        for(const [servicio,persona,hora,estado] of [[1,1,'09:00','confirmada'],[2,2,'10:00','pendiente_abono'],[1,1,'11:00','cancelada']]){
            await fixture.query(`INSERT INTO reserva(id_emprendimiento,id_servicio,id_trabajadora,id_clienta,fecha_hora_inicio,fecha_hora_fin,estado,precio_servicio,monto_abono,token_consulta,nombre_clienta)
              VALUES(1,$1,$2,1,$3::date+$4::time,$3::date+$4::time+interval '1 hour',$5,(SELECT precio FROM servicio WHERE id_servicio=$1),(SELECT monto_abono FROM servicio WHERE id_servicio=$1),$6,'Contacto ficticio')`,[servicio,persona,fecha,hora,estado,randomUUID()]);
        }
        const ayer=new Date(hoy+'T12:00:00Z');ayer.setUTCDate(ayer.getUTCDate()-1);
        await fixture.query(`INSERT INTO reserva(id_emprendimiento,id_servicio,id_trabajadora,id_clienta,fecha_hora_inicio,fecha_hora_fin,estado,precio_servicio,monto_abono,token_consulta,nombre_clienta)
          VALUES(1,1,1,1,$1::date+time '14:00',$1::date+time '15:00','confirmada',20000,5000,$2,'Contacto ficticio')`,[ayer.toISOString().slice(0,10),randomUUID()]);
        await fixture.end();fixture=null;
        // Configuración solo del proceso. El archivo .env queda intacto.
        Object.assign(process.env,{DB_HOST:conexion.host,DB_PORT:String(conexion.port),DB_USER:conexion.user,DB_PASSWORD:conexion.password,
            DB_NAME:base,PORT:'3000',MERAKI_SUSCRIPCIONES_AUTOMATICAS:'0',SESSION_SECRET:randomBytes(32).toString('hex'),
            PGOPTIONS:'-c timezone=America/Santiago -c statement_timeout=15000',PUBLIC_BASE_URL:'http://localhost:3000'});
        const bloqueado=async()=>{const e=Error('Proveedor deshabilitado en demostración local');e.code='ECONFIG';throw e;};
        // Inyección exclusiva de este proceso, sin editar los módulos compartidos.
        const correo=require('../correo');require.cache[require.resolve('../correo')].exports={...correo,enviarConfirmacionReserva:bloqueado};
        const oneclick=require('../oneclick');require.cache[require.resolve('../oneclick')].exports={...oneclick,crearOneclick:()=>({ambiente:'integracion',iniciar:bloqueado,finalizar:bloqueado,autorizar:bloqueado,consultar:bloqueado,eliminar:bloqueado})};
        const fabrica=require('connect-pg-simple');require.cache[require.resolve('connect-pg-simple')].exports=session=>{
            const Original=fabrica(session);return class extends Original{constructor(opciones){super({...opciones,pruneSessionInterval:false});store=this;}};
        };
        for(const [mod,original] of [[http,originales[0]],[https,originales[1]]])mod.request=function(opciones,...args){
            const host=typeof opciones==='string'||opciones instanceof URL?new URL(opciones).hostname:opciones.hostname||opciones.host||'localhost';
            if(!local(host))throw Error('Red externa deshabilitada');return original.call(this,opciones,...args);
        };
        global.fetch=(input,opciones)=>{if(!local(new URL(typeof input==='string'||input instanceof URL?input:input.url).hostname))throw Error('Red externa deshabilitada');return originales[2](input,opciones);};
        const app=require('../index');pool=require('../db');
        if((await pool.query('SELECT current_database() nombre')).rows[0].nombre!==base)throw Error('El backend no apunta a la base efímera');
        const envoltura=require('express')();
        envoltura.use((req,res,next)=>{
            const financiero=/^\/api\/(?:abonos|webpay)(?:\/|$)/.test(req.path)||
                /^\/api\/suscripcion(?:\/|$)/.test(req.path)&&!(req.method==='GET'&&req.path==='/api/suscripcion')||
                /^\/api\/notificaciones(?:\/|$)/.test(req.path)&&req.method!=='GET';
            if(financiero)return res.status(403).json({mensaje:'Operación externa bloqueada en la demostración ficticia.'});
            next();
        });
        envoltura.use(app);
        servidor=await new Promise((resolve,reject)=>{const s=envoltura.listen(3000,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
        console.log('Meraki ORIGINAL: http://localhost:3000/front-office/ y http://localhost:3000/back-office/');
        console.log('SOLO DATOS FICTICIOS. Acceso: demo1@example.test / '+clave+'. Fecha de ejemplo: '+fecha);
        console.log('Pagos, Oneclick, correos y renovaciones bloqueados. Ctrl+C detiene y elimina esta base efímera.');
        if(verificar){
            let comprobaciones=0;const comprobar=async(ruta,codigo,opciones)=>{const r=await fetch('http://127.0.0.1:3000'+ruta,opciones);if(r.status!==codigo)throw Error('Respuesta inesperada en '+ruta);comprobaciones++;return r;};
            for(const ruta of ['/front-office/','/back-office/','/consulta/','/front-office/front.js','/front-office/styles.css',
                '/back-office/back.js','/back-office/gestion.css','/back-office/presentacion-reservas.js','/back-office/estadisticas-reservas.js',
                '/api/estado-db','/api/categorias','/api/emprendimientos'])await comprobar(ruta,200);
            await comprobar('/api/auth/yo',401);
            const acceso=await comprobar('/api/auth/login',200,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({correo:'demo1@example.test',password:clave})});
            const cookie=acceso.headers.get('set-cookie').split(';')[0];
            const agenda=await comprobar('/api/reservas?id_emprendimiento=1',200,{headers:{Cookie:cookie}});
            const filas=await agenda.json();if(filas.length!==4||filas.some(r=>!r.id_servicio||!r.id_trabajadora)||filas.filter(r=>r.puede_cerrar===true).length!==1)throw Error('Agenda incompleta');
            await comprobar('/api/abonos/cliente/iniciar',403,{method:'POST'});
            await comprobar('/api/suscripcion/inscribir',403,{method:'POST'});
            await comprobar('/api/notificaciones/1/reintentar',403,{method:'POST'});
            await comprobar('/api/auth/logout',200,{method:'POST',headers:{Cookie:cookie}});
            console.log('Arranque original verificado: '+comprobaciones+' comprobaciones aprobadas.');
        }else await hastaDetener;
    }finally{
        process.removeListener('SIGINT',cerrar);process.removeListener('SIGTERM',cerrar);
        if(servidor){servidor.closeIdleConnections();await new Promise((resolve,reject)=>servidor.close(e=>e?reject(e):resolve()));}
        if(store)store.close();if(pool)await pool.end();if(fixture)await fixture.end();
        http.request=originales[0];https.request=originales[1];global.fetch=originales[2];
        if(creada){
            if((await admin.query('SELECT oid FROM pg_database WHERE datname=$1',[base])).rows[0]?.oid!==oid)throw Error('La base temporal fue reemplazada; no eliminar');
            await admin.query('DROP DATABASE '+base);
            if((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[base])).rowCount)throw Error('No se confirmó la eliminación');
            console.log('Base efímera eliminada y ausencia verificada: '+base);
        }
        await admin.end();
    }
}
ejecutar().catch(e=>{console.error('No se pudo completar la demostración: '+(e.code||'ERROR_CONTROLADO')+'. Si el puerto 3000 está ocupado, no se detuvo su proceso.');process.exitCode=1;});
