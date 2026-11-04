const {Oneclick,Options,IntegrationCommerceCodes,IntegrationApiKeys,Environment,TransactionDetail}=require('transbank-sdk');

// Este adaptador no admite producción. Los códigos públicos son los del sandbox oficial.
function crearOneclick(){
    const opciones=new Options(IntegrationCommerceCodes.ONECLICK_MALL,IntegrationApiKeys.WEBPAY,Environment.Integration);
    const inscripcion=new Oneclick.MallInscription(opciones),transaccion=new Oneclick.MallTransaction(opciones);
    return {
        ambiente:'integracion',codigoComercio:IntegrationCommerceCodes.ONECLICK_MALL_CHILD1,
        iniciar:(usuario,correo,retorno)=>limitar(()=>inscripcion.start(usuario,correo,retorno)),
        finalizar:token=>limitar(()=>inscripcion.finish(token)),
        eliminar:(token,usuario)=>limitar(()=>inscripcion.delete(token,usuario)),
        autorizar:(usuario,token,pago)=>limitar(()=>transaccion.authorize(usuario,token,pago.orden_compra,
            [new TransactionDetail(Number(pago.monto),pago.codigo_comercio,pago.orden_tienda,1)])),
        consultar:orden=>limitar(()=>transaccion.status(orden))
    };
}
async function limitar(accion){
    let temporizador;
    try{return await Promise.race([Promise.resolve().then(accion),new Promise((_,rechazar)=>{
        temporizador=setTimeout(()=>rechazar(Object.assign(new Error('Tiempo de respuesta agotado'),{code:'ETIMEDOUT'})),20000);
    })]);}finally{clearTimeout(temporizador);}
}
module.exports={crearOneclick};
