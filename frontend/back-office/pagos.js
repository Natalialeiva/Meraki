(function(raiz){
    const etiquetas={pendiente:'Pendiente',aprobado:'Aprobado',rechazado:'Rechazado',anulado:'Anulado'};
    function interpretar(datos){
        const lineas=[];
        if(datos.id_abono)lineas.push('Abono '+datos.id_abono+(datos.id_reserva?' · Reserva '+datos.id_reserva:''));
        if(datos.monto!=null)lineas.push('Monto: '+new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(datos.monto)));
        const local=datos.estado_local||datos.estado_abono;
        if(local)lineas.push('Estado en Meraki: '+(etiquetas[local]||local));
        let titulo=datos.mensaje||'Consulta completada';
        let puedeRecuperar=false;
        if(datos.datos_coinciden===false){titulo='Los datos del pago no coinciden';lineas.push('Requiere revisión. No inicies otro pago ni intentes registrarlo.');}
        else if(datos.estado_transbank==='INITIALIZED'){titulo='El pago todavía no se ha completado';lineas.push('La reserva continúa pendiente. No se registró un pago aprobado.');}
        else if(datos.estado_transbank==='AUTHORIZED'){
            if(datos.puede_recuperar===true&&datos.datos_coinciden===true){titulo='Pago aprobado en Webpay, pendiente de registro en Meraki';lineas.push('Puedes verificarlo y registrarlo con el botón habilitado.');puedeRecuperar=true;}
            else if(local==='aprobado'){titulo='El pago ya está registrado en Meraki';lineas.push('No es necesario recuperarlo nuevamente.');}
            else {titulo='El pago requiere revisión';lineas.push('La respuesta recibida no permite habilitar la recuperación.');}
        }
        else if(['FAILED','REVERSED','NULLIFIED','PARTIALLY_NULLIFIED'].includes(datos.estado_transbank)){titulo='La transacción no permite recuperar un pago aprobado';lineas.push('Estado de Webpay: '+datos.estado_transbank+'. Revisa su cierre antes de habilitar otro intento.');}
        else if(datos.estado_abono==='aprobado'&&datos.estado_reserva==='confirmada'){titulo='Pago registrado y reserva confirmada';lineas.push('El estado del correo se revisa en Notificaciones.');}
        return {titulo,lineas,puedeRecuperar};
    }
    if(typeof module!=='undefined'&&module.exports)module.exports={interpretar};else raiz.MerakiPagos={interpretar};
})(typeof globalThis!=='undefined'?globalThis:this);
