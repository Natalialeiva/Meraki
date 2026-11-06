const $=s=>document.querySelector(s);const estado=$('#estado');
const navegacion=MerakiNavegacion.montar({contenedor:$('#panel'),menu:$('#menuGestion'),titulo:$('#tituloVista'),descripcion:$('#descripcionVista')});
const claveIngreso=$('#claveIngreso'),mostrarClave=$('#mostrarClave');
function ocultarClave(){
    claveIngreso.type='password';
    mostrarClave.setAttribute('aria-label','Mostrar contraseña');
    mostrarClave.title='Mostrar contraseña';
    mostrarClave.setAttribute('aria-pressed','false');
}
mostrarClave.onclick=()=>{
    const mostrar=claveIngreso.type==='password';
    claveIngreso.type=mostrar?'text':'password';
    const etiqueta=mostrar?'Ocultar contraseña':'Mostrar contraseña';
    mostrarClave.setAttribute('aria-label',etiqueta);
    mostrarClave.title=etiqueta;
    mostrarClave.setAttribute('aria-pressed',String(mostrar));
};
$('#login').addEventListener('reset',ocultarClave);
async function api(url,method='GET',data){const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Meraki-Action':'1'},body:data?JSON.stringify(data):undefined});let d;try{d=JSON.parse(await r.text());}catch{throw Error('El servidor devolvió una respuesta inesperada. Intenta nuevamente.');}if(r.status===401){$('#panel').hidden=true;$('#login').hidden=false;$('#acceso').hidden=false;}if(r.status===402)void suscripcion.cargar();if(!r.ok)throw Error(d.mensaje||'No se pudo completar la operación');return d;}
function mostrar(el,datos){el.replaceChildren();if(!datos.length)el.textContent='No hay registros.';for(const d of datos){const a=document.createElement('article');for(const [k,v] of Object.entries(d)){const p=document.createElement('p');p.textContent=k.replaceAll('_',' ')+': '+v;a.append(p);}el.append(a);}}

let negociosPerfil=[];
let permisoConfiguracion=false;
const puedeConfigurar=()=>permisoConfiguracion;
const perfil=MerakiPerfil.montar({form:$('#perfil'),estado:$('#estadoPerfil'),selector:$('#negocio'),api,
    alGuardar:negocio=>{
        negociosPerfil=negociosPerfil.map(n=>n.id_emprendimiento===negocio.id_emprendimiento?negocio:n);
        for(const opcion of $('#negocio').options){if(opcion.value===String(negocio.id_emprendimiento))opcion.textContent=negocio.nombre;}
    }
});
function cargarPerfil(){perfil.cargar(negociosPerfil.find(n=>String(n.id_emprendimiento)===$('#negocio').value));}
const servicios=MerakiServicios.montar({form:$('#servicioGestion'),lista:$('#listaServicios'),estado:$('#estadoServicios'),
    selector:$('#negocio'),actualizar:$('#actualizarServicios'),api,puedeConfigurar});
const trabajadoras=MerakiTrabajadoras.montar({form:$('#trabajadoraGestion'),lista:$('#listaTrabajadoras'),estado:$('#estadoTrabajadoras'),
    selector:$('#negocio'),actualizar:$('#actualizarTrabajadoras'),asignacion:$('#asignacionGestion'),
    asignados:$('#asignacionesTrabajadora'),tituloAsignacion:$('#tituloAsignaciones'),api,puedeConfigurar});
const horarios=MerakiHorarios.montar({contenedor:$('#gestionHorarios'),selectorNegocio:$('#negocio'),api,puedeConfigurar});
const suscripcion=MerakiSuscripcion.montar({contenedor:$('#gestionSuscripcion'),api,alActualizar:datos=>{
    permisoConfiguracion=datos?.capacidades?.configurar===true;
    $('#avisoAcceso').hidden=permisoConfiguracion;
    $('#avisoAcceso').textContent=datos?'Activa o renueva tu suscripción para recibir nuevas reservas y modificar servicios, trabajadoras u horarios. Puedes seguir consultando y gestionando las citas existentes.':'No se pudo verificar la vigencia. Puedes consultar tu agenda; actualiza la suscripción antes de modificar la configuración.';
    servicios.actualizarPermisos();trabajadoras.actualizarPermisos();horarios.actualizarPermisos();
}});
let agendaReservas=[];
let versionAgenda=0;
const dinero=valor=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(valor));
function textoArticulo(articulo,valor){const p=document.createElement('p');p.textContent=valor;articulo.append(p);}
function renderAgenda(){
    const visibles=MerakiAgenda.filtrar(agendaReservas,$('#filtroFecha').value,$('#filtroEstado').value);
    const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    $('#totalReservas').textContent=agendaReservas.length;
    $('#reservasHoy').textContent=agendaReservas.filter(r=>r.fecha_hora_inicio.slice(0,10)===hoy).length;
    $('#reservasConfirmadas').textContent=agendaReservas.filter(r=>r.estado==='confirmada').length;
    $('#reservasPendientes').textContent=agendaReservas.filter(r=>r.estado==='pendiente_abono').length;
    const lista=$('#reservas');lista.replaceChildren();
    $('#resumenReservas').textContent=visibles.length+' de '+agendaReservas.length+' reservas';
    if(!visibles.length){const vacio=document.createElement('div');vacio.className='sin-reservas';vacio.textContent='No hay reservas para los filtros seleccionados.';lista.append(vacio);return;}
    for(const r of visibles){
        const a=document.createElement('article');a.className='reserva-card';
        const cabecera=document.createElement('div');cabecera.className='reserva-cabecera';
        const titulo=document.createElement('h3');titulo.textContent='Reserva #'+r.id_reserva;
        const etiqueta=document.createElement('span');etiqueta.className='reserva-estado';etiqueta.dataset.estado=r.estado;etiqueta.textContent=MerakiAgenda.estado(r.estado);cabecera.append(titulo,etiqueta);a.append(cabecera);
        const parrafo=(texto,clase)=>{const p=document.createElement('p');p.textContent=texto;p.className=clase;a.append(p);};
        parrafo(r.clienta+' · '+r.servicio,'reserva-persona');
        const fecha=new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'short',year:'numeric'}).format(new Date(r.fecha_hora_inicio.slice(0,10)+'T12:00:00'));
        parrafo(fecha+' · '+r.fecha_hora_inicio.slice(11,16)+' a '+r.fecha_hora_fin.slice(11,16)+' h','reserva-fecha');
        parrafo('Profesional: '+r.trabajadora,'reserva-detalle');
        parrafo('Servicio: '+dinero(r.precio_servicio)+' · Abono: '+dinero(r.monto_abono),'reserva-detalle');
        parrafo(r.id_abono?'Abono '+r.id_abono+': '+MerakiAgenda.estado(r.estado_abono):'Sin intentos de pago registrados.','reserva-detalle');
        if(r.id_abono&&['pendiente_abono','confirmada'].includes(r.estado))parrafo('Para cancelar esta reserva, primero revisa el pago asociado.','reserva-nota');
        const acciones=document.createElement('div');acciones.className='acciones-reserva';
        for(const opcion of MerakiAgenda.acciones(r)){
            const b=document.createElement('button');b.type='button';b.textContent=opcion.texto;
            b.onclick=async()=>{
                if(!confirm(opcion.texto+' para la reserva '+r.id_reserva+'?'))return;
                for(const x of a.querySelectorAll('button'))x.disabled=true;
                try{const d=await api('/api/reservas/'+r.id_reserva+'/'+opcion.accion,'PATCH');estado.textContent=d.mensaje;await reservas();}
                catch(e){estado.textContent=e.message;for(const x of a.querySelectorAll('button'))x.disabled=false;}
            };acciones.append(b);
        }
        if(r.id_abono){
            const b=document.createElement('button');b.type='button';b.className='accion-abono';b.textContent='Revisar abono '+r.id_abono;
            b.onclick=()=>{$('#pago input[name="id"]').value=r.id_abono;invalidarConsultaPago();$('#resultadoPago').textContent='Abono '+r.id_abono+' seleccionado para la reserva '+r.id_reserva+'.';navegacion.mostrar('pagos');$('#pago').scrollIntoView({behavior:'auto',block:'center'});};acciones.append(b);
        }
        a.append(acciones);lista.append(a);
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
async function iniciar(){await api('/api/auth/yo');const negocios=await api('/api/mis-emprendimientos');negociosPerfil=negocios;$('#negocio').replaceChildren();for(const n of negocios){const o=document.createElement('option');o.value=n.id_emprendimiento;o.textContent=n.nombre;$('#negocio').append(o);}$('#login').hidden=true;$('#acceso').hidden=true;$('#panel').hidden=false;navegacion.iniciar();cargarPerfil();if(negocios.length)await reservas();await servicios.cargar($('#negocio').value);await trabajadoras.cargar($('#negocio').value);await horarios.cargar($('#negocio').value);await suscripcion.cargar();await notificaciones();}
$('#login').onsubmit=async e=>{e.preventDefault();ocultarClave();const b=e.submitter;b.disabled=true;try{await api('/api/auth/login','POST',Object.fromEntries(new FormData(e.target)));e.target.reset();await iniciar();estado.textContent='Sesión iniciada.';}catch(e){estado.textContent=e.message;}finally{b.disabled=false;}};
$('#salir').onclick=async()=>{try{await api('/api/auth/logout','POST');location.reload();}catch(e){estado.textContent=e.message;}};
$('#cargar').onclick=()=>reservas().catch(e=>estado.textContent=e.message);
$('#negocio').onchange=()=>{
    cargarPerfil();
    servicios.cargar($('#negocio').value);
    trabajadoras.cargar($('#negocio').value);
    horarios.cargar($('#negocio').value);
    invalidarConsultaPago();
    reservas().catch(e=>estado.textContent=e.message);
};
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
// Refleja pagos confirmados por el procesador sin pedir que la emprendedora cierre sesión.
setInterval(()=>{
    if(document.visibilityState==='visible'&&!$('#panel').hidden)void suscripcion.cargar();
},60000);
