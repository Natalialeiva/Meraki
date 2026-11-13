const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const request=require('supertest');
const session=require('express-session');
const bcrypt=require('bcrypt');

// Ejecuta las rutas originales con una lista cerrada de dependencias.
// No importa db.js, pg, dotenv ni proveedores. Las sesiones son solo memoria.
async function entorno(){
    const consultas=[];
    const hash=await bcrypt.hash('solo-fixture-local',4);
    const cuenta={id_emprendedora:1,nombre:'Cuenta',apellido:'Ficticia',correo:'mvp@example.test',estado:'activa',password_hash:hash};
    const fila=Object.freeze({id_reserva:91,id_servicio:17,id_trabajadora:23,clienta:'Contacto ficticio',servicio:'Servicio ficticio',trabajadora:'Profesional ficticia',
        fecha_hora_inicio:'2030-11-18T15:00:00',fecha_hora_fin:'2030-11-18T16:00:00',estado:'confirmada',
        precio_servicio:'20000',monto_abono:'5000',id_abono:null,estado_abono:null,puede_cancelar:true,puede_cerrar:false});
    const pool={async query(sql,parametros=[]){
        assert.match(sql.trim(),/^SELECT\b/i,'El escenario no admite escrituras');
        consultas.push({sql,parametros});
        if(/FROM emprendedora/.test(sql)){
            if(/password_hash/.test(sql))return {rows:parametros[0]===cuenta.correo?[{...cuenta}]:[]};
            const {password_hash,estado,...publica}=cuenta;
            return {rows:parametros[0]===1?[publica]:[]};
        }
        if(/SELECT id_emprendimiento\s+FROM emprendimiento/.test(sql)){
            return {rows:parametros[0]===1&&parametros[1]===1?[{id_emprendimiento:1}]:[]};
        }
        if(/FROM reserva r/.test(sql)){
            assert.deepEqual(Array.from(parametros),[1,1],'La consulta debe filtrar negocio y propietaria');
            assert.match(sql,/r\.id_emprendimiento\s*=\s*\$1/);
            assert.match(sql,/e\.id_emprendedora\s*=\s*\$2/);
            const seleccion=sql.slice(0,sql.indexOf('FROM reserva r'));
            assert.match(seleccion,/\br\.id_servicio\s*,/);
            assert.match(seleccion,/\br\.id_trabajadora\s*,/);
            assert.match(sql,/ORDER BY r\.fecha_hora_inicio/);
            return {rows:[{...fila}]};
        }
        throw Error('Consulta no prevista en el escenario de lectura');
    }};
    const prohibido=()=>{throw Error('Operación externa o financiera prohibida en esta prueba');};
    const noop=()=>{};
    const real=createRequire(path.join(__dirname,'../index.js'));
    const dependencias={
        express:real('express'),bcrypt,'express-session':session,
        'connect-pg-simple':()=>session.MemoryStore,
        'transbank-sdk':{WebpayPlus:{Transaction:class{}},Options:class{},IntegrationCommerceCodes:{},IntegrationApiKeys:{},Environment:{}},
        './db':pool,
        './notificaciones':{crearNotificaciones:()=>({registrar:prohibido,notificar:prohibido}),montarRutas:noop},
        './suscripciones':{crearSuscripciones:()=>({}),montarRutasSuscripcion:noop,iniciarPlanificador:prohibido},
        './acceso-suscripcion':{montarRestricciones:noop},
        './procesamiento-webpay':{montarProcesamientoWebpay:noop,PLAZO_WEBPAY_MS:1000},
        './resultado-webpay':{crearReferenciasWebpay:()=>({}),montarLecturaResultado:noop,urlRetornoVisual:prohibido},
        './inicio-webpay':{crearInicioWebpay:()=>prohibido},
        path:real('path')
    };
    const module={exports:{}};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../index.js'),'utf8'),{
        module,__dirname:path.join(__dirname,'..'),
        require:n=>{assert(Object.hasOwn(dependencias,n),'Dependencia no permitida: '+n);return dependencias[n];},
        process:{env:{SESSION_SECRET:'fixture-mvp-sin-valor-real',MERAKI_SUSCRIPCIONES_AUTOMATICAS:'0'}},
        console:{log:noop,error:noop},URL,Buffer,setTimeout,clearTimeout
    });
    return {app:module.exports,consultas,fila};
}

