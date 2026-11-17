(function(raiz){
    'use strict';
    const estados={enviado:'Enviado correctamente',pendiente:'Pendiente de envío',fallido:'No se pudo enviar',enviando:'Enviando',requiere_revision:'Requiere atención'};
    function fechaSantiago(valor){
        if(typeof valor!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(valor))return 'Fecha no disponible';
        const fecha=new Date(valor);
        if(!Number.isFinite(fecha.getTime()))return 'Fecha no disponible';
        const civil=valor.slice(0,10),[y,m,d]=civil.split('-').map(Number);
        if(new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)!==civil)return 'Fecha no disponible';
        const partes=new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(fecha);
        const obtener=tipo=>partes.find(p=>p.type===tipo).value;
        return obtener('day')+'/'+obtener('month')+'/'+obtener('year')+' · '+obtener('hour')+':'+obtener('minute');
    }
    function modelo(n){
        const revision=n.requiere_revision===true||n.estado==='requiere_revision';
        const intentos=Number.isInteger(n.intentos)&&n.intentos>=0?n.intentos:null;
        return {estado:revision?'Requiere atención':estados[n.estado]||'Estado no disponible',revision,
            intentos:intentos===null?'Cantidad no disponible':intentos===1?'1 intento de envío':intentos+' intentos de envío',
            fecha:n.fecha_envio?fechaSantiago(n.fecha_envio):n.estado==='enviado'?'Fecha no disponible':'Aún no enviado',
            opciones:n.requiere_revision===true?[['entregado','Confirmar entrega'],['no_entregado','Confirmar que no se entregó']]:['fallido','pendiente'].includes(n.estado)&&intentos!==null&&intentos<3?[['reintentar','Reintentar envío']]:[]};
    }
    function tarjeta(documento,n){
        const m=modelo(n),a=documento.createElement('article');a.className='notificacion-tarjeta';
        const agregar=(padre,tag,texto,clase)=>{const e=documento.createElement(tag);e.textContent=texto;if(clase)e.className=clase;padre.append(e);return e;};
        const cabecera=agregar(a,'div','','notificacion-cabecera');
        agregar(cabecera,'h3','Confirmación de reserva');
        agregar(cabecera,'span',m.estado,'notificacion-estado'+(m.revision?' notificacion-atencion':''));
        agregar(a,'p',Number.isSafeInteger(n.id_reserva)?'Reserva #'+n.id_reserva:'Reserva sin número disponible','notificacion-reserva');
        const datos=agregar(a,'dl','','notificacion-datos');
        agregar(datos,'dt','Fecha de envío · hora de Santiago');agregar(datos,'dd',m.fecha);
        agregar(datos,'dt','Intentos de envío');agregar(datos,'dd',m.intentos);
        if(m.revision)agregar(a,'p','No se pudo confirmar el envío. Revisa su estado antes de intentar nuevamente.','notificacion-aviso');
        const detalles=agregar(a,'details','','notificacion-detalles');
        agregar(detalles,'summary','Detalles técnicos');
        if(Number.isSafeInteger(n.id_notificacion))agregar(detalles,'p','Referencia de soporte: '+n.id_notificacion);
        agregar(detalles,'p','Inicio del procesamiento: '+fechaSantiago(n.fecha_inicio_envio));
        return a;
    }
    const modulo={fechaSantiago,modelo,tarjeta};
    if(typeof module!=='undefined'&&module.exports)module.exports=modulo;else raiz.MerakiNotificacionesUI=modulo;
})(typeof globalThis!=='undefined'?globalThis:this);
