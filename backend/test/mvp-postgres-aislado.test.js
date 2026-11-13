const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const {randomUUID,createHash}=require('node:crypto');
const {Client,Pool}=require('pg');
const request=require('supertest'),bcrypt=require('bcrypt');
const raiz=path.join(__dirname,'../..');

// Solo ejecución explícita. Crea su propia base desde template0; nunca utiliza
// DB_NAME como destino y no permite reutilizar bases existentes.
test('MVP integral: base efímera, rutas originales y cero proveedores externos',{
    skip:process.env.MERAKI_MVP_DB_TEST!=='1',timeout:120000
},async t=>{
    const protegidos=['backend/index.js','frontend/consulta/consulta.js','backend/test/consulta.test.js',
        'backend/test/mvp-lectura.test.js','docs/VERIFICACION-MVP-ADRIANA.md'];
    const huellas=()=>protegidos.map(f=>createHash('sha256').update(fs.readFileSync(path.join(raiz,f))).digest('hex'));
    const antes=huellas();
    const privado=require('dotenv').parse(fs.readFileSync(path.join(raiz,'backend/.env')));
    const conexion={host:privado.DB_HOST,port:Number(privado.DB_PORT),user:privado.DB_USER,password:privado.DB_PASSWORD};
    assert(['localhost','127.0.0.1','::1'].includes(conexion.host),'Solo PostgreSQL local');
    const nombre='meraki_mvp_efimera_'+Date.now()+'_'+randomUUID().replaceAll('-','').slice(0,8);
    assert.match(nombre,/^meraki_mvp_efimera_\d+_[a-f0-9]{8}$/);
    const admin=new Client({...conexion,database:'postgres',application_name:'meraki_mvp_creador_temporal'});
    let creada=false,oid,pool,servidor,store,fallarLectura=false;
    let externos=0;const errores=[];
    const prohibido=async()=>{externos++;throw Error('Proveedor bloqueado en prueba aislada');};
    const http=require('node:http'),https=require('node:https');
    const originales=[http.request,https.request];
    const limitar=original=>function(opciones,...args){
        const host=typeof opciones==='string'||opciones instanceof URL
            ?new URL(opciones).hostname:opciones.hostname||opciones.host||'localhost';
        if(!['localhost','127.0.0.1','::1','[::1]'].includes(host)){
            externos++;throw Error('HTTP externo bloqueado');
        }
        return original.call(this,opciones,...args);
    };
    try{
        await admin.connect();
        assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[nombre])).rowCount,0);
        await admin.query('CREATE DATABASE '+nombre+' TEMPLATE template0');creada=true;
        oid=(await admin.query('SELECT oid FROM pg_database WHERE datname=$1',[nombre])).rows[0].oid;
        pool=new Pool({...conexion,database:nombre,options:'-c timezone=America/Santiago -c statement_timeout=15000',application_name:'meraki_mvp_aislado'});
        const identidad=(await pool.query('SELECT current_database() AS base')).rows[0].base;
        assert.equal(identidad,nombre);assert(!['meraki_db','meraki_demo'].includes(identidad));
        t.diagnostic('Destino exclusivo confirmado: '+nombre);
        const archivos=['schema.sql','migracion_abonos_reintentos.sql','002_agregar_token_consulta.sql',
            '003_notificaciones_correo.sql','004_fecha_inicio_envio.sql','005_revision_notificaciones.sql',
            '006_correccion_correo_reserva.sql','007_clienta_correo_unico.sql','007_nombre_reserva.sql',
            '008_suscripcion_oneclick.sql','009_intentos_webpay.sql','010_procesamiento_webpay.sql'];
        for(const f of archivos)await pool.query(fs.readFileSync(path.join(raiz,'database',f),'utf8'));
        const hash=await bcrypt.hash('clave-exclusiva-fixture',4);
        for(const [n,comuna] of [[1,'Santiago'],[2,'Providencia']]){
            await pool.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash) VALUES($1,'Ficticia',$2,$3,$4)",['Cuenta '+n,'MVP-FICTICIO-'+n,'mvp'+n+'@example.test',hash]);
            await pool.query('INSERT INTO emprendimiento(id_emprendedora,nombre,comuna,direccion) VALUES($1,$2,$3,$4)',[n,'MVP Ficticio '+n,comuna,'Dirección ficticia '+n]);
            await pool.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,monto_mensual,estado,acceso_hasta) VALUES($1,CURRENT_DATE,9990,'prueba','2099-01-01')",[n]);
        }
        await pool.query("INSERT INTO categoria(nombre) VALUES('Categoría ficticia'),('Segunda ficticia')");
        await pool.query("INSERT INTO servicio(id_emprendimiento,id_categoria,nombre,precio,duracion_min,monto_abono) VALUES(1,1,'Servicio ficticio',20000,60,5000),(1,2,'Segundo ficticio',30000,60,5000),(2,1,'Servicio ajeno ficticio',20000,60,5000)");
        await pool.query("INSERT INTO trabajadora(id_emprendimiento,nombre) VALUES(1,'Profesional ficticia'),(1,'Segunda ficticia'),(2,'Profesional ajena ficticia')");
        await pool.query('INSERT INTO trabajadora_servicio VALUES(1,1),(2,2),(3,3)');
        await pool.query("INSERT INTO horario_atencion(id_trabajadora,dia_semana,hora_inicio,hora_fin) SELECT t.id_trabajadora,d.dia,'09:00','18:00' FROM trabajadora t CROSS JOIN unnest(ARRAY['lunes','martes','miercoles','jueves','viernes','sabado','domingo']) AS d(dia)");

        // El pool de negocio apunta exclusivamente al destino comprobado. El fallo
        // de lectura es inyectado, sin apagar PostgreSQL ni alterar otros procesos.
        const negocio={query:async(sql,params)=>{
            if(fallarLectura&&!/\bsesion_meraki\b/.test(sql))throw Object.assign(Error('Fallo ficticio de base'),{code:'MVP_FALLO_SIMULADO'});
            return pool.query(sql,params);
        },connect:()=>pool.connect()};
        const real=createRequire(path.join(raiz,'backend/index.js'));
        const cargar=(archivo,overrides={})=>{
            const mod={exports:{}};
            vm.runInNewContext(fs.readFileSync(path.join(raiz,'backend',archivo),'utf8'),{
                module:mod,__dirname:path.join(raiz,'backend'),require:n=>Object.hasOwn(overrides,n)?overrides[n]:real(n),
                process:{env:{SESSION_SECRET:'secreto-solo-fixture',MERAKI_SUSCRIPCIONES_AUTOMATICAS:'0',PUBLIC_BASE_URL:'http://127.0.0.1'}},
                console:{log(){},error:()=>errores.push('error controlado')},URL,Buffer,setTimeout,clearTimeout
            });return mod.exports;
        };
        const notificaciones=cargar('notificaciones.js',{'./correo':{enviarConfirmacionReserva:prohibido,enlacePrivado:token=>'/consulta/#'+token}});
        const sub=real('./suscripciones');
        const proveedor={ambiente:'integracion',iniciar:prohibido,finalizar:prohibido,autorizar:prohibido,consultar:prohibido,eliminar:prohibido};
        const PgSession=real('connect-pg-simple')(real('express-session'));
        class SesionAislada extends PgSession{constructor(opciones){super({...opciones,pruneSessionInterval:false});store=this;}}
        http.request=limitar(originales[0]);https.request=limitar(originales[1]);
        const app=cargar('index.js',{
            './db':negocio,'./notificaciones':notificaciones,
            'connect-pg-simple':()=>SesionAislada,
            'transbank-sdk':{WebpayPlus:{Transaction:class{create=prohibido;commit=prohibido;status=prohibido;}},Options:class{},IntegrationCommerceCodes:{},IntegrationApiKeys:{},Environment:{}},
            './suscripciones':{...sub,crearSuscripciones:opciones=>sub.crearSuscripciones({...opciones,proveedor,secreto:'secreto-solo-fixture'}),iniciarPlanificador:()=>{throw Error('Planificador prohibido');}}
        });
        servidor=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
        const base='http://127.0.0.1:'+servidor.address().port;
        const web=request(base),a=request.agent(base),b=request.agent(base);
        const fecha='2030-11-18';assert(new Date(fecha+'T00:00:00Z').getTime()>Date.now(),'Actualizar fecha ficticia si dejó de ser futura');
        let contacto,reserva,confirmada;
        const datos=(hora,extra={})=>({id_clienta:contacto,id_servicio:1,id_trabajadora:1,fecha,hora,nombre_clienta:'Invitada ficticia',...extra});
        const agenda=async()=> (await a.get('/api/reservas?id_emprendimiento=1').expect(200)).body;
        const crearContacto=correo=>web.post('/api/clientas').send({nombre:'Contacto ficticio',correo,telefono:null});

        await t.test('Páginas y recursos del proyecto original responden sin proveedores',async()=>{
            for(const ruta of ['/front-office/','/back-office/','/consulta/']){
                const r=await web.get(ruta).expect(200);
                for(const m of r.text.matchAll(/(?:src|href)="([^"#?]+\.(?:js|mjs|css))(?:\?[^\"]*)?"/g))await web.get(new URL(m[1],base+ruta).pathname).expect(200);
            }
            assert.equal((await web.get('/api/estado-db').expect(200)).body.base_datos,nombre);
        });
        await t.test('Catálogo, categorías y filtros combinados consultan PostgreSQL real',async()=>{
            assert.equal((await web.get('/api/categorias').expect(200)).body.length,2);
            assert.equal((await web.get('/api/emprendimientos').expect(200)).body.length,2);
            const r=await web.get('/api/emprendimientos').query({nombre:'Ficticio 1',comuna:'Santiago',id_categoria:2}).expect(200);
            assert.deepEqual(r.body.map(n=>n.id_emprendimiento),[1]);
            assert.deepEqual((await web.get('/api/emprendimientos?nombre=no-existe').expect(200)).body,[]);
            assert((await web.get('/api/emprendimientos/1/servicios').expect(200)).body.every(s=>s.reservable===true));
            assert.equal((await web.get('/api/servicios/1/trabajadoras').expect(200)).body[0].id_trabajadora,1);
        });
        await t.test('Sesión inválida, login y propiedad por emprendimiento',async()=>{
            await web.get('/api/reservas?id_emprendimiento=1').expect(401);
            await web.post('/api/auth/login').send({correo:'mvp1@example.test',password:'incorrecta'}).expect(401);
            for(const [agente,n] of [[a,1],[b,2]])await agente.post('/api/auth/login').send({correo:'mvp'+n+'@example.test',password:'clave-exclusiva-fixture'}).expect(200);
            await a.get('/api/auth/yo').expect(200);
            await b.get('/api/reservas?id_emprendimiento=1').expect(403);
            await a.get('/api/reservas?id_emprendimiento=2').expect(403);
        });
        await t.test('Agenda vacía es una respuesta válida y estadísticas sin datos no inventan cifras',async()=>{
            assert.deepEqual(await agenda(),[]);
            const s=real('../frontend/back-office/estadisticas-reservas').calcularEstadisticasReservas([]);
            assert.equal(s.estado,'disponible');assert.equal(s.estadisticas.totalReservasUnicas,0);
        });
        await t.test('Disponibilidad y validaciones rechazan fecha, hora y profesional incorrectos',async()=>{
            const r=await web.get('/api/disponibilidad').query({id_servicio:1,id_trabajadora:1,fecha}).expect(200);
            assert(r.body.some(h=>h.hora_inicio==='11:00:00'));
            await web.post('/api/reservas').send({}).expect(400);
            const c=await crearContacto('invitada@example.test').expect(201);contacto=c.body.id_clienta;
            await web.post('/api/reservas').send(datos('11:00',{fecha:'2030-02-30'})).expect(400);
            await web.post('/api/reservas').send(datos('25:00')).expect(400);
            await web.post('/api/reservas').send(datos('11:00',{id_trabajadora:3})).expect(409);
        });
        await t.test('Reserva válida queda pendiente, con token y sin abonos ni notificaciones',async()=>{
            reserva=(await web.post('/api/reservas').set('Idempotency-Key','fixture-intento-original').send(datos('11:00')).expect(201)).body.reserva;
            assert.equal(reserva.estado,'pendiente_abono');assert.equal(reserva.id_clienta,contacto);
            assert.match(reserva.token_consulta,/^[a-f0-9-]{36}$/i);
            const q=await pool.query('SELECT (SELECT count(*) FROM abono)::int abonos,(SELECT count(*) FROM notificacion_correo)::int correos');
            assert.deepEqual(q.rows[0],{abonos:0,correos:0});
        });
        await t.test('Horario ocupado y reenvío de la misma solicitud no crean otra reserva',async()=>{
            await web.post('/api/reservas').set('Idempotency-Key','fixture-intento-original').send(datos('11:00')).expect(409);
            assert.equal((await pool.query('SELECT count(*)::int n FROM reserva')).rows[0].n,1);
        });
        await t.test('Dos solicitudes simultáneas por el mismo horario producen una sola reserva',async()=>{
            const r=await Promise.all([web.post('/api/reservas').send(datos('12:00')),web.post('/api/reservas').send(datos('12:00'))]);
            assert.deepEqual(r.map(x=>x.status).sort(),[201,409]);
            assert.equal((await pool.query("SELECT count(*)::int n FROM reserva WHERE fecha_hora_inicio=$1::timestamp",[fecha+'T12:00:00'])).rows[0].n,1);
        });
        await t.test('Token privado y hora civil de Santiago conservan fecha y segundos',async()=>{
            const r=(await web.get('/api/reservas/consulta/'+reserva.token_consulta).expect(200)).body;
            assert.equal(r.reserva.fecha_hora_inicio_civil,fecha+'T11:00:00');
            assert.equal(r.reserva.fecha_hora_fin_civil,fecha+'T12:00:00');
            assert.equal(r.reserva.zona_horaria,'America/Santiago');
            assert(!('id_clienta' in r.reserva));assert(!('token_consulta' in r.reserva));
            await web.get('/api/reservas/consulta/no-valido').expect(400);
            await web.get('/api/reservas/consulta/'+randomUUID()).expect(404);
        });
        await t.test('Cancelación sin pagos libera el horario y actualiza agenda',async()=>{
            await web.patch('/api/reservas/consulta/'+reserva.token_consulta+'/cancelar').expect(200);
            assert.equal((await agenda()).find(r=>r.id_reserva===reserva.id_reserva).estado,'cancelada');
            const r=await web.get('/api/disponibilidad').query({id_servicio:1,id_trabajadora:1,fecha}).expect(200);
            assert(r.body.some(h=>h.hora_inicio==='11:00:00'));
            await web.patch('/api/reservas/consulta/'+reserva.token_consulta+'/cancelar').expect(409);
        });
        await t.test('DIAGNÓSTICO: correo existente devuelve el mismo ID y distingue HTTP 200/201',async()=>{
            const r=await crearContacto(' INVITADA@example.test ').expect(200);
            assert.equal(r.body.id_clienta,contacto);
        });
        await t.test('DIAGNÓSTICO: un ID conocido de clienta se acepta sin probar propiedad',async()=>{
            const r=await web.post('/api/reservas').send(datos('14:00',{nombre_clienta:'Otra identidad ficticia'})).expect(201);
            assert.equal(r.body.reserva.id_clienta,contacto);
        });
        await t.test('DIAGNÓSTICO: fallo posterior al registro conserva un contacto sin reserva',async()=>{
            const c=(await crearContacto('sin-reserva@example.test').expect(201)).body.id_clienta;
            await web.post('/api/reservas').send(datos('12:00',{id_clienta:c})).expect(409);
            assert.equal((await pool.query('SELECT count(*)::int n FROM reserva WHERE id_clienta=$1',[c])).rows[0].n,0);
            assert.equal((await pool.query('SELECT count(*)::int n FROM clienta WHERE id_clienta=$1',[c])).rows[0].n,1);
        });
        await t.test('DIAGNÓSTICO: misma clave tras cancelar crea otra reserva; no hay replay durable',async()=>{
            const r=await web.post('/api/reservas').set('Idempotency-Key','fixture-intento-original').send(datos('11:00')).expect(201);
            assert.notEqual(r.body.reserva.id_reserva,reserva.id_reserva);
        });
        await t.test('Agenda entrega IDs que corresponden a relaciones reales y todos los campos previos',async()=>{
            // Fixture de estado confirmado: no representa pago ni retorno financiero.
            confirmada=(await web.post('/api/reservas').send(datos('15:00',{id_servicio:2,id_trabajadora:2})).expect(201)).body.reserva;
            await pool.query("UPDATE reserva SET estado='confirmada' WHERE id_reserva=$1",[confirmada.id_reserva]);
            const filas=await agenda();
            const reales=(await pool.query('SELECT id_reserva,id_servicio,id_trabajadora FROM reserva WHERE id_emprendimiento=1 ORDER BY fecha_hora_inicio')).rows;
            assert.deepEqual(filas.map(({id_reserva,id_servicio,id_trabajadora})=>({id_reserva,id_servicio,id_trabajadora})),reales);
            for(const r of filas)for(const k of ['clienta','servicio','trabajadora','fecha_hora_inicio','fecha_hora_fin','estado','precio_servicio','monto_abono','id_abono','estado_abono','puede_cerrar','puede_cancelar'])assert(Object.hasOwn(r,k),k);
        });
        await t.test('Dashboard y distribución utilizan agenda real sin mezclar emprendimientos',async()=>{
            const filas=await agenda();
            const campos=['id_reserva','id_servicio','servicio','id_trabajadora','trabajadora','estado','fecha_hora_inicio','fecha_hora_fin'];
            const proyectar=rs=>rs.map(r=>Object.fromEntries(campos.map(k=>[k,r[k]])));
            const calcular=real('../frontend/back-office/estadisticas-reservas').calcularEstadisticasReservas;
            const s=calcular(proyectar(filas));assert.equal(s.estado,'disponible');
            assert.equal(s.estadisticas.totalReservasUnicas,filas.length);
            assert.equal(s.estadisticas.porServicio.length,2);assert.equal(s.estadisticas.porProfesional.length,2);
            assert.equal(calcular(proyectar(filas.filter(r=>r.id_servicio===2))).estadisticas.totalReservasUnicas,1);
            assert.equal(calcular(proyectar(filas.filter(r=>r.id_trabajadora===2))).estadisticas.totalReservasUnicas,1);
            const modulo=real('../frontend/back-office/agenda');
            assert.equal(modulo.filtrar(filas,fecha,'confirmada').length,1);
            const cerrar=real('../frontend/back-office/resumen').calcularReservasPorCerrar({reservas:filas,contexto:{idEmprendimientoConsultado:1,idEmprendimientoSeleccionado:1,consultaAutorizada:true,respuestaExitosa:true}});
            assert.equal(cerrar.cantidad,filas.filter(r=>r.puede_cerrar===true).length);
            assert.deepEqual((await b.get('/api/reservas?id_emprendimiento=2').expect(200)).body,[]);
            await b.get('/api/reservas?id_emprendimiento=1').expect(403);
        });
        await t.test('back.js presenta los seis indicadores y distribución desde la API real aislada',async()=>{
            const nodos=new Map(),llamadas=[];
            function elemento(tag='div'){
                return {tag,children:[],dataset:{},attributes:{},value:'',hidden:false,disabled:false,textContent:'',
                    get options(){return this.children;},
                    append(...hijos){this.children.push(...hijos);if(hijos[0]?.tag==='option'&&!this.value)this.value=String(hijos[0].value);},
                    replaceChildren(){this.children=[];},setAttribute(k,v){this.attributes[k]=v;},
                    focus(){},addEventListener(){},scrollIntoView(){},querySelector(){return null;},
                    querySelectorAll(tag){return this.children.flatMap(h=>[...(h.tag===tag?[h]:[]),...h.querySelectorAll(tag)]);}
                };
            }
            const $=id=>{if(!nodos.has(id))nodos.set(id,elemento());return nodos.get(id);};
            const modulo={montar:()=>({cargar:async()=>{},actualizarPermisos(){}})};
            const ctx=vm.createContext({
                document:{querySelector:$,createElement:elemento},
                fetch:async(url,{method})=>{
                    assert.equal(method,'GET','La presentación no debe escribir ni iniciar pagos');llamadas.push(url);
                    const r=await a.get(url);
                    return {status:r.status,ok:r.status>=200&&r.status<300,text:async()=>r.text};
                },
                MerakiNavegacion:{montar:()=>({iniciar(){}})},
                MerakiPerfil:modulo,MerakiServicios:modulo,MerakiTrabajadoras:modulo,MerakiHorarios:modulo,MerakiSuscripcion:modulo,
                MerakiAgenda:real('../frontend/back-office/agenda'),MerakiPagos:real('../frontend/back-office/pagos'),
                MerakiResumen:real('../frontend/back-office/resumen'),MerakiResumenTemporal:real('../frontend/back-office/resumen-temporal'),
                MerakiPresentacionReservas:real('../frontend/back-office/presentacion-reservas'),
                MerakiEstadisticasReservas:real('../frontend/back-office/estadisticas-reservas'),
                MerakiDashboardGraficos:real('../frontend/back-office/dashboard-graficos'),
                setInterval(){},confirm:()=>false
            });
            const fuente=fs.readFileSync(path.join(raiz,'frontend/back-office/back.js'),'utf8');
            assert(fuente.includes('iniciar().catch(e=>estado.textContent=e.message);'));
            vm.runInContext(fuente.replace('iniciar().catch(e=>estado.textContent=e.message);','globalThis.inicioMvp=iniciar();'),ctx);
            await ctx.inicioMvp;
            const filas=await agenda();
            assert.equal(Number($('#totalReservas').textContent),filas.length);
            assert.equal(Number($('#reservasHoy').textContent),0);
            assert.equal(Number($('#reservasConfirmadas').textContent),1);
            assert.equal(Number($('#reservasPendientes').textContent),filas.filter(r=>r.estado==='pendiente_abono').length);
            assert.equal($('#reservasPorCerrar').textContent,'0');
            if(!ctx.MerakiResumenTemporal.disponible())assert.match($('#proximaAtencionEstado').textContent,/no disponible en este navegador/);
            assert.equal($('#distribucionReservas').dataset.estado,'disponible');
            assert.equal($('#totalDistribucion').textContent,String(filas.length));
            assert.equal($('#serviciosDistribucion').textContent,'2');
            assert.equal($('#profesionalesDistribucion').textContent,'2');
            const peticiones=llamadas.length;
            $('#filtroEstado').value='confirmada';$('#filtroEstado').onchange();
            assert.equal($('#reservas').children.length,1);
            assert.equal($('#totalDistribucion').textContent,String(filas.length));
            assert.equal(llamadas.length,peticiones,'Filtrar no consulta nuevamente');
            assert.equal(llamadas.filter(url=>url.startsWith('/api/reservas?')).length,1);
            assert(!llamadas.some(url=>/abonos|oneclick/.test(url)));
            $('#economiaMes').value=fecha.slice(0,7);
            vm.runInContext("cambiarVistaResumen('dashboard')",ctx);
            const importes=(await pool.query("SELECT COALESCE(sum(precio_servicio) FILTER(WHERE estado<>'cancelada'),0) sin_canceladas,COALESCE(sum(monto_abono) FILTER(WHERE estado IN('confirmada','pendiente_abono')),0) abonos_activos FROM reserva WHERE id_emprendimiento=1")).rows[0];
            const graficos=real('../frontend/back-office/dashboard-graficos');
            assert.equal($('#valorServicios').textContent,graficos.clp(Number(importes.sin_canceladas)*100));
            assert.equal($('#abonosActivos').textContent,graficos.clp(Number(importes.abonos_activos)*100));
            assert($('#evolucionReservas').children.some(n=>n.tag==='svg'));
            $('#dashboardEstado').value='confirmada';$('#dashboardEstado').onchange();
            assert.equal($('#dashboardTotal').textContent,'1');assert.equal($('#datosEconomicos').hidden,false);
            assert.equal(llamadas.filter(url=>url.startsWith('/api/reservas?')).length,1);
        });
        await t.test('Cancelar actualiza la distribución; los totales no se confunden con ingresos',async()=>{
            const antes=await agenda();
            await web.patch('/api/reservas/consulta/'+confirmada.token_consulta+'/cancelar').expect(200);
            const despues=await agenda();assert.equal(antes.length,despues.length);
            assert.equal(despues.filter(r=>r.estado==='confirmada').length,0);
            assert.equal(despues.find(r=>r.id_reserva===confirmada.id_reserva).estado,'cancelada');
        });
        await t.test('Fallo de base controlado devuelve error, no una agenda vacía',async()=>{
            fallarLectura=true;
            try{await a.get('/api/reservas?id_emprendimiento=1').expect(500);await web.get('/api/emprendimientos').expect(500);}
            finally{fallarLectura=false;}
            assert((await agenda()).length>0);assert(errores.length>=2);
        });
        await t.test('Logout invalida la sesión y los registros de sesión son solo efímeros',async()=>{
            assert.equal((await pool.query("SELECT to_regclass('public.sesion_meraki') IS NOT NULL existe")).rows[0].existe,true);
            await a.post('/api/auth/logout').expect(200);await a.get('/api/reservas?id_emprendimiento=1').expect(401);
            await b.post('/api/auth/logout').expect(200);
        });
        await t.test('Cero pagos, inscripciones, notificaciones y llamadas externas',async()=>{
            for(const tabla of ['abono','pago_suscripcion','inscripcion_suscripcion','notificacion_correo'])assert.equal((await pool.query('SELECT count(*)::int n FROM '+tabla)).rows[0].n,0,tabla);
            assert.equal(externos,0);
            assert.equal((await pool.query('SELECT count(*)::int n FROM suscripcion WHERE renovacion_automatica')).rows[0].n,0);
        });
    }finally{
        http.request=originales[0];https.request=originales[1];
        if(servidor)await new Promise((resolve,reject)=>servidor.close(e=>e?reject(e):resolve()));
        if(store)store.close();
        if(pool)await pool.end();
        if(creada){
            const actual=(await admin.query('SELECT oid FROM pg_database WHERE datname=$1',[nombre])).rows[0];
            assert.equal(actual?.oid,oid,'No borrar una base que haya sido reemplazada');
            await admin.query('DROP DATABASE '+nombre);
            assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[nombre])).rowCount,0);
            t.diagnostic('Base efímera eliminada y ausencia verificada: '+nombre);
        }
        await admin.end();
        assert.deepEqual(huellas(),antes,'Los cinco archivos pendientes deben conservarse idénticos');
    }
});
