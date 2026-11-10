const {createCipheriv,createDecipheriv,createHmac,randomBytes} = require('node:crypto');

const DURACION = 10 * 60 * 1000;
const PROPOSITO = Buffer.from('meraki:resultado-webpay:v1');
const estados = new Set(['pendiente','abandonado','incierto','conexion']);

function crearReferenciasWebpay(secreto, ahora = Date.now) {
    const derivar = etiqueta => createHmac('sha256',secreto).update(etiqueta).digest();
    const clave = derivar('meraki:resultado-webpay:cifrado:v1');
    const claveCorrelacion = derivar('meraki:resultado-webpay:correlacion:v1');
    const correlacion = token => createHmac('sha256',claveCorrelacion).update(token).digest('base64url');

    function emitir(id, enlace, estado) {
        const iv = randomBytes(12);
        const cifrado = createCipheriv('aes-256-gcm',clave,iv);
        cifrado.setAAD(PROPOSITO);
        const contenido = Buffer.concat([cifrado.update(JSON.stringify({id,enlace,estado,vence:ahora()+DURACION})),cifrado.final()]);
        return Buffer.concat([iv,cifrado.getAuthTag(),contenido]).toString('base64url');
    }

    function abrir(referencia) {
        if(typeof referencia!=='string'||!/^[A-Za-z0-9_-]{39,512}$/.test(referencia))return null;
        try{
            const datos=Buffer.from(referencia,'base64url');
            if(datos.toString('base64url')!==referencia)return null;
            const cifrado=createDecipheriv('aes-256-gcm',clave,datos.subarray(0,12));
            cifrado.setAAD(PROPOSITO);
            cifrado.setAuthTag(datos.subarray(12,28));
            const r=JSON.parse(Buffer.concat([cifrado.update(datos.subarray(28)),cifrado.final()]));
            if(!Number.isSafeInteger(r.vence)||r.vence<=ahora()||!estados.has(r.estado))return null;
            if(r.id===null&&r.enlace===null)return r;
            if(!Number.isSafeInteger(r.id)||r.id<1||!/^[A-Za-z0-9_-]{43}$/.test(r.enlace))return null;
            return r;
        }catch{return null;}
    }

    return {correlacion,emitir,abrir};
}

const RETORNO_JSON='/api/abonos/retorno';
const RETORNO_VISUAL=RETORNO_JSON+'/navegador';

function urlRetornoVisual(configurada) {
    try{
        const url=new URL(configurada);
        const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
        if((url.protocol!=='https:'&&!(local&&url.protocol==='http:'))||url.username||url.password||
            url.hash||![RETORNO_JSON,RETORNO_JSON+'/'].includes(url.pathname))return null;
        url.pathname=RETORNO_VISUAL;
        return url.href.length<=256?url.href:null;
    }catch{return null;}
}

function cabecerasPrivadas(res) {
    res.set('Cache-Control','no-store');
    res.set('Referrer-Policy','no-referrer');
}

function montarLecturaResultado(app,pool,referencias) {
    app.get('/api/abonos/resultado',(req,res,next)=>{
        cabecerasPrivadas(res);
        next();
    },async(req,res)=>{
        const r=referencias.abrir(req.get('X-Meraki-Resultado'));
        if(!r)return res.status(404).json({estado:'no_disponible'});
        if(r.id===null)return res.json({estado:r.estado});
        try{
            const {rows:[a]}=await pool.query(`
                SELECT a.estado,a.estado_proceso_webpay,a.token_transaccion,r.estado AS reserva
                FROM abono a JOIN reserva r USING(id_reserva) WHERE a.id_abono=$1
            `,[r.id]);
            if(!a?.token_transaccion||referencias.correlacion(a.token_transaccion)!==r.enlace){
                return res.status(404).json({estado:'no_disponible'});
            }
            let estado='pendiente';
            if(a.estado==='aprobado')estado=a.reserva==='confirmada'?'aprobado':'incierto';
            else if(a.estado==='rechazado')estado='rechazado';
            else if(a.estado!=='pendiente')estado='incierto';
            else if(a.estado_proceso_webpay==='incierto')estado=r.estado==='conexion'?'conexion':'incierto';
            else if(r.estado!=='pendiente')estado=r.estado;
            return res.json({estado,correlacion:r.enlace});
        }catch{return res.status(503).json({estado:'no_disponible'});}
    });
}

module.exports={crearReferenciasWebpay,urlRetornoVisual,RETORNO_JSON,RETORNO_VISUAL,cabecerasPrivadas,montarLecturaResultado};