test('MVP: recursos originales, sesión y agenda con dependencias exclusivamente en memoria',async t=>{
    const {app,consultas,fila}=await entorno();
    const agent=request.agent(app);
    await t.test('Front Office, Back Office y consulta sirven sus recursos locales',async()=>{
        for(const ruta of ['/front-office/','/back-office/','/consulta/']){
            const r=await request(app).get(ruta).expect(200);
            for(const m of r.text.matchAll(/(?:src|href)="([^"#?]+\.(?:js|mjs|css))(?:\?[^\"]*)?"/g)){
                const url=new URL(m[1],'http://localhost'+ruta);
                assert.equal(url.origin,'http://localhost');
                await request(app).get(url.pathname).expect(200);
            }
        }
        assert.equal(consultas.length,0);
    });
    await t.test('Las rutas operativas rechazan visitantes antes de consultar datos',async()=>{
        for(const ruta of ['/api/reservas?id_emprendimiento=1','/api/mis-servicios','/api/mis-trabajadoras','/api/mis-horarios','/api/mis-bloqueos']){
            await request(app).get(ruta).expect(401);
        }
        assert.equal(consultas.length,0);
    });
    await t.test('Credenciales inválidas no crean una sesión autenticada',async()=>{
        await agent.post('/api/auth/login').send({correo:'mvp@example.test',password:'incorrecta'}).expect(401);
        await agent.get('/api/auth/yo').expect(401);
    });
    await t.test('Login válido conserva la sesión sin devolver hashes ni contraseña',async()=>{
        const r=await agent.post('/api/auth/login').send({correo:' MVP@example.test ',password:'solo-fixture-local'}).expect(200);
        assert(!/password|hash|solo-fixture-local/.test(JSON.stringify(r.body)));
        await agent.get('/api/auth/yo').expect(200);
    });
    await t.test('Agenda de otro negocio se rechaza sin consultar sus reservas',async()=>{
        const antes=consultas.filter(q=>/FROM reserva r/.test(q.sql)).length;
        await agent.get('/api/reservas?id_emprendimiento=2').expect(403);
        await agent.get('/api/reservas?id_emprendimiento=invalido').expect(400);
        assert.equal(consultas.filter(q=>/FROM reserva r/.test(q.sql)).length,antes);
    });
    await t.test('Agenda autorizada conserva fecha civil y permiso explícito de cierre',async()=>{
        const antes=consultas.length;
        const r=await agent.get('/api/reservas?id_emprendimiento=1').expect(200);
        assert.deepEqual(r.body,[fila]);
        assert.equal(r.body[0].id_servicio,17);
        assert.equal(r.body[0].id_trabajadora,23);
        // La respuesta conserva todos los campos anteriores y solo añade los IDs.
        assert.deepEqual(Object.keys(r.body[0]).filter(k=>!['id_servicio','id_trabajadora'].includes(k)).sort(),[
            'id_reserva','clienta','servicio','trabajadora','fecha_hora_inicio','fecha_hora_fin',
            'estado','precio_servicio','monto_abono','id_abono','estado_abono','puede_cancelar','puede_cerrar'
        ].sort());
        assert.equal(consultas.length-antes,2,'Solo comprobar propiedad y leer la agenda');
    });
    await t.test('Estadísticas existentes aceptan los IDs de la respuesta autorizada',async()=>{
        const {calcularEstadisticasReservas}=require('../../frontend/back-office/estadisticas-reservas');
        const r=await agent.get('/api/reservas?id_emprendimiento=1').expect(200);
        const campos=['id_reserva','id_servicio','servicio','id_trabajadora','trabajadora','estado','fecha_hora_inicio','fecha_hora_fin'];
        const entrada=r.body.map(fila=>Object.fromEntries(campos.map(k=>[k,fila[k]])));
        const resultado=calcularEstadisticasReservas(entrada);
        assert.equal(resultado.estado,'disponible');
        assert.equal(resultado.estadisticas.totalReservasUnicas,1);
        assert.equal(resultado.estadisticas.porServicio[0].id_servicio,17);
        assert.equal(resultado.estadisticas.porProfesional[0].id_trabajadora,23);
    });
    await t.test('Logout invalida la sesión y vuelve a proteger agenda',async()=>{
        await agent.post('/api/auth/logout').expect(200);
        await agent.get('/api/auth/yo').expect(401);
        await agent.get('/api/reservas?id_emprendimiento=1').expect(401);
    });
});
