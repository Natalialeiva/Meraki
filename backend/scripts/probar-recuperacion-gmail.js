// Prueba explícita: Webpay simulado, PostgreSQL aislado y Gmail real.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const {createRequire} = require('module');
const {Pool} = require('pg');
const bcrypt = require('bcrypt');
const request = require('supertest');
require('dotenv').config({path:process.env.MERAKI_ENV_FILE || path.join(__dirname,'../.env'),quiet:true});

async function main() {
    if (!process.argv.includes('--enviar-confirmacion')) throw new Error('Usar --enviar-confirmacion para autorizar el envío real a MAIL_TEST_TO');
    if (process.env.MAIL_PROVIDER !== 'gmail' || !process.env.MAIL_TEST_TO) throw new Error('Configurar Gmail y MAIL_TEST_TO');
    const base = new URL(process.env.PUBLIC_BASE_URL);
    if (base.protocol !== 'http:' || !['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('Esta prueba aislada exige PUBLIC_BASE_URL local HTTP');
    const schema = 'meraki_mail_test_' + crypto.randomBytes(8).toString('hex');
    if (!/^meraki_mail_test_[0-9a-f]{16}$/.test(schema)) throw new Error('Esquema de prueba inválido');
    const config = {host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD};
    const admin = new Pool(config);
    let pool, server, creada = false, cerrando = false;
    const evidencia = path.join(__dirname,'../../docs/recuperacion-gmail-real.json');
    let resultado = {fecha:new Date().toISOString(),webpay:'simulado',gmail:'real',esquemaAislado:true};
    async function cerrar() {
        if (cerrando) return;
        cerrando = true;
        if (server) await new Promise(resolve=>server.close(resolve));
        if (pool) await pool.end();
        if (creada) await admin.query('DROP SCHEMA '+schema+' CASCADE');
        await admin.end();
        resultado.consultaDisponible=false;
        resultado.fechaCierre=new Date().toISOString();
        fs.writeFileSync(evidencia,JSON.stringify(resultado,null,2));
    }
    try {
        // Abrir el puerto antes de enviar; no reemplazar un servidor existente.
        server = require('http').createServer();
        await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(base.port || 80),base.hostname,resolve);});
        await admin.query('CREATE SCHEMA '+schema); creada=true;
        pool = new Pool({...config,options:'-c search_path='+schema+',public'});
        for (const file of ['schema.sql','002_agregar_token_consulta.sql','003_notificaciones_correo.sql','004_fecha_inicio_envio.sql','005_revision_notificaciones.sql','006_correccion_correo_reserva.sql','seed.sql']) {
            await pool.query(fs.readFileSync(path.join(__dirname,'../../database',file),'utf8'));
        }
        const clave = crypto.randomBytes(24).toString('hex');
        const tokenConsulta = crypto.randomUUID();
        await pool.query('UPDATE emprendedora SET password_hash=$1',[await bcrypt.hash(clave,4)]);
        await pool.query("UPDATE emprendimiento SET nombre='[PRUEBA SIN COBRO] Meraki'");
        await pool.query("UPDATE clienta SET nombre='Clienta ficticia de prueba',correo=$1",[process.env.MAIL_TEST_TO]);
        await pool.query("UPDATE reserva SET token_consulta=$1,estado='pendiente_abono',fecha_hora_inicio='2030-11-04 10:00',fecha_hora_fin='2030-11-04 11:00'",[tokenConsulta]);
        await pool.query("INSERT INTO abono(id_reserva,monto,token_transaccion,buy_order) VALUES(1,5000,'token-simulado-sin-cobro','orden-prueba-recuperacion')");
        const req = createRequire(path.join(__dirname,'../index.js'));
        const module = {exports:{}};
        let consultasWebpay=0;
        const wrapped = nombre => nombre === './db' ? pool : nombre === 'transbank-sdk' ? {
            WebpayPlus:{Transaction:class {
                async status() {consultasWebpay++;return {status:'AUTHORIZED',response_code:0,amount:5000,buy_order:'orden-prueba-recuperacion',authorization_code:'SIMULADO'};}
                async create() {throw new Error('Cobros deshabilitados en esta prueba');}
                async commit() {throw new Error('Confirmación Webpay real deshabilitada en esta prueba');}
            }},Options:class{},IntegrationCommerceCodes:{},IntegrationApiKeys:{},Environment:{}
        } : req(nombre);
        vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../index.js'),'utf8'),{
            require:wrapped,module,__dirname:path.join(__dirname,'..'),process,console,URL,Buffer,setTimeout,clearTimeout
        });
        const app = module.exports;
        // La URL recibida por correo solo ofrece lectura de esta prueba.
        server.on('request',(req,res)=>{
            if (req.method !== 'GET') {res.writeHead(405, {'Content-Type':'application/json; charset=utf-8', 'Allow':'GET', 'Cache-Control':'no-store'});res.end(JSON.stringify({mensaje:'Esta prueba solo permite consultar. La reserva no se ha cancelado.'}));return;}
            res.setHeader('X-Meraki-Solo-Consulta','1');
            app(req,res);
        });
        const agent=request.agent(app);
        await agent.post('/api/auth/login').send({correo:'camila@meraki.test',password:clave}).expect(200);
        const recuperacion=await agent.post('/api/abonos/1/recuperar').expect(200);
        const n=(await pool.query('SELECT estado,intentos,id_mensaje FROM notificacion_correo WHERE id_reserva=1')).rows[0];
        if (n?.estado !== 'enviado' || !n.id_mensaje) throw new Error('No se confirmó aceptación SMTP; no repetir automáticamente');
        const consulta=await request(app).get('/api/reservas/consulta/'+tokenConsulta).expect(200);
        if (consulta.body.reserva.estado !== 'confirmada' || JSON.stringify(consulta.body).includes(tokenConsulta)) throw new Error('Consulta privada incorrecta');
        if (consulta.headers['cache-control'] !== 'no-store') throw new Error('Falta política de caché privada');
        await agent.post('/api/abonos/1/recuperar').expect(409);
        const n2=(await pool.query('SELECT intentos FROM notificacion_correo WHERE id_reserva=1')).rows[0];
        if (n2.intentos !== 1 || consultasWebpay !== 1) throw new Error('La recuperación repetida produjo efectos inesperados');
        resultado={...resultado,pago:recuperacion.body.estado_abono,reserva:recuperacion.body.estado_reserva,
            correo:n.estado,idMensaje:n.id_mensaje,intentos:n2.intentos,consultaPrivada:'HTTP 200; confirmada; no-store; sin token en respuesta',
            repeticion:'HTTP 409; sin segundo envío',consultaDisponible:true,urlBase:base.origin,
            cierreProgramado:new Date(Date.now()+30*60*1000).toISOString()};
        fs.writeFileSync(evidencia,JSON.stringify(resultado,null,2));
        console.log(JSON.stringify(resultado));
        const timer=setTimeout(()=>cerrar().then(()=>process.exit(0)).catch(()=>process.exit(1)),30*60*1000);
        for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>{clearTimeout(timer);cerrar().then(()=>process.exit(0)).catch(()=>process.exit(1));});
    } catch (error) {
        resultado.error=error.code || 'PRUEBA_NO_COMPLETADA';
        await cerrar();
        console.error(JSON.stringify({completada:false,codigo:resultado.error,detalle:'Revisar evidencia; no reenviar si el proveedor pudo aceptar el mensaje'}));
        process.exitCode=1;
    }
}
main().catch(()=>{console.error('No se pudo iniciar la prueba. Revisar configuración local.');process.exitCode=1;});
