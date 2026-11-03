const $=s=>document.querySelector(s);const estado=$('#estado');
async function api(url,method='GET',data){const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Meraki-Action':'1'},body:data?JSON.stringify(data):undefined});let d;try{d=JSON.parse(await r.text());}catch{throw Error('El servidor devolvió una respuesta inesperada. Intenta nuevamente.');}if(r.status===401){$('#panel').hidden=true;$('#login').hidden=false;}if(!r.ok)throw Error(d.mensaje||'No se pudo completar la operación');return d;}
function mostrar(el,datos){el.replaceChildren();if(!datos.length)el.textContent='No hay registros.';for(const d of datos){const a=document.createElement('article');for(const [k,v] of Object.entries(d)){const p=document.createElement('p');p.textContent=k.replaceAll('_',' ')+': '+v;a.append(p);}el.append(a);}}

let agendaReservas=[];
let versionAgenda=0;
const dinero=valor=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(valor));
function textoArticulo(articulo,valor){const p=document.createElement('p');p.textContent=valor;articulo.append(p);}
function renderAgenda(){
    const visibles=MerakiAgenda.filtrar(agendaReservas,$('#filtroFecha').value,$('#filtroEstado').value);
    const lista=$('#reservas');lista.replaceChildren();
    $('#resumenReservas').textContent=visibles.length+' de '+agendaReservas.length+' reservas';
    if(!visibles.length){lista.textContent='No hay reservas para los filtros seleccionados.';return;}
    for(const r of visibles){
        const a=document.createElement('article'),titulo=document.createElement('h3');
        titulo.textContent='Reserva '+r.id_reserva+' · '+MerakiAgenda.estado(r.estado);a.append(titulo);
        textoArticulo(a,r.clienta+' · '+r.servicio+' · '+r.trabajadora);
        textoArticulo(a,'Inicio: '+r.fecha_hora_inicio.replace('T',' ')+' · Fin: '+r.fecha_hora_fin.replace('T',' '));
        textoArticulo(a,'Servicio: '+dinero(r.precio_servicio)+' · Abono: '+dinero(r.monto_abono));
        textoArticulo(a,r.id_abono?'Abono '+r.id_abono+': '+MerakiAgenda.estado(r.estado_abono):'Sin intentos de pago registrados.');
        if(r.id_abono && ['pendiente_abono','confirmada'].includes(r.estado))textoArticulo(a,'La cancelación requiere gestionar primero el pago asociado.');
        for(const opcion of MerakiAgenda.acciones(r)){
            const b=document.createElement('button');b.type='button';b.textContent=opcion.texto;
            b.onclick=async()=>{
                if(!confirm(opcion.texto+' para la reserva '+r.id_reserva+'?'))return;
                for(const x of a.querySelectorAll('button'))x.disabled=true;
                try{const d=await api('/api/reservas/'+r.id_reserva+'/'+opcion.accion,'PATCH');estado.textContent=d.mensaje;await reservas();}
                catch(e){estado.textContent=e.message;for(const x of a.querySelectorAll('button'))x.disabled=false;}
            };a.append(b);
        }
        if(r.id_abono){
            const b=document.createElement('button');b.type='button';b.textContent='Revisar abono '+r.id_abono;
            b.onclick=()=>{$('#pago input[name="id"]').value=r.id_abono;invalidarConsultaPago();$('#resultadoPago').textContent='Abono '+r.id_abono+' seleccionado para la reserva '+r.id_reserva+'.';$('#pago').scrollIntoView({behavior:'smooth',block:'center'});};a.append(b);
        }
        lista.append(a);
    }
}
async function reservas(){
    const version=++versionAgenda;const negocio=$('#negocio').value;
    if(!negocio){agendaReservas=[];renderAgenda();return;}
    $('#resumenReservas').textContent='Cargando reservas…';
    const datos=await api('/api/reservas?id_emprendimiento='+encodeURIComponent(negocio));
    if(version!==versionAgenda)return;
    agendaReservas=datos;renderAgenda();
}
$('#filtroFecha').onchange=$('#filtroEstado').onchange=renderAgenda;
$('#limpiarFiltros').onclick=()=>{$('#filtroFecha').value='';$('#filtroEstado').value='';renderAgenda();};

