const $=s=>document.querySelector(s);const estado=$('#estado');
const navegacion=MerakiNavegacion.montar({contenedor:$('#panel'),menu:$('#menuGestion'),titulo:$('#tituloVista'),descripcion:$('#descripcionVista'),alCambiar:cambiarVistaResumen});
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
let versionSesion=0;
async function api(url,method='GET',data,vigente=()=>true){
    const sesion=versionSesion;
    const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Meraki-Action':'1'},body:data?JSON.stringify(data):undefined});
    if(!vigente())return;
    const texto=await r.text();
    if(!vigente())return;
    if(r.status===401 && sesion===versionSesion){
        versionSesion++;
        versionAgenda++;
        limpiarAgenda('No disponible');
        $('#panel').hidden=true;
        $('#login').hidden=false;
        $('#acceso').hidden=false;
        estado.textContent='Debes iniciar sesión para acceder al Back Office';
    }
    let d;
    try{d=JSON.parse(texto);}catch{throw Error('El servidor devolvió una respuesta inesperada. Intenta nuevamente.');}
    if(r.status===402)void suscripcion.cargar();
    if(!r.ok)throw Error(d.mensaje||'No se pudo completar la operación');
    return d;
}
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
let agendaReservas=null;
let dashboardActivo=false;
const camposDashboard={dashboardConfirmadas:'confirmada',dashboardPendientes:'pendiente_abono',dashboardCanceladas:'cancelada',dashboardAtendidas:'atendida',dashboardNoAtendidas:'no_atendida'};
function limpiarMetricasDashboard(){
    for(const id of ['dashboardTotal',...Object.keys(camposDashboard)])$('#'+id).textContent='—';
}
function cambiarVistaResumen(vista){
    dashboardActivo=vista==='dashboard';
    $(dashboardActivo?'#dashboardDistribucion':'#distribucionEnAgenda').append($('#distribucionReservas'));
    $('#alcanceDistribucion').textContent=dashboardActivo
        ? describirFiltrosDashboard()
        : 'Todas las fechas y estados de la agenda del emprendimiento seleccionado, incluidas canceladas y pendientes de abono. Los filtros de la lista no cambian esta distribución. No representa ingresos ni productividad.';
    if(agendaReservas)actualizarDistribucionReservas(agendaReservas);
    sincronizarDashboard(presentacionAgenda.obtenerEstado());
}
function describirFiltrosDashboard(){
    return 'Fecha de atención: '+($('#dashboardFecha').value||'todas')+'. Estado: '+($('#dashboardEstado').value?MerakiAgenda.estado($('#dashboardEstado').value):'todos')+'. Solo el emprendimiento seleccionado.';
}
function sincronizarDashboard(vista){
    const cargando=vista.accesibilidad.ariaBusy;
    $('#contenidoDashboard').setAttribute('aria-busy',String(cargando));
    $('#actualizarDashboard').disabled=cargando||$('#panel').hidden||!$('#negocio').value;
    for(const id of ['dashboardFecha','dashboardEstado','limpiarDashboard','economiaMes'])$('#'+id).disabled=cargando||vista.datos.tratamiento!=='mostrar';
    $('#actualizacionDashboard').textContent=vista.ultimaActualizacion.texto;
    $('#advertenciaDashboard').textContent=vista.ultimaActualizacion.advertencia;
    $('#estadoDashboard').dataset.estado=vista.estado;
    $('#estadoDashboard').textContent=vista.datos.tratamiento==='mostrar'
        ? $('#dashboardTotal').textContent==='—'?$('#estadoDistribucion').textContent:'Reservas mostradas: '+$('#dashboardTotal').textContent+'.':vista.mensaje;
}
function filtrarDashboard(){
    if(dashboardActivo&&agendaReservas){actualizarDistribucionReservas(agendaReservas);sincronizarDashboard(presentacionAgenda.obtenerEstado());}
}
$('#dashboardFecha').onchange=$('#dashboardEstado').onchange=filtrarDashboard;
$('#economiaMes').value=MerakiDashboardGraficos.mesActualSantiago();
$('#economiaMes').onchange=filtrarDashboard;
$('#limpiarDashboard').onclick=()=>{$('#dashboardFecha').value='';$('#dashboardEstado').value='';filtrarDashboard();};
$('#actualizarDashboard').onclick=()=>reservas();
let versionAgenda=0;
let presentacionAgenda=MerakiPresentacionReservas.crearPresentador();
let contextoPresentacionAgenda=null, ultimoAnuncioAgenda=null;
function reiniciarPresentacionAgenda(){
    presentacionAgenda=MerakiPresentacionReservas.crearPresentador();
    contextoPresentacionAgenda=null;ultimoAnuncioAgenda=null;
    mostrarPresentacionAgenda();
}
function mostrarPresentacionAgenda(anunciar=true){
    const vista=presentacionAgenda.obtenerEstado();
    if(vista.estado==='cambio_emprendimiento')limpiarDistribucionReservas('cambio_emprendimiento');
    $('#estadoAgenda').dataset.estado=vista.estado;
    $('#agendaContenido').setAttribute('aria-busy',String(vista.accesibilidad.ariaBusy));
    $('#ultimaActualizacionAgenda').textContent=vista.ultimaActualizacion.texto;
    $('#advertenciaActualizacionAgenda').textContent=vista.ultimaActualizacion.advertencia;
    $('#cargar').disabled=vista.accesibilidad.ariaBusy;
    $('#reintentarAgenda').hidden=!vista.acciones.some(a=>a.id==='reintentar'&&a.habilitada);
    sincronizarDashboard(vista);
    if(anunciar&&ultimoAnuncioAgenda!==vista.accesibilidad.anuncioId){
        const detalle=vista.datos.tratamiento==='mostrar'
            ? ' Por cerrar: '+$('#reservasPorCerrar').textContent+'. '+$('#proximaAtencionEstado').textContent+' '+$('#estadoDistribucion').textContent
            : ['error_carga','error_actualizacion'].includes(vista.estado)?' '+$('#estadoDistribucion').textContent:'';
        $('#estadoAgenda').textContent=vista.mensaje+detalle;
        ultimoAnuncioAgenda=vista.accesibilidad.anuncioId;
    }
}
function mostrarProximaAtencion(mensaje,fecha='',detalle=''){
    $('#proximaAtencionFecha').textContent=fecha;
    $('#proximaAtencionDetalle').textContent=detalle;
    const aviso=$('#proximaAtencionEstado');
    aviso.className=fecha?'sr-only':'';
    aviso.textContent=mensaje;
}
function actualizarProximaAtencion(entrada){
    try{
        const temporal=globalThis.MerakiResumenTemporal;
        if(!temporal?.disponible()){
            mostrarProximaAtencion('Próxima atención no disponible en este navegador');
            return;
        }
        const {proximaAtencion}=temporal.calcularResumenOperativo({...entrada,ahoraEpochMs:Date.now()});
        if(proximaAtencion.estado==='disponible'){
            const fecha=new Intl.DateTimeFormat('es-CL',{
                timeZone:'America/Santiago',dateStyle:'medium',timeStyle:'short',hourCycle:'h23'
            }).format(proximaAtencion.inicioEpochMs);
            const {servicio,trabajadora}=proximaAtencion.reserva;
            const detalle=[servicio,trabajadora].filter(Boolean).join(' · ');
            mostrarProximaAtencion(['Próxima atención',fecha,detalle].filter(Boolean).join('. '),fecha,detalle);
        }else if(proximaAtencion.estado==='sin_proximas'){
            mostrarProximaAtencion('No hay próximas reservas confirmadas');
        }else if(proximaAtencion.estado==='pendiente_revision'){
            mostrarProximaAtencion('No se pudo determinar la próxima atención con certeza');
        }else{
            mostrarProximaAtencion('No se pudo calcular la próxima atención');
        }
    }catch{
        mostrarProximaAtencion('No se pudo calcular la próxima atención');
    }
}
function limpiarAgenda(mensaje, mensajeProxima='Próxima atención no disponible'){
    agendaReservas=null;
    limpiarDistribucionReservas(mensaje==='Cargando…'?'cargando':'error');
    $('#reservas').replaceChildren();
    for(const id of ['totalReservas','reservasHoy','reservasConfirmadas','reservasPendientes']){
        $('#'+id).textContent='—';
    }
    $('#reservasPorCerrar').textContent=mensaje;
    $('#resumenReservas').textContent=mensaje==='Cargando…'?'Cargando reservas…':'Reservas no disponibles.';
    mostrarProximaAtencion(mensajeProxima);
    // La gestión de sesión sigue en api(). Solo limpiar su presentación derivada.
    if(contextoPresentacionAgenda&&contextoPresentacionAgenda.sesion!==versionSesion){
        limpiarDistribucionReservas('sesion_vencida');
        presentacionAgenda.registrarError(presentacionAgenda.iniciarCarga(),{sesionVencida:true});
        contextoPresentacionAgenda=null;
        mostrarPresentacionAgenda();
        const sesion=versionSesion;
        Promise.resolve().then(()=>{
            if(sesion===versionSesion&&$('#panel').hidden)claveIngreso.focus();
        });
    }
}
function limpiarDistribucionReservas(tipo){
    limpiarMetricasDashboard();
    if(typeof MerakiDashboardGraficos!=='undefined')MerakiDashboardGraficos.limpiar({seleccionar:$});
    const mensajes={cargando:'Cargando la distribución de reservas…',
        cambio_emprendimiento:'Cargando la distribución del emprendimiento seleccionado. Los datos anteriores se han retirado.',
        error:'No se pudo cargar la distribución. Actualiza la agenda para volver a intentarlo.',
        sesion_vencida:'Inicia sesión para consultar la distribución de reservas.'};
    $('#distribucionReservas').dataset.estado=tipo;
    $('#estadoDistribucion').textContent=mensajes[tipo];
    $('#datosDistribucion').hidden=true;
    for(const id of ['totalDistribucion','serviciosDistribucion','profesionalesDistribucion'])$('#'+id).textContent='—';
    for(const id of ['distribucionServicios','distribucionProfesionales'])$('#'+id).replaceChildren();
    $('#lideresServicios').textContent='';$('#lideresProfesionales').textContent='';
    $('#advertenciasDistribucion').textContent='';
}
function actualizarDistribucionReservas(reservas,soloInconsistencias=false){
    try{
        // Proyección explícita: nunca enviar clientas, montos, abonos o tokens.
        const entrada=reservas.map(r=>({id_reserva:r.id_reserva,id_servicio:r.id_servicio,servicio:r.servicio,
            id_trabajadora:r.id_trabajadora,trabajadora:r.trabajadora,estado:r.estado,
            fecha_hora_inicio:r.fecha_hora_inicio,fecha_hora_fin:r.fecha_hora_fin}));
        let resultado=MerakiEstadisticasReservas.calcularEstadisticasReservas(entrada),seleccion=reservas;
        // Validar primero toda la respuesta: un filtro no debe ocultar datos inválidos.
        if(resultado.estado==='disponible'&&dashboardActivo&&($('#dashboardFecha').value||$('#dashboardEstado').value)){
            seleccion=MerakiAgenda.filtrar(reservas,$('#dashboardFecha').value,$('#dashboardEstado').value);
            resultado=MerakiEstadisticasReservas.calcularEstadisticasReservas(MerakiAgenda.filtrar(entrada,$('#dashboardFecha').value,$('#dashboardEstado').value));
        }
        // Una carga inválida solo puede aportar un diagnóstico, nunca cifras.
        if(soloInconsistencias&&resultado.estado!=='inconsistente')return;
        if(resultado.estado!=='disponible'){
            limpiarDistribucionReservas('error');
            $('#distribucionReservas').dataset.estado=resultado.estado==='inconsistente'?'inconsistente':'no_disponible';
            const faltanIds=resultado.incidencias.some(i=>i.codigo==='identificador_invalido'&&['id_servicio','id_trabajadora'].includes(i.campo));
            $('#estadoDistribucion').textContent=resultado.estado==='inconsistente'
                ? 'Estadísticas no disponibles: hay reservas repetidas con datos contradictorios.'
                : faltanIds
                    ? 'Estadísticas no disponibles: la agenda todavía no entrega identificadores válidos de servicios y profesionales.'
                    : 'Estadísticas no disponibles: los datos de la agenda no permiten una distribución fiable.';
            return;
        }
        const s=resultado.estadisticas;
        if(dashboardActivo){
            $('#alcanceDistribucion').textContent=describirFiltrosDashboard();
            // Solo importes históricos y campos mínimos de reservas ya autorizadas.
            const datos=seleccion.map(r=>({id_reserva:r.id_reserva,estado:r.estado,fecha_hora_inicio:r.fecha_hora_inicio,precio_servicio:r.precio_servicio,monto_abono:r.monto_abono}));
            const datosMensuales=reservas.filter(r=>!$('#dashboardEstado').value||r.estado===$('#dashboardEstado').value)
                .map(r=>({id_reserva:r.id_reserva,estado:r.estado,fecha_hora_inicio:r.fecha_hora_inicio,precio_servicio:r.precio_servicio,monto_abono:r.monto_abono}));
            MerakiDashboardGraficos.dibujar({reservas:datos,estadisticas:s,reservasEconomicas:datosMensuales,periodo:$('#economiaMes').value,seleccionar:$,documento:document});
        }
        $('#dashboardTotal').textContent=String(s.totalReservasUnicas);
        for(const [id,estado] of Object.entries(camposDashboard)){
            // Reutilizar los desgloses del cálculo existente; no contar de nuevo la agenda.
            $('#'+id).textContent=String(s.porServicio.reduce((total,g)=>total+g.porEstado[estado],0));
        }
        $('#distribucionReservas').dataset.estado=s.totalReservasUnicas?'disponible':'vacia';
        $('#estadoDistribucion').textContent=s.totalReservasUnicas
            ? dashboardActivo?'Distribución según los filtros del Dashboard. Datos del emprendimiento seleccionado.':'Distribución de toda la agenda autorizada, independiente de los filtros de la lista.'
            : dashboardActivo&&reservas.length?'No hay reservas que coincidan con los filtros del Dashboard.':'Todavía no hay reservas para calcular una distribución.';
        $('#totalDistribucion').textContent=String(s.totalReservasUnicas);
        $('#serviciosDistribucion').textContent=String(s.porServicio.length);
        $('#profesionalesDistribucion').textContent=String(s.porProfesional.length);
        $('#datosDistribucion').hidden=false;
        const porcentaje=new Intl.NumberFormat('es-CL',{maximumFractionDigits:2});
        for(const [destino,grupos,campoId,campoNombre,tipo] of [
            ['distribucionServicios',s.porServicio,'id_servicio','servicio','Servicio'],
            ['distribucionProfesionales',s.porProfesional,'id_trabajadora','trabajadora','Profesional']
        ]){
            const lista=$('#'+destino);lista.replaceChildren();
            for(const g of grupos){
                const articulo=document.createElement('article'),titulo=document.createElement('h5'),cantidad=document.createElement('p'),desglose=document.createElement('ul');
                const tituloId=destino+'-'+g[campoId];
                titulo.setAttribute('id',tituloId);articulo.setAttribute('aria-labelledby',tituloId);
                titulo.textContent=(g[campoNombre]||g.nombres.join(' / '))+' · '+tipo+' #'+g[campoId];
                cantidad.className='distribucion-cantidad';
                cantidad.textContent=g.reservas+' reserva(s) · '+porcentaje.format(g.porcentaje)+' %';
                const barra=document.createElement('meter');barra.className='barra-distribucion';
                barra.setAttribute('min','0');barra.setAttribute('max','100');barra.setAttribute('value',String(g.porcentaje));
                // El dato ya está en el texto contiguo. La barra es redundante,
                // no una segunda región anunciada ni un control interactivo.
                barra.setAttribute('aria-hidden','true');
                for(const [estado,cantidadEstado] of Object.entries(g.porEstado)){
                    const li=document.createElement('li');li.textContent=MerakiAgenda.estado(estado)+': '+cantidadEstado;desglose.append(li);
                }
                const detalle=document.createElement('details'),sumario=document.createElement('summary');
                detalle.setAttribute('open','');sumario.textContent='Desglose por estado';detalle.append(sumario,desglose);
                articulo.append(titulo,cantidad,barra,detalle);lista.append(articulo);
            }
        }
        const nombresLideres=(grupos,ids,campoId,campoNombre)=>{
            const porId=new Map(grupos.map(g=>[g[campoId],g]));
            return ids.map(id=>{const g=porId.get(id);return (g[campoNombre]||g.nombres.join(' / '))+' (#'+id+')';}).join('; ');
        };
        $('#lideresServicios').textContent=s.serviciosMasReservados.length
            ? (s.serviciosMasReservados.length>1?'Empate en servicios más reservados: ':'Servicio más reservado: ')+nombresLideres(s.porServicio,s.serviciosMasReservados,'id_servicio','servicio')
            : 'Sin servicios más reservados.';
        $('#lideresProfesionales').textContent=s.profesionalesMasReservados.length
            ? (s.profesionalesMasReservados.length>1?'Empate en profesionales con más reservas: ':'Profesional con más reservas: ')+nombresLideres(s.porProfesional,s.profesionalesMasReservados,'id_trabajadora','trabajadora')
            : 'Sin profesionales con reservas.';
        $('#advertenciasDistribucion').textContent=[
            s.duplicadosOmitidos?s.duplicadosOmitidos+' registro(s) duplicado(s) idéntico(s) contados una sola vez.':'',
            resultado.advertencias.length?'Hay identificadores con varias etiquetas; no se ha elegido un nombre vigente.':''
        ].filter(Boolean).join(' ');
    }catch{
        limpiarDistribucionReservas('error');
    }
}
const dinero=valor=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(valor));
function textoArticulo(articulo,valor){const p=document.createElement('p');p.textContent=valor;articulo.append(p);}
function renderAgenda(anunciar=true){
    if(!agendaReservas)return;
    const visibles=MerakiAgenda.filtrar(agendaReservas,$('#filtroFecha').value,$('#filtroEstado').value);
    const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    $('#totalReservas').textContent=agendaReservas.length;
    $('#reservasHoy').textContent=agendaReservas.filter(r=>r.fecha_hora_inicio.slice(0,10)===hoy).length;
    $('#reservasConfirmadas').textContent=agendaReservas.filter(r=>r.estado==='confirmada').length;
    $('#reservasPendientes').textContent=agendaReservas.filter(r=>r.estado==='pendiente_abono').length;
    const lista=$('#reservas');lista.replaceChildren();
    $('#resumenReservas').textContent=visibles.length+' de '+agendaReservas.length+' reservas';
    presentacionAgenda.aplicarFiltro(visibles.map(r=>r.id_reserva));
    mostrarPresentacionAgenda(anunciar!==false);
    if(!visibles.length){const vacio=document.createElement('div');vacio.className='sin-reservas';vacio.textContent=presentacionAgenda.obtenerEstado().mensaje;lista.append(vacio);return;}
    for(const r of visibles){
        const a=document.createElement('article');a.className='reserva-card';
        const cabecera=document.createElement('div');cabecera.className='reserva-cabecera';
        const titulo=document.createElement('h3');titulo.textContent='Reserva #'+r.id_reserva;
        const etiqueta=document.createElement('span');etiqueta.className='reserva-estado';etiqueta.dataset.estado=r.estado;etiqueta.textContent=MerakiAgenda.estado(r.estado);cabecera.append(titulo,etiqueta);a.append(cabecera);
        const parrafo=(texto,clase)=>{const p=document.createElement('p');p.textContent=texto;p.className=clase;a.append(p);};
        parrafo(r.clienta+' · '+r.servicio,'reserva-persona');
        const dia=new Date(r.fecha_hora_inicio.slice(0,10)+'T12:00:00');
        const fecha=Number.isNaN(dia.getTime())?'Fecha no disponible':new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'short',year:'numeric'}).format(dia);
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
    const version=++versionAgenda;
    const sesion=versionSesion;
    const negocio=$('#negocio').value;
    const id=Number(negocio);
    if($('#panel').hidden || !Number.isSafeInteger(id) || id<1){
        if(presentacionAgenda.obtenerEstado().estado!=='sesion_vencida')reiniciarPresentacionAgenda();
        limpiarAgenda('No disponible');
        return;
    }
    if(!contextoPresentacionAgenda||contextoPresentacionAgenda.sesion!==sesion||contextoPresentacionAgenda.negocio!==negocio){
        $('#dashboardFecha').value='';$('#dashboardEstado').value='';
        const propio=negociosPerfil.find(n=>n.id_emprendimiento===id);
        if(!propio){reiniciarPresentacionAgenda();limpiarAgenda('No disponible');return;}
        presentacionAgenda.cambiarContexto({sesion:String(sesion),idEmprendimiento:id,nombre:propio.nombre});
        contextoPresentacionAgenda={sesion,negocio};
        mostrarPresentacionAgenda();
    }
    const ticket=presentacionAgenda.iniciarCarga();
    const vigente=()=>version===versionAgenda && sesion===versionSesion &&
        negocio===$('#negocio').value && !$('#panel').hidden;
    limpiarAgenda('Cargando…','Buscando próxima atención…');
    mostrarPresentacionAgenda();
    let datosParaDiagnosticoDistribucion=null;
    try{
        const datos=await api('/api/reservas?id_emprendimiento='+encodeURIComponent(negocio),'GET',undefined,vigente);
        if(!vigente())return;
        if(Array.isArray(datos))datosParaDiagnosticoDistribucion=datos;
        const entrada={reservas:datos,contexto:{
            idEmprendimientoConsultado:id,
            idEmprendimientoSeleccionado:Number($('#negocio').value),
            consultaAutorizada:true,
            respuestaExitosa:true
        }};
        const indicador=MerakiResumen.calcularReservasPorCerrar(entrada);
        if(indicador.estado!=='disponible')throw Error('La respuesta de reservas no es válida.');
        const idsVisibles=MerakiAgenda.filtrar(datos,$('#filtroFecha').value,$('#filtroEstado').value).map(r=>r.id_reserva);
        if(!presentacionAgenda.aceptarRespuesta(ticket,{
            reservas:datos,idsVisibles,recibidoEnEpochMs:Date.now(),consultaAutorizada:true,respuestaExitosa:true
        }))throw Error('La respuesta de reservas no es válida.');
        agendaReservas=datos;
        renderAgenda(false);
        $('#reservasPorCerrar').textContent=String(indicador.cantidad);
        actualizarProximaAtencion(entrada);
        actualizarDistribucionReservas(datos);
        mostrarPresentacionAgenda();
    }catch(error){
        if(!vigente())return;
        limpiarAgenda('No disponible','No se pudo cargar la agenda');
        if(datosParaDiagnosticoDistribucion)actualizarDistribucionReservas(datosParaDiagnosticoDistribucion,true);
        presentacionAgenda.registrarError(ticket);
        mostrarPresentacionAgenda();
        // El error ya está anunciado en la región de agenda; no repetirlo
        // en los mensajes globales de los consumidores de reservas().
        return false;
    }
}
$('#filtroFecha').onchange=$('#filtroEstado').onchange=renderAgenda;
$('#limpiarFiltros').onclick=()=>{$('#filtroFecha').value='';$('#filtroEstado').value='';renderAgenda();};
$('#reintentarAgenda').onclick=async()=>{
    const sesion=versionSesion,negocio=$('#negocio').value;
    try{await reservas();}catch{ /* El estado de agenda ya presenta el error. */ }
    if(sesion===versionSesion&&negocio===$('#negocio').value&&!$('#panel').hidden&&$('#reintentarAgenda').hidden)$('#cargar').focus();
};

