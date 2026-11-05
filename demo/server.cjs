// Servidor independiente: no altera archivos ni módulos del proceso de producción.
process.env.MERAKI_SUSCRIPCIONES_AUTOMATICAS = '0';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {raiz, backendRequire, leerConfig} = require('./config.cjs');
const express = backendRequire('express');
const {Pool} = backendRequire('pg');
const rutasConsulta = [
    /^\/api\/estado-db$/,
    /^\/api\/emprendimientos$/,
    /^\/api\/emprendimientos\/[1-9]\d*\/servicios$/,
    /^\/api\/servicios\/[1-9]\d*\/trabajadoras$/,
    /^\/api\/categorias$/,
    /^\/api\/disponibilidad$/,
    /^\/front-office\/?$/,
    /^\/front-office\/front\.js$/,
    /^\/front-office\/styles\.css$/,
    /^\/front-office\/geografia\.mjs$/ ,
    /^\/front-office\/ubicacion\.mjs$/ ,
    /^\/front-office\/assets\/(banner-meraki|logo-meraki|banner-meraki-nuevo|logo-meraki-transparente)\.png$/
];
function permitida(method, ruta) { return method === 'GET' && rutasConsulta.some(r => r.test(ruta)); }
function cargarBackend(pool, config, intentos) {
    for (const key of Object.keys(process.env)) {
        if (/^(GMAIL_|GOOGLE_|MAIL_|WEBPAY_|MERAKI_)/.test(key)) delete process.env[key];
    }
    Object.assign(process.env,config,{MERAKI_SUSCRIPCIONES_AUTOMATICAS:'0'});
    const prohibido = tipo => { intentos[tipo]++; throw Object.assign(Error('Operación externa bloqueada en la demostración'),{code:'DEMO_BLOQUEADO'}); };
    const proveedor = {ambiente:'integracion',codigoComercio:'DEMO-SIN-COMERCIO'};
    for (const metodo of ['iniciar','finalizar','eliminar','autorizar','consultar']) proveedor[metodo] = async () => prohibido('oneclick');
    const cache = new Map();
    function cargar(archivo) {
        if (cache.has(archivo)) return cache.get(archivo).exports;
        const modulo = {exports:{}}; cache.set(archivo,modulo);
        const req = createRequire(archivo);
        const localRequire = nombre => {
            if (nombre === 'transbank-sdk') return {
                WebpayPlus:{Transaction:class { create(){return prohibido('webpay');} status(){return prohibido('webpay');} commit(){return prohibido('webpay');} }},
                Options:class {},IntegrationCommerceCodes:{},IntegrationApiKeys:{},Environment:{}
            };
            if (nombre === 'connect-pg-simple') return session => class extends session.Store {
                get(_id,callback){callback(null,null);}
                set(_id,_datos,callback){callback(Error('Sesiones deshabilitadas en la demo'));}
                destroy(_id,callback){callback(null);}
            };
            if (nombre.startsWith('./') || nombre.startsWith('../')) {
                const destino = req.resolve(nombre);
                if (destino === path.join(raiz,'backend','db.js')) return pool;
                if (destino === path.join(raiz,'backend','oneclick.js')) return {crearOneclick:()=>proveedor};
                if (destino === path.join(raiz,'backend','correo.js')) return {
                    enviarConfirmacionReserva:async()=>prohibido('correo'),
                    enlacePrivado:()=>{throw Error('Enlaces de confirmación deshabilitados en la demo');}
                };
                return cargar(destino);
            }
            return req(nombre);
        };
        // require.main no coincide: el backend no abre otro puerto ni inicia su planificador.
        vm.runInNewContext(fs.readFileSync(archivo,'utf8'),{
            require:localRequire,module:modulo,exports:modulo.exports,__dirname:path.dirname(archivo),__filename:archivo,
            process,console,URL,Buffer,setTimeout,clearTimeout,setInterval,clearInterval
        },{filename:archivo});
        return modulo.exports;
    }
    return cargar(path.join(raiz,'backend','index.js'));
}
async function crearDemo() {
    const config = leerConfig();
    const pool = new Pool({host:config.DB_HOST,port:Number(config.DB_PORT),database:config.DB_NAME,user:config.DB_USER,password:config.DB_PASSWORD,max:4,options:'-c default_transaction_read_only=on -c search_path=public'});
    try {
        const actual = (await pool.query("SELECT current_database() AS base,current_user AS usuario,current_setting('default_transaction_read_only') AS lectura")).rows[0];
        if(actual.base!=='meraki_demo'||actual.usuario!=='meraki_demo_lector'||actual.lectura!=='on')throw Error('La conexión demo no está aislada en modo lectura.');
        const intentos = {webpay:0,oneclick:0,correo:0};
        const backend = cargarBackend(pool,config,intentos);
        const app = express();
        app.use((req,res,next)=>{
            res.set('X-Meraki-Demo','solo-lectura');
            // Las cookies de localhost:3000 también viajarían a localhost:3001.
            delete req.headers.cookie;
            if(req.method==='GET'&&req.path==='/')return res.redirect('/front-office/');
            if(req.method==='GET'&&req.path==='/demo/estado')return res.json({base:actual.base,usuario:actual.usuario,soloLectura:true,renovacionesAutomaticas:false,intentosExternos:intentos});
            if(!permitida(req.method,req.path))return res.status(405).json({codigo:'DEMO_SOLO_LECTURA',mensaje:'Demostración de solo consulta: puedes revisar el resumen, pero no crear reservas, realizar pagos ni modificar datos.'});
            next();
        });
        app.get(['/front-office','/front-office/'],(_req,res)=>{
            const html=fs.readFileSync(path.join(raiz,'frontend','front-office','index.html'),'utf8');
            res.set('Cache-Control','no-store').type('html').send(html.replace('<body>','<body><aside role="note" style="padding:1rem;text-align:center;background:#e7f3ec;color:#24563a">DEMO · Datos ficticios · Solo consulta hasta el resumen. No se crean reservas ni pagos.</aside>'));
        });
        app.get('/front-office/geografia.mjs',(_req,res)=>res.type('text/javascript').sendFile(path.join(raiz,'frontend','front-office','geografia.mjs')));
        app.get('/front-office/ubicacion.mjs',(_req,res)=>res.type('text/javascript').sendFile(path.join(raiz,'frontend','front-office','ubicacion.mjs')));
        app.use(backend);
        return {app,pool,intentos};
    } catch(e) { await pool.end(); throw e; }
}
if(require.main===module)crearDemo().then(({app,pool})=>{
    const servidor=app.listen(3001,'localhost',()=>console.log('Meraki DEMO: http://localhost:3001/front-office/ — meraki_demo, solo lectura, proveedores bloqueados.'));
    servidor.on('error',async e=>{console.error(e.code==='EADDRINUSE'?'El puerto 3001 está ocupado; no se reemplazó el servidor existente.':e.message);await pool.end();process.exitCode=1;});
    const cerrar=()=>servidor.close(()=>pool.end().then(()=>process.exit(0)));
    process.once('SIGINT',cerrar);process.once('SIGTERM',cerrar);
}).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={permitida,crearDemo};