async function notificaciones(){const datos=await api('/api/notificaciones');mostrar($('#notificaciones'),datos);[...$('#notificaciones').children].forEach((a,i)=>{const n=datos[i];if(!n)return;const opciones=n.requiere_revision?[['entregado','Confirmar entrega'],['no_entregado','Confirmar que no se entregó']]:['fallido','pendiente'].includes(n.estado)&&n.intentos<3?[['reintentar','Reintentar envío']]:[];if(!opciones.length)return;const label=document.createElement('label'),e=document.createElement('textarea');label.textContent='Evidencia (sin enlaces privados ni datos personales)';e.minLength=10;e.maxLength=500;label.append(e);a.append(label);for(const [decision,titulo] of opciones){const b=document.createElement('button');b.textContent=titulo;b.onclick=async()=>{if(e.value.trim().length<10){estado.textContent='Registra al menos 10 caracteres de evidencia.';return;}if(!confirm(titulo+' para la reserva '+n.id_reserva+'?'))return;for(const x of a.querySelectorAll('button'))x.disabled=true;try{const d=await api('/api/notificaciones/'+n.id_notificacion+'/'+(decision==='reintentar'?'reintentar':'revisar'),'POST',{decision,evidencia:e.value});estado.textContent=d.requiereRevision?'Resultado incierto. Revisa el proveedor antes de reenviar.':d.enviado?'Proveedor aceptó el mensaje.':d.revisado?'Revisión registrada.':'No se envió. Consulta el estado actualizado.';await notificaciones();}catch(err){estado.textContent=err.message;for(const x of a.querySelectorAll('button'))x.disabled=false;}};a.append(b);}});}
async function iniciar(){await api('/api/auth/yo');const negocios=await api('/api/mis-emprendimientos');$('#negocio').replaceChildren();for(const n of negocios){const o=document.createElement('option');o.value=n.id_emprendimiento;o.textContent=n.nombre;$('#negocio').append(o);}$('#login').hidden=true;$('#panel').hidden=false;if(negocios.length)await reservas();await notificaciones();}
$('#login').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await api('/api/auth/login','POST',Object.fromEntries(new FormData(e.target)));e.target.reset();await iniciar();estado.textContent='Sesión iniciada.';}catch(e){estado.textContent=e.message;}finally{b.disabled=false;}};
$('#salir').onclick=async()=>{try{await api('/api/auth/logout','POST');location.reload();}catch(e){estado.textContent=e.message;}};
$('#cargar').onclick=$('#negocio').onchange=()=>reservas().catch(e=>estado.textContent=e.message);
$('#actualizar').onclick=()=>notificaciones().catch(e=>estado.textContent=e.message);
let consultaPago=null;
let versionConsultaPago=0;
let procesandoPago=false;
function invalidarConsultaPago(){versionConsultaPago++;consultaPago=null;$('#recuperarPago').disabled=true;$('#resultadoPago').replaceChildren();}
$('#pago input[name="id"]').oninput=invalidarConsultaPago;
function resultadoPago(datos){
    const vista=MerakiPagos.interpretar(datos);const panel=$('#resultadoPago');panel.replaceChildren();
    const titulo=document.createElement('h3');titulo.textContent=vista.titulo;panel.append(titulo);
    for(const texto of vista.lineas){const p=document.createElement('p');p.textContent=texto;panel.append(p);}
    return vista;
}
$('#pago').onsubmit=async e=>{
    e.preventDefault();if(procesandoPago)return;const accion=e.submitter?.value||'estado';const id=Number(new FormData(e.target).get('id'));
    if(!Number.isSafeInteger(id)||id<1){estado.textContent='Indica un número de abono válido.';return;}
    if(accion==='recuperar'){
        if(!consultaPago||consultaPago.id!==id||!consultaPago.permitida){estado.textContent='Consulta primero este abono en Webpay.';return;}
        if(!confirm('¿Registrar el pago aprobado del abono '+id+' para la reserva '+consultaPago.reserva+'? Se verificará nuevamente Webpay; no se generará otro cobro.'))return;
    }
    const version=++versionConsultaPago;procesandoPago=true;
    const campo=e.target.querySelector('input[name="id"]');campo.disabled=true;
    for(const b of e.target.querySelectorAll('button'))b.disabled=true;
    $('#resultadoPago').textContent=accion==='estado'?'Consultando Webpay…':'Verificando y registrando el pago…';
    consultaPago=null;
    try{
        const datos=await api('/api/abonos/'+id+'/'+accion,accion==='estado'?'GET':'POST');
        if(version!==versionConsultaPago)return;
        const vista=resultadoPago(datos);
        if(accion==='estado')consultaPago={id,reserva:datos.id_reserva,permitida:vista.puedeRecuperar};
        if(accion==='recuperar'){await notificaciones();if($('#negocio').value)await reservas();}
    }catch(error){if(version===versionConsultaPago)$('#resultadoPago').textContent=error.message;}
    finally{
        procesandoPago=false;campo.disabled=false;
        for(const b of e.target.querySelectorAll('button'))b.disabled=false;
        $('#recuperarPago').disabled=!consultaPago?.permitida;
    }
};
iniciar().catch(e=>estado.textContent=e.message);