async function notificaciones(){const datos=await api('/api/notificaciones');mostrar($('#notificaciones'),datos);[...$('#notificaciones').children].forEach((a,i)=>{const n=datos[i];if(!n)return;const opciones=n.requiere_revision?[['entregado','Confirmar entrega'],['no_entregado','Confirmar que no se entregó']]:['fallido','pendiente'].includes(n.estado)&&n.intentos<3?[['reintentar','Reintentar envío']]:[];if(!opciones.length)return;const label=document.createElement('label'),e=document.createElement('textarea');label.textContent='Evidencia (sin enlaces privados ni datos personales)';e.minLength=10;e.maxLength=500;label.append(e);a.append(label);for(const [decision,titulo] of opciones){const b=document.createElement('button');b.textContent=titulo;b.onclick=async()=>{if(e.value.trim().length<10){estado.textContent='Registra al menos 10 caracteres de evidencia.';return;}if(!confirm(titulo+' para la reserva '+n.id_reserva+'?'))return;for(const x of a.querySelectorAll('button'))x.disabled=true;try{const d=await api('/api/notificaciones/'+n.id_notificacion+'/'+(decision==='reintentar'?'reintentar':'revisar'),'POST',{decision,evidencia:e.value});estado.textContent=d.requiereRevision?'Resultado incierto. Revisa el proveedor antes de reenviar.':d.enviado?'Proveedor aceptó el mensaje.':d.revisado?'Revisión registrada.':'No se envió. Consulta el estado actualizado.';await notificaciones();}catch(err){estado.textContent=err.message;for(const x of a.querySelectorAll('button'))x.disabled=false;}};a.append(b);}});}
async function iniciar(){
    const sesion=++versionSesion;
    versionAgenda++;
    limpiarAgenda('No disponible');
    await api('/api/auth/yo');
    if(sesion!==versionSesion)return;
    const negocios=await api('/api/mis-emprendimientos');
    if(sesion!==versionSesion)return;
    negociosPerfil=negocios;
    const selector=$('#negocio');
    selector.replaceChildren();
    for(const negocio of negocios){
        const opcion=document.createElement('option');
        opcion.value=negocio.id_emprendimiento;
        opcion.textContent=negocio.nombre;
        selector.append(opcion);
    }
    $('#login').hidden=true;
    $('#acceso').hidden=true;
    $('#panel').hidden=false;
    navegacion.iniciar();
    cargarPerfil();
    if(negocios.length)await reservas();
    if(sesion!==versionSesion)return;
    await servicios.cargar(selector.value);
    await trabajadoras.cargar(selector.value);
    await horarios.cargar(selector.value);
    await suscripcion.cargar();
    await notificaciones();
}
let ingresando=false;
$('#login').onsubmit=async e=>{
    e.preventDefault();if(ingresando)return;ingresando=true;ocultarClave();
    const b=e.submitter||e.target.querySelector('button[type="submit"],button:not([type]),input[type="submit"]');
    if(b)b.disabled=true;
    try{await api('/api/auth/login','POST',Object.fromEntries(new FormData(e.target)));e.target.reset();await iniciar();estado.textContent='Sesión iniciada.';}
    catch(error){estado.textContent=error.message;}
    finally{ingresando=false;if(b)b.disabled=false;}
};
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
function invalidarConsultaPago(){versionConsultaPago++;consultaPago=null;$('#recuperarPago').disabled=true;$('#verificarPagoWebpay').hidden=true;$('#resultadoPago').replaceChildren();}
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
        if(!confirm('¿Verificar el abono '+id+' de la reserva '+consultaPago.reserva+' en Webpay y registrar su resultado si es concluyente? No se generará otro cobro.'))return;
    }
    const version=++versionConsultaPago;procesandoPago=true;
    const campo=e.target.querySelector('input[name="id"]');campo.disabled=true;
    for(const b of e.target.querySelectorAll('button'))b.disabled=true;
    $('#verificarPagoWebpay').hidden=true;
    $('#resultadoPago').textContent=accion==='recuperar'?'Verificando y registrando el pago…':'Consultando el abono…';
    consultaPago=null;
    try{
        const ruta=accion==='verificar'?'estado?verificar=1':accion;
        const datos=await api('/api/abonos/'+id+'/'+ruta,accion==='recuperar'?'POST':'GET');
        if(version!==versionConsultaPago)return;
        const vista=resultadoPago(datos);
        if(accion!=='recuperar')consultaPago={id,reserva:datos.id_reserva,permitida:vista.puedeRecuperar};
        $('#verificarPagoWebpay').hidden=datos.puede_consultar_webpay!==true;
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
