// Procedimiento administrativo local; nunca se monta como ruta HTTP.
process.env.MERAKI_SUSCRIPCIONES_AUTOMATICAS = '0';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {raiz, backendRequire, leerConfig} = require('./config.cjs');
const {Pool} = backendRequire('pg');
const privado = backendRequire('dotenv').parse(fs.readFileSync(path.join(raiz,'backend','.env')));
const config = leerConfig();
const principal = new Pool({host:privado.DB_HOST,port:Number(privado.DB_PORT),user:privado.DB_USER,password:privado.DB_PASSWORD,database:'meraki_db',max:1,options:'-c default_transaction_read_only=on'});
const demo = new Pool({host:config.DB_HOST,port:Number(config.DB_PORT),user:privado.DB_USER,password:privado.DB_PASSWORD,database:'meraki_demo',max:1});
async function huellas(pool) {
    const resultado = {};
    for (const {tablename} of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows) {
        const tabla='"'+tablename.replaceAll('"','""')+'"';
        resultado[tablename]=(await pool.query(`SELECT count(*)::int AS filas, md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'')) AS huella FROM public.${tabla} t`)).rows[0];
    }
    return resultado;
}
async function preparar() {
    const db = await demo.connect();
    try {
        const identidad=(await db.query('SELECT current_database() AS base')).rows[0].base;
        assert.equal(identidad,'meraki_demo');
        console.log('Conexión confirmada antes de escribir: meraki_demo. meraki_db: solo lectura.');
        assert.equal((await principal.query('SELECT current_database() AS base')).rows[0].base,'meraki_db');
        const antes=await huellas(principal);
        await db.query('BEGIN');
        await db.query('LOCK TABLE emprendimiento IN SHARE ROW EXCLUSIVE MODE');
        const existentes=(await db.query('SELECT * FROM emprendimiento ORDER BY id_emprendimiento')).rows;
        const original=existentes.find(n=>n.nombre==='Estudio Meraki — DEMO');
        assert(original,'Falta el negocio demo original; detener sin crear otro.');
        assert(existentes.every(n=>['Estudio Meraki — DEMO','Estudio Lavanda — DEMO FICTICIA','Estudio Marfil — DEMO FICTICIA'].includes(n.nombre)),'Negocios inesperados; detener.');
        assert(existentes.length<=3,'Cantidad inesperada; detener.');
        const sus=(await db.query("SELECT * FROM suscripcion WHERE id_emprendedora=$1 AND estado IN ('prueba','activa') AND acceso_hasta >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date AND renovacion_automatica=FALSE AND tarjeta_cifrada IS NULL AND usuario_oneclick IS NULL",[original.id_emprendedora])).rows;
        assert(sus.length===1,'La suscripción original requiere revisión; no se renueva automáticamente.');
        const categoria=(await db.query("SELECT id_categoria FROM categoria WHERE nombre='Bienestar demo'")).rows;
        assert.equal(categoria.length,1);
        await db.query("UPDATE emprendimiento SET latitud=-33.4489,longitud=-70.6693,direccion='Dirección ficticia DEMO Centro 100 (no visitar)',comuna='Santiago' WHERE id_emprendimiento=$1",[original.id_emprendimiento]);
        const nuevos=[];
        for (const dato of [
            {clave:'lavanda',nombre:'Estudio Lavanda — DEMO FICTICIA',comuna:'Providencia',direccion:'Dirección ficticia DEMO Lavanda 200 (no visitar)',lat:-33.425,lon:-70.615},
            {clave:'marfil',nombre:'Estudio Marfil — DEMO FICTICIA',comuna:'Maipú',direccion:'Dirección ficticia DEMO Marfil 300 (no visitar)',lat:-33.511,lon:-70.757}
        ]) {
            const existe=existentes.filter(n=>n.nombre===dato.nombre);
            assert(existe.length<=1,'Negocio duplicado; detener.');
            if(existe.length) {
                assert.equal(existe[0].comuna,dato.comuna);
                assert.equal(Number(existe[0].latitud),dato.lat); assert.equal(Number(existe[0].longitud),dato.lon);
                continue;
            }
            const cuenta=(await db.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash) VALUES('Cuenta','Demo cercanía',$1,$2,'SIN_ACCESO') RETURNING id_emprendedora",['DEMO-'+dato.clave,'demo-'+dato.clave+'@meraki.test'])).rows[0].id_emprendedora;
            const negocio=(await db.query("INSERT INTO emprendimiento(id_emprendedora,nombre,descripcion,direccion,comuna,latitud,longitud) VALUES($1,$2,'Negocio y ubicación ficticios para pruebas. No visitar; sin reservas ni pagos.',$3,$4,$5,$6) RETURNING id_emprendimiento",[cuenta,dato.nombre,dato.direccion,dato.comuna,dato.lat,dato.lon])).rows[0].id_emprendimiento;
            const servicio=(await db.query("INSERT INTO servicio(id_emprendimiento,id_categoria,nombre,descripcion,precio,duracion_min,monto_abono) VALUES($1,$2,'Servicio ficticio de demostración','Solo pruebas, no se presta este servicio.',20000,60,5000) RETURNING id_servicio",[negocio,categoria[0].id_categoria])).rows[0].id_servicio;
            const profesional=(await db.query("INSERT INTO trabajadora(id_emprendimiento,nombre,apellido,descripcion) VALUES($1,'Profesional','Ficticia','Persona ficticia DEMO') RETURNING id_trabajadora",[negocio])).rows[0].id_trabajadora;
            await db.query('INSERT INTO trabajadora_servicio(id_trabajadora,id_servicio) VALUES($1,$2)',[profesional,servicio]);
            for(const dia of ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'])await db.query("INSERT INTO horario_atencion(id_trabajadora,dia_semana,hora_inicio,hora_fin) VALUES($1,$2,'09:00','18:00')",[profesional,dia]);
            await db.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,fecha_fin_prueba,monto_mensual,estado,acceso_hasta,renovacion_automatica) VALUES($1,(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date,((CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date+INTERVAL '1 month')::date,9990,'prueba',((CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date+INTERVAL '1 month')::date,FALSE)",[cuenta]);
            nuevos.push(dato.nombre);
        }
        assert.equal((await db.query('SELECT count(*)::int AS n FROM emprendimiento')).rows[0].n,3);
        assert.equal((await db.query("SELECT count(*)::int AS n FROM suscripcion WHERE renovacion_automatica OR tarjeta_cifrada IS NOT NULL OR usuario_oneclick IS NOT NULL")).rows[0].n,0);
        assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND has_table_privilege('meraki_demo_lector',quote_ident(table_schema)||'.'||quote_ident(table_name),'INSERT,UPDATE,DELETE')")).rows[0].n,0);
        assert.deepEqual(await huellas(principal),antes,'Datos principales cambiaron; detener antes de confirmar la demo.');
        await db.query('COMMIT');
        assert.deepEqual(await huellas(principal),antes);
        console.log(JSON.stringify({base:'meraki_demo',creados:nuevos,total:3,principalIntacta:true,reservasPrincipal:antes.reserva.filas,abonosPrincipal:antes.abono.filas,clientasPrincipal:antes.clienta.filas,lectorSinEscrituras:true}));
    } catch(e) { await db.query('ROLLBACK'); throw e; }
    finally {db.release(); await demo.end(); await principal.end();}
}
preparar().catch(()=>{console.error('Preparación detenida: verificar condiciones y conexión; no se imprimen datos privados.');process.exitCode=1;});
