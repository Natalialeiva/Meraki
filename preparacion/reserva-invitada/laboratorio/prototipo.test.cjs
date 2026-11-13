const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const {crearLaboratorio}=require('./prototipo.cjs');
const raiz=path.resolve(__dirname,'../../..');
const real=createRequire(path.join(raiz,'backend/index.js'));
const {Client,Pool}=real('pg'),express=real('express'),request=real('supertest');

test('Diseño de invitadas: laboratorio PostgreSQL exclusivo, sin rutas de producción modificadas',{
    skip:process.env.MERAKI_INVITADA_LAB!=='1',timeout:120000
},async t=>{
    const protegidos=['backend/index.js','backend/test/consulta.test.js','frontend/consulta/consulta.js',
        'backend/test/mvp-lectura.test.js','backend/test/mvp-postgres-aislado.test.js',
        'docs/VERIFICACION-MVP-ADRIANA.md','docs/PRUEBA-MVP-POSTGRESQL-AISLADO.md'];
    const huellas=()=>protegidos.map(f=>createHash('sha256').update(fs.readFileSync(path.join(raiz,f))).digest('hex'));
    const previo=huellas();
    const env=real('dotenv').parse(fs.readFileSync(path.join(raiz,'backend/.env')));
    const config={host:env.DB_HOST,port:Number(env.DB_PORT),user:env.DB_USER,password:env.DB_PASSWORD};
    assert(['localhost','127.0.0.1','::1'].includes(config.host));
    const nombre='meraki_invitada_lab_'+Date.now()+'_'+randomBytes(4).toString('hex');
    assert.match(nombre,/^meraki_invitada_lab_\d+_[a-f0-9]{8}$/);
    const admin=new Client({...config,database:'postgres',application_name:'meraki_diseno_invitada'});
    let creada=false,oid,pool;
    const fuente=fs.readFileSync(path.join(raiz,'backend/index.js'),'utf8');
    const extraer=marca=>{const i=fuente.indexOf(marca);assert(i>=0);const f=fuente.indexOf('\n});',i);assert(f>i);return fuente.slice(i,f+5);};
    const contar=async()=> (await pool.query(`SELECT (SELECT count(*)::int FROM reserva) reservas,
      (SELECT count(*)::int FROM contacto_reserva_invitada) contactos,
      (SELECT count(*)::int FROM intento_reserva_invitada) intentos`)).rows[0];
    try{
        await admin.connect();assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[nombre])).rowCount,0);
        await admin.query('CREATE DATABASE '+nombre+' TEMPLATE template0');creada=true;
        oid=(await admin.query('SELECT oid FROM pg_database WHERE datname=$1',[nombre])).rows[0].oid;
        pool=new Pool({...config,database:nombre,options:'-c timezone=America/Santiago -c statement_timeout=15000'});
        assert.equal((await pool.query('SELECT current_database() base')).rows[0].base,nombre);
        t.diagnostic('Destino exclusivo confirmado: '+nombre);
        for(const f of ['schema.sql','migracion_abonos_reintentos.sql','002_agregar_token_consulta.sql',
            '003_notificaciones_correo.sql','004_fecha_inicio_envio.sql','005_revision_notificaciones.sql',
            '006_correccion_correo_reserva.sql','007_clienta_correo_unico.sql','007_nombre_reserva.sql',
            '008_suscripcion_oneclick.sql','009_intentos_webpay.sql','010_procesamiento_webpay.sql'])await pool.query(fs.readFileSync(path.join(raiz,'database',f),'utf8'));
        await pool.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash) VALUES('Dueña','Ficticia','FICTICIO-1','duena@example.test','SIN_LOGIN'),('Otra','Ficticia','FICTICIO-2','otra@example.test','SIN_LOGIN')");
        await pool.query("INSERT INTO emprendimiento(id_emprendedora,nombre) VALUES(1,'Negocio ficticio'),(2,'Otro ficticio')");
        await pool.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,estado,monto_mensual,acceso_hasta) VALUES(1,CURRENT_DATE,'prueba',9990,'2099-01-01')");
        await pool.query("INSERT INTO categoria(nombre) VALUES('Categoría ficticia')");
        await pool.query("INSERT INTO servicio(id_emprendimiento,id_categoria,nombre,precio,duracion_min,monto_abono) VALUES(1,1,'Servicio ficticio',20000,60,5000)");
        await pool.query("INSERT INTO trabajadora(id_emprendimiento,nombre) VALUES(1,'Profesional ficticia')");
        await pool.query('INSERT INTO trabajadora_servicio VALUES(1,1)');
        await pool.query("INSERT INTO horario_atencion(id_trabajadora,dia_semana,hora_inicio,hora_fin) SELECT 1,dia,'09:00','19:00' FROM unnest(ARRAY['lunes','martes','miercoles','jueves','viernes','sabado','domingo']) dia");
        await pool.query("INSERT INTO clienta(nombre,correo,telefono) VALUES('Titular histórica ficticia','existente@example.test','000000')");
        await pool.query("INSERT INTO reserva(id_emprendimiento,id_servicio,id_trabajadora,id_clienta,fecha_hora_inicio,fecha_hora_fin,precio_servicio,monto_abono,token_consulta) VALUES(1,1,1,1,'2030-11-18 09:00','2030-11-18 10:00',20000,5000,$1)",[randomUUID()]);
        const historico=(await pool.query('SELECT to_jsonb(r) datos FROM reserva r WHERE id_reserva=1')).rows[0].datos;
        const clienta=(await pool.query('SELECT to_jsonb(c) datos FROM clienta c WHERE id_clienta=1')).rows[0].datos;
        await pool.query(fs.readFileSync(path.join(__dirname,'propuesta.sql'),'utf8'));
        const i=fuente.indexOf('const disponibilidad = await clienteDB.query(`');assert(i>=0);
        const inicio=fuente.indexOf('`',i)+1,fin=fuente.indexOf('`',inicio),sqlTurno=fuente.slice(inicio,fin);
        let fallo=false,reloj=Date.now();const secreto=randomBytes(32).toString('hex');
        const opciones={pool,secreto,ahora:()=>reloj,trasContacto:async()=>{if(fallo)throw Error('Fallo transaccional ficticio');},consultarTurno:async(db,d)=>{
            const futura=(await db.query("SELECT $1::date+$2::time>CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' futura",[d.fecha,d.hora])).rows[0].futura;
            if(!futura)return null;
            const dias=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
            return (await db.query(sqlTurno,[d.fecha,dias[new Date(d.fecha+'T00:00:00Z').getUTCDay()],d.id_trabajadora,d.id_servicio,d.hora])).rows[0]||null;
        }};
        let lab=crearLaboratorio(opciones),perderRespuesta=false;
        const app=express();app.use(express.json());
        app.post('/laboratorio/contexto',(req,res)=>res.cookie('meraki_invitada_lab',lab.emitirContexto(),{httpOnly:true,sameSite:'lax',path:'/laboratorio',maxAge:7*86400000}).sendStatus(204));
        app.post('/laboratorio/reservas',async(req,res)=>{
            const cookie=(req.headers.cookie||'').split('; ').find(c=>c.startsWith('meraki_invitada_lab='));
            try{
                const salida=await lab.crear({contexto:cookie?decodeURIComponent(cookie.split('=')[1]):'',clave:req.get('Idempotency-Key'),body:req.body});
                if(perderRespuesta){perderRespuesta=false;req.socket.destroy();return;}
                res.set('Cache-Control','no-store');res.status(salida.http).json(salida.cuerpo);
            }catch(e){res.status(e.http||503).json({codigo:e.codigo||'RESULTADO_NO_CONFIRMADO'});}
        });
        // Consumidores originales extraídos sin editar index.js. La sesión de
        // propietaria es un stub explícito: su autenticación real se probó en MVP.
        app.use((req,res,next)=>{req.session={idEmprendedora:Number(req.get('X-Lab-Propietaria')||0)};next();});
        const ctx={app,pool,console:{error(){}},process:{env:{}},urlRetornoVisual:()=>null,
            verificarSesion:(req,res,next)=>req.session.idEmprendedora?next():res.sendStatus(401)};
        for(const marca of ['app.get("/api/reservas/consulta/:token"','app.patch("/api/reservas/consulta/:token/cancelar"','app.get("/api/reservas",'])vm.runInNewContext(extraer(marca),ctx);
        const vieja=extraer('app.get("/api/reservas",');
        const nueva=vieja.replace('"/api/reservas"','"/laboratorio/agenda-propuesta"')
            .replace('COALESCE(r.nombre_clienta,c.nombre)','COALESCE(r.nombre_clienta,ci.nombre,c.nombre)')
            .replace(/INNER JOIN clienta c\s+ON r.id_clienta = c.id_clienta/,'LEFT JOIN clienta c ON r.id_clienta=c.id_clienta LEFT JOIN contacto_reserva_invitada ci ON ci.id_reserva=r.id_reserva');
        assert(nueva.includes('LEFT JOIN contacto_reserva_invitada'));vm.runInNewContext(nueva,ctx);
        const web=request(app),a=request.agent(app),b=request.agent(app);
        await a.post('/laboratorio/contexto').expect(204);await b.post('/laboratorio/contexto').expect(204);
        const body=(hora,correo='nuevo@example.test')=>({contacto:{nombre:'Contacto declarado',correo,telefono:null},id_servicio:1,id_trabajadora:1,fecha:'2030-11-18',hora});
        const crear=(agente,clave,d)=>agente.post('/laboratorio/reservas').set('Idempotency-Key',clave).send(d);
        let primera,clavePrimera=randomUUID(),simultanea,claveSimultanea=randomUUID();
        await t.test('Propuesta preserva registros históricos y clientas sin alterarlos',async()=>{
            assert.deepEqual((await pool.query('SELECT to_jsonb(r) datos FROM reserva r WHERE id_reserva=1')).rows[0].datos,historico);
            assert.deepEqual((await pool.query('SELECT to_jsonb(c) datos FROM clienta c WHERE id_clienta=1')).rows[0].datos,clienta);
        });
        await t.test('Contacto nuevo y reserva se confirman juntos sin devolver id_clienta',async()=>{
            primera=(await crear(a,clavePrimera,body('10:00')).expect(201)).body.reserva;
            assert.equal(primera.estado,'pendiente_abono');assert.equal(primera.monto_abono,'5000.00');
            assert(!('id_clienta' in primera));assert.match(primera.token_consulta,/^[a-f0-9-]{36}$/i);
            const r=(await pool.query('SELECT r.id_clienta,c.correo FROM reserva r JOIN contacto_reserva_invitada c USING(id_reserva) WHERE r.id_reserva=$1',[primera.id_reserva])).rows[0];
            assert.deepEqual(r,{id_clienta:null,correo:'nuevo@example.test'});
        });
        await t.test('Correo existente mantiene el mismo contrato y no vincula ni modifica a su titular',async()=>{
            const r=(await crear(a,randomUUID(),body('11:00',' EXISTENTE@example.test ')).expect(201)).body;
            assert.deepEqual(Object.keys(r.reserva).sort(),Object.keys(primera).sort());
            assert.equal((await pool.query('SELECT id_clienta FROM reserva WHERE id_reserva=$1',[r.reserva.id_reserva])).rows[0].id_clienta,null);
            assert.deepEqual((await pool.query('SELECT to_jsonb(c) datos FROM clienta c WHERE id_clienta=1')).rows[0].datos,clienta);
            assert.equal((await pool.query('SELECT count(*)::int n FROM clienta')).rows[0].n,1);
        });
        await t.test('ID manipulado, campos impuestos, contexto ausente y clave inválida se rechazan',async()=>{
            const antes=await contar();
            for(const d of [{...body('12:00'),id_clienta:1},{...body('12:00'),monto_abono:1},{...body('12:00'),contacto:{...body('12:00').contacto,id_clienta:1}}])await crear(a,randomUUID(),d).expect(400);
            await crear(web,randomUUID(),body('12:00')).expect(401);
            await crear(a,'invalida',body('12:00')).expect(400);
            assert.deepEqual(await contar(),antes);
        });
        await t.test('Dos solicitudes simultáneas con misma clave recuperan una sola reserva',async()=>{
            const r=await Promise.all([crear(a,claveSimultanea,body('12:00')),crear(a,claveSimultanea,body('12:00'))]);
            assert.deepEqual(r.map(r=>r.status).sort(),[200,201]);assert.deepEqual(r[0].body,r[1].body);simultanea=r[0].body.reserva;
            assert.equal((await pool.query('SELECT count(*)::int n FROM reserva WHERE fecha_hora_inicio=$1::timestamp',['2030-11-18T12:00'])).rows[0].n,1);
        });
        await t.test('Misma clave con contenido diferente se rechaza sin nuevas escrituras',async()=>{
            const antes=await contar();const r=await crear(a,claveSimultanea,body('13:00')).expect(409);
            assert.equal(r.body.codigo,'CLAVE_CONTENIDO_DISTINTO');assert.deepEqual(await contar(),antes);
        });
        await t.test('Dos claves por el mismo horario crean una reserva y rechazo durable',async()=>{
            const k1=randomUUID(),k2=randomUUID();
            const r=await Promise.all([crear(a,k1,body('13:00')),crear(a,k2,body('13:00'))]);
            assert.deepEqual(r.map(r=>r.status).sort(),[201,409]);
            const perdedora=r[0].status===409?k1:k2;
            const antes=await contar();await crear(a,perdedora,body('13:00')).expect(409);assert.deepEqual(await contar(),antes);
        });
        await t.test('Fallo después de insertar contacto revierte contacto, reserva e intento',async()=>{
            const antes=await contar();fallo=true;
            try{await crear(a,randomUUID(),body('14:00')).expect(503);}finally{fallo=false;}
            assert.deepEqual(await contar(),antes);
        });
        await t.test('Respuesta perdida después del COMMIT se recupera con la misma clave',async()=>{
            const key=randomUUID();perderRespuesta=true;
            await assert.rejects(async()=>{await crear(a,key,body('14:00'));});
            const antes=await contar();const r=await crear(a,key,body('14:00')).expect(200);
            assert(r.body.reserva.id_reserva);assert.deepEqual(await contar(),antes);
        });
        await t.test('Reinicio del servicio conserva idempotencia en PostgreSQL',async()=>{
            lab=crearLaboratorio(opciones);const r=await crear(a,clavePrimera,body('10:00')).expect(200);
            assert.equal(r.body.reserva.id_reserva,primera.id_reserva);assert.equal(r.body.reserva.token_consulta,primera.token_consulta);
        });
        await t.test('Otro contexto no recupera el token usando la misma clave y datos',async()=>{
            const r=await crear(b,clavePrimera,body('10:00')).expect(409);
            assert(!JSON.stringify(r.body).includes(primera.token_consulta));assert(!r.body.reserva);
        });
        await t.test('Consulta privada original conserva el horario civil y no exige id_clienta',async()=>{
            const r=(await web.get('/api/reservas/consulta/'+primera.token_consulta).expect(200)).body;
            assert.equal(r.reserva.fecha_hora_inicio_civil,'2030-11-18T10:00:00');
            assert.equal(r.reserva.zona_horaria,'America/Santiago');assert(!('id_clienta' in r.reserva));
        });
        await t.test('Cancelación original funciona y el replay conserva el estado actualizado',async()=>{
            await web.patch('/api/reservas/consulta/'+primera.token_consulta+'/cancelar').expect(200);
            const r=await crear(a,clavePrimera,body('10:00')).expect(200);assert.equal(r.body.reserva.estado,'cancelada');
        });
        await t.test('Agenda antigua omite invitadas; la adaptación propuesta conserva históricas e IDs',async()=>{
            const vieja=(await web.get('/api/reservas?id_emprendimiento=1').set('X-Lab-Propietaria','1').expect(200)).body;
            assert.equal(vieja.length,1);assert.equal(vieja[0].id_reserva,1);
            const nueva=(await web.get('/laboratorio/agenda-propuesta?id_emprendimiento=1').set('X-Lab-Propietaria','1').expect(200)).body;
            assert.equal(nueva.length,(await contar()).reservas);
            assert(nueva.some(r=>r.id_reserva===primera.id_reserva&&r.clienta==='Contacto declarado'&&r.id_servicio===1&&r.id_trabajadora===1));
            await web.get('/laboratorio/agenda-propuesta?id_emprendimiento=1').set('X-Lab-Propietaria','2').expect(403);
        });
        await t.test('Abono y procesamiento originales funcionan con proveedor y notificaciones simulados',async()=>{
            let llamadas=0,entregas=0,remoto;
            const proveedor={async create(orden,sesion,monto){llamadas++;remoto={buy_order:orden,amount:monto,status:'AUTHORIZED',response_code:0,authorization_code:'FICTICIO'};return {token:'x'.repeat(64),url:'https://webpay3gint.transbank.cl/webpayserver/initTransaction'};},async commit(){llamadas++;return remoto;},async status(){throw Error('No se necesita consultar al proveedor');}};
            // Adaptación SOLO en memoria del lector de contacto de notificaciones.
            const original=fs.readFileSync(path.join(raiz,'backend/notificaciones.js'),'utf8');
            const propuesta=original.replace('COALESCE(r.nombre_clienta,c.nombre)','COALESCE(r.nombre_clienta,ci.nombre,c.nombre)')
                .replace('COALESCE(r.correo_confirmacion,c.correo)','COALESCE(r.correo_confirmacion,ci.correo,c.correo)')
                .replace('JOIN clienta c ON c.id_clienta=r.id_clienta','LEFT JOIN clienta c ON c.id_clienta=r.id_clienta LEFT JOIN contacto_reserva_invitada ci ON ci.id_reserva=r.id_reserva');
            assert(propuesta.includes('LEFT JOIN contacto_reserva_invitada'));
            const module={exports:{}};vm.runInNewContext(propuesta,{module,require:n=>{assert.equal(n,'./correo');return {enviarConfirmacionReserva:async()=>{throw Error('Inyectar transporte');},enlacePrivado:token=>'/consulta/#'+token};}});
            const notificaciones=module.exports.crearNotificaciones(pool,async d=>{entregas++;assert.equal(d.correo,'nuevo@example.test');assert.equal(d.nombreClienta,'Contacto declarado');return {idMensaje:'correo-ficticio'};});
            const iniciar=real('./inicio-webpay').crearInicioWebpay({pool,webpay:proveedor});
            const inicio=await iniciar({token:simultanea.token_consulta},'http://localhost/api/webpay/retorno');assert.equal(inicio.codigo,201);
            const procesador=real('./procesamiento-webpay').crearProcesamientoWebpay({pool,webpay:proveedor,registrar:notificaciones.registrar,notificar:notificaciones.notificar});
            const r=await procesador.procesar({tipo:'commit',token:inicio.cuerpo.token});
            assert.equal(r.codigo,200);assert.equal(r.cuerpo.estado_reserva,'confirmada');assert.equal(entregas,1);assert.equal(llamadas,2);
            const replay=await crear(a,claveSimultanea,body('12:00')).expect(200);assert.equal(replay.body.reserva.estado,'confirmada');
            assert.equal(entregas,1);assert.equal(llamadas,2);
            await web.patch('/api/reservas/consulta/'+simultanea.token_consulta+'/cancelar').expect(409);
        });
        await t.test('Token rotado no se divulga por una clave antigua',async()=>{
            const tokenNuevo=randomUUID();await pool.query('UPDATE reserva SET token_consulta=$1 WHERE id_reserva=$2',[tokenNuevo,simultanea.id_reserva]);
            const r=await crear(a,claveSimultanea,body('12:00')).expect(409);assert.equal(r.body.codigo,'ENLACE_REQUIERE_REVISION');assert(!JSON.stringify(r.body).includes(tokenNuevo));
        });
        await t.test('Intento vencido y contexto vencido no generan una reserva sustituta',async()=>{
            await pool.query("UPDATE intento_reserva_invitada SET vence=CURRENT_TIMESTAMP-interval '1 second' WHERE id_reserva=$1",[primera.id_reserva]);
            const antes=await contar();await crear(a,clavePrimera,body('10:00')).expect(410);
            reloj+=8*86400000;try{await crear(a,randomUUID(),body('16:00')).expect(401);}finally{reloj-=8*86400000;}
            assert.deepEqual(await contar(),antes);
        });
        await t.test('Sin efectos Oneclick, cambios históricos ni datos en ledger de idempotencia',async()=>{
            assert.equal((await pool.query('SELECT count(*)::int n FROM pago_suscripcion')).rows[0].n,0);
            assert.equal((await pool.query('SELECT count(*)::int n FROM inscripcion_suscripcion')).rows[0].n,0);
            assert.deepEqual((await pool.query('SELECT to_jsonb(r) datos FROM reserva r WHERE id_reserva=1')).rows[0].datos,historico);
            assert.deepEqual((await pool.query('SELECT to_jsonb(c) datos FROM clienta c WHERE id_clienta=1')).rows[0].datos,clienta);
            const ledger=JSON.stringify((await pool.query('SELECT * FROM intento_reserva_invitada')).rows);
            assert(!ledger.includes('@'));assert(!ledger.includes(primera.token_consulta));assert(!ledger.includes('Contacto declarado'));
        });
    }finally{
        if(pool)await pool.end();
        if(creada){assert.equal((await admin.query('SELECT oid FROM pg_database WHERE datname=$1',[nombre])).rows[0]?.oid,oid);await admin.query('DROP DATABASE '+nombre);assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[nombre])).rowCount,0);t.diagnostic('Base eliminada y ausencia confirmada: '+nombre);}
        await admin.end();assert.deepEqual(huellas(),previo,'Conservar los siete archivos pendientes');
    }
});
