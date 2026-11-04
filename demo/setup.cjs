// Ejecutar una sola vez. Nunca restaura ni reemplaza una base existente.
process.env.MERAKI_SUSCRIPCIONES_AUTOMATICAS = '0';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {raiz, backendRequire, archivo} = require('./config.cjs');
const {Pool} = backendRequire('pg');
const principal = backendRequire('dotenv').parse(fs.readFileSync(path.join(raiz, 'backend', '.env')));
const conexion = {host:principal.DB_HOST, port:Number(principal.DB_PORT), user:principal.DB_USER, password:principal.DB_PASSWORD};
const quote = s => '"' + s.replaceAll('"', '""') + '"';
async function huella(pool) {
    const datos = {};
    const tablas = (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows;
    for (const {table_name} of tablas) {
        datos[table_name] = (await pool.query(`SELECT count(*)::int AS filas, md5(COALESCE(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text)::text,'')) AS huella FROM public.${quote(table_name)} d`)).rows[0];
    }
    return datos;
}
async function main() {
    if (principal.DB_NAME !== 'meraki_db') throw Error('No se reconoce la base principal esperada; detener.');
    const admin = new Pool({...conexion, database:principal.DB_NAME, max:1});
    let demo;
    try {
        const existe = (await admin.query("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname='meraki_demo') AS base, EXISTS(SELECT 1 FROM pg_roles WHERE rolname='meraki_demo_lector') AS rol")).rows[0];
        if (existe.base || existe.rol || fs.existsSync(archivo)) throw Error('La base, el rol o la configuración demo ya existen. Detener: no se sobrescriben.');
        const antes = await huella(admin);
        const envAntes = crypto.createHash('sha256').update(fs.readFileSync(path.join(raiz,'backend','.env'))).digest('hex');
        const clave = crypto.randomBytes(32).toString('hex');
        // Clave generada exclusivamente con dígitos hexadecimales; no se registra.
        await admin.query(`CREATE ROLE meraki_demo_lector LOGIN PASSWORD '${clave}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION CONNECTION LIMIT 8`);
        await admin.query('ALTER ROLE meraki_demo_lector SET default_transaction_read_only = on');
        await admin.query("ALTER ROLE meraki_demo_lector SET search_path = public");
        await admin.query('CREATE DATABASE meraki_demo');
        await admin.query('REVOKE ALL ON DATABASE meraki_demo FROM PUBLIC');
        await admin.query('GRANT CONNECT ON DATABASE meraki_demo TO meraki_demo_lector');
        demo = new Pool({...conexion, database:'meraki_demo', max:1});
        if ((await demo.query('SELECT current_database() AS nombre')).rows[0].nombre !== 'meraki_demo') throw Error('Base demo incorrecta.');
        const db = await demo.connect();
        try {
            await db.query('BEGIN');
            for (const nombre of ['schema.sql','002_agregar_token_consulta.sql','003_notificaciones_correo.sql','004_fecha_inicio_envio.sql','005_revision_notificaciones.sql','006_correccion_correo_reserva.sql','007_nombre_reserva.sql','008_suscripcion_oneclick.sql']) {
                await db.query(fs.readFileSync(path.join(raiz, 'database', nombre), 'utf8'));
            }
            // Solo datos ficticios, sin restaurar información de meraki_db.
            const cuenta = (await db.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash) VALUES('Cuenta','Demostración','DEMO-SIN-RUT','demo@meraki.test','SIN_ACCESO') RETURNING id_emprendedora")).rows[0].id_emprendedora;
            const negocio = (await db.query("INSERT INTO emprendimiento(id_emprendedora,nombre,descripcion,direccion,comuna) VALUES($1,'Estudio Meraki — DEMO','Entorno ficticio para revisar el Front Office. No admite reservas ni pagos.','Dirección ficticia de demostración','Santiago') RETURNING id_emprendimiento",[cuenta])).rows[0].id_emprendimiento;
            const categoria = (await db.query("INSERT INTO categoria(nombre,descripcion) VALUES('Bienestar demo','Categoría ficticia') RETURNING id_categoria")).rows[0].id_categoria;
            const servicio = (await db.query("INSERT INTO servicio(id_emprendimiento,id_categoria,nombre,descripcion,precio,duracion_min,monto_abono) VALUES($1,$2,'Servicio de demostración','Sesión ficticia para probar selección de profesional, fecha y hora.',20000,60,5000) RETURNING id_servicio",[negocio,categoria])).rows[0].id_servicio;
            const profesional = (await db.query("INSERT INTO trabajadora(id_emprendimiento,nombre,apellido,descripcion) VALUES($1,'Profesional','Demo','Persona ficticia de demostración') RETURNING id_trabajadora",[negocio])).rows[0].id_trabajadora;
            await db.query('INSERT INTO trabajadora_servicio(id_trabajadora,id_servicio) VALUES($1,$2)',[profesional,servicio]);
            for (const dia of ['lunes','martes','miercoles','jueves','viernes','sabado','domingo']) {
                await db.query("INSERT INTO horario_atencion(id_trabajadora,dia_semana,hora_inicio,hora_fin) VALUES($1,$2,'09:00','18:00')",[profesional,dia]);
            }
            await db.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,fecha_fin_prueba,monto_mensual,estado,acceso_hasta,renovacion_automatica) VALUES($1,(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date,((CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date+INTERVAL '1 month')::date,9990,'prueba',((CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date+INTERVAL '1 month')::date,FALSE)",[cuenta]);
            await db.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
            await db.query('GRANT USAGE ON SCHEMA public TO meraki_demo_lector');
            await db.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO meraki_demo_lector');
            await db.query('COMMIT');
        } catch (e) { await db.query('ROLLBACK'); throw e; }
        finally { db.release(); }
        const config = {DB_HOST:principal.DB_HOST,DB_PORT:principal.DB_PORT,DB_NAME:'meraki_demo',DB_USER:'meraki_demo_lector',DB_PASSWORD:clave,PORT:'3001',SESSION_SECRET:crypto.randomBytes(32).toString('hex'),PUBLIC_BASE_URL:'http://localhost:3001',MAIL_PROVIDER:'disabled',MERAKI_SUSCRIPCIONES_AUTOMATICAS:'0'};
        fs.writeFileSync(archivo,Object.entries(config).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{flag:'wx',mode:0o600});
        const despues = await huella(admin);
        const intacta = JSON.stringify(antes) === JSON.stringify(despues);
        const envIntacto = envAntes === crypto.createHash('sha256').update(fs.readFileSync(path.join(raiz,'backend','.env'))).digest('hex');
        const privilegiosPrincipal = (await admin.query("SELECT count(*)::int AS tablas_accesibles FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND (has_table_privilege('meraki_demo_lector',quote_ident(table_schema)||'.'||quote_ident(table_name),'SELECT') OR has_table_privilege('meraki_demo_lector',quote_ident(table_schema)||'.'||quote_ident(table_name),'INSERT,UPDATE,DELETE'))")).rows[0].tablas_accesibles;
        fs.writeFileSync(archivo+'.audit.json',JSON.stringify({antes,despues,basePrincipalIntacta:intacta,envPrincipalIntacto:envIntacto,tablasPrincipalesAccesiblesAlRolDemo:privilegiosPrincipal},null,2),{flag:'wx',mode:0o600});
        if (!intacta || !envIntacto || privilegiosPrincipal !== 0) throw Error('La verificación de aislamiento requiere revisión. No iniciar el servidor.');
        console.log(JSON.stringify({creada:'meraki_demo',rol:'meraki_demo_lector',soloLectura:true,basePrincipalIntacta:intacta,envPrincipalIntacto:envIntacto,tablasPrincipalAccesibles:privilegiosPrincipal,configuracion:archivo}));
    } finally { if(demo) await demo.end(); await admin.end(); }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
