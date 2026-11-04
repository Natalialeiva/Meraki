const crypto=require('node:crypto');
const PLAN={version:'meraki-9990-mes-v1',monto:9990,moneda:'CLP',mesesGratis:1,renovacion:'automatica',ambiente:'integracion'};
function siguienteMes(fecha,dia=Number(fecha.slice(8,10))){
    const [a,m]=fecha.split('-').map(Number),ultimo=new Date(Date.UTC(a,m+1,0)).getUTCDate();
    return new Date(Date.UTC(a,m,Math.min(dia,ultimo))).toISOString().slice(0,10);
}
function clave(secreto){if(!secreto)throw Error('Falta la clave de cifrado de suscripciones');return crypto.scryptSync(secreto,'meraki-oneclick-v1',32);}
function cifrar(texto,secreto){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',clave(secreto),iv);const cuerpo=Buffer.concat([c.update(texto,'utf8'),c.final()]);return [iv.toString('base64'),cuerpo.toString('base64'),c.getAuthTag().toString('base64')].join('.');}
function descifrar(texto,secreto){const [iv,cuerpo,tag]=texto.split('.');const c=crypto.createDecipheriv('aes-256-gcm',clave(secreto),Buffer.from(iv,'base64'));c.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([c.update(Buffer.from(cuerpo,'base64')),c.final()]).toString('utf8');}
const hash=token=>crypto.createHash('sha256').update(token).digest('hex');
function urlRetorno(base,origenSolicitado){
    let origen=new URL(base);const locales=['localhost','127.0.0.1'];
    // Solo admite el alias local del mismo puerto; un Host externo nunca controla el retorno.
    if(origenSolicitado){try{const otro=new URL(origenSolicitado);
        if(locales.includes(origen.hostname)&&locales.includes(otro.hostname)&&origen.protocol===otro.protocol&&origen.port===otro.port&&!otro.username&&!otro.password)origen=otro;
    }catch(e){/* Se mantiene la URL configurada. */}}
    const retorno=new URL('/api/suscripcion/retorno',origen);
    if(retorno.username||retorno.password||!(retorno.protocol==='https:'||(retorno.protocol==='http:'&&locales.includes(retorno.hostname))))throw Error('URL de retorno no válida');
    return retorno.href;
}
function validarPago(respuesta,pago){
    const d=respuesta?.details;
    if(respuesta?.buy_order!==pago.orden_compra||!Array.isArray(d)||d.length!==1)return 'incierto';
    const item=d[0];
    if(item.buy_order!==pago.orden_tienda||item.commerce_code!==pago.codigo_comercio||Number(item.amount)!==Number(pago.monto))return 'incierto';
    if(item.status==='AUTHORIZED'&&item.response_code===0&&typeof item.authorization_code==='string'&&item.authorization_code)return 'aprobado';
    if(item.status==='FAILED'&&Number.isInteger(item.response_code)&&item.response_code!==0)return 'rechazado';
    return 'incierto';
}
module.exports={PLAN,siguienteMes,cifrar,descifrar,hash,validarPago,urlRetorno};
