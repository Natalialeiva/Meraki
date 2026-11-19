const $ = selector => document.querySelector(selector);
const estado = $('#estado');
const noDisponible = 'Este servicio no está disponible para reservar por el momento';
const nombre = $('#formReserva input[name="nombre"]');
const correo = $('#formReserva input[name="correo"]');
const telefono = $('#formReserva input[name="telefono"]');
let intentoInvitada=null;
const intentoBloqueado=()=>['enviando','resultado_incierto','intento_vencido'].includes(intentoInvitada?.estado);
let versionIntento=0;
let negocio = null, servicios = [], creada = false, enviando = false, horas = [], contextoHoras = '';
let versionBusqueda = 0, versionSeleccion = 0, versionProfesional = 0, versionHoras = 0;
const dinero = valor => new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP', maximumFractionDigits:0}).format(Number(valor));
const servicioActual = () => servicios.find(s => String(s.id_servicio) === $('#servicio').value);
const contexto = () => [$('#servicio').value, $('#profesional').value, $('#fecha').value].join('|');
function informar(texto, tipo = 'info') { estado.textContent = texto; estado.dataset.tipo = tipo; }
// Solo presentación: la API y el campo date conservan siempre AAAA-MM-DD.
function fechaLegible(valor) {
    if (!valor) return 'Sin seleccionar';
    const fecha = new Date(valor + 'T12:00:00Z');
    if (Number.isNaN(fecha.getTime())) return 'Sin seleccionar';
    return new Intl.DateTimeFormat('es-CL', {weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC'}).format(fecha);
}
async function api(url, method = 'GET', datos, cabeceras = {}) {
    const respuesta = await fetch(url, {method, cache:'no-store', headers:{'Content-Type':'application/json',...cabeceras}, body:datos ? JSON.stringify(datos) : undefined});
    let d; try { d = JSON.parse(await respuesta.text()); } catch { throw Object.assign(Error('No se pudo leer la respuesta del servidor. Intenta nuevamente.'),{status:respuesta.status,codigo:'RESPUESTA_INVALIDA'}); }
    if (!respuesta.ok) throw Object.assign(Error(d?.mensaje || 'No se pudo completar la operación'),{status:respuesta.status,codigo:d?.codigo,retryAfter:respuesta.headers?.get('Retry-After')});
    return d;
}
function opciones(elemento, datos, clave, etiqueta = v => v.nombre, indicacion = 'Selecciona una opción') {
    elemento.replaceChildren();
    const vacia = document.createElement('option'); vacia.value = ''; vacia.textContent = indicacion; elemento.append(vacia);
    for (const dato of datos) {
        const o = document.createElement('option'); o.value = dato[clave]; o.textContent = etiqueta(dato); o.disabled = dato.reservable === false; elemento.append(o);
    }
    elemento.value = '';
}
function limpiarHoras() {
    versionHoras++; horas = []; contextoHoras = '';
    opciones($('#hora'), [], 'hora', undefined, 'Consulta las horas disponibles');
    $('#hora').setAttribute('aria-busy', 'false');
    $('#ayudaHora').textContent = 'Selecciona una profesional y una fecha; después consulta las horas disponibles.';
    $('#disponibilidad').disabled = !$('#profesional').value || !servicioActual() || servicioActual().reservable === false;
    resumen();
}
function errorCampo(campo, destino, texto) { campo.setAttribute('aria-invalid', texto ? 'true' : 'false'); $(destino).textContent = texto; }
const camposInteractuados = new Set();
function validar(mostrar = false) {
    const n = nombre.value.trim(), c = correo.value.trim(), t = telefono.value.trim();
    const errores = {
        nombre: !n ? 'Escribe tu nombre.' : n.length > 100 ? 'Usa como máximo 100 caracteres.' : '',
        correo: !c ? 'Escribe tu correo.' : c.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? 'Escribe un correo válido, por ejemplo nombre@correo.cl.' : '',
        telefono: t.length > 20 ? 'Usa como máximo 20 caracteres.' : '',
        fecha: !$('#fecha').value ? 'Selecciona una fecha.' : $('#fecha').value < $('#fecha').min ? 'Elige hoy o una fecha posterior.' : ''
    };
    for (const [clave, campo, destino] of [['nombre', nombre, '#errorNombre'], ['correo', correo, '#errorCorreo'], ['telefono', telefono, '#errorTelefono'], ['fecha', $('#fecha'), '#errorFecha']]) {
        if (mostrar || camposInteractuados.has(campo)) errorCampo(campo, destino, errores[clave]);
    }
    return !Object.values(errores).some(Boolean);
}
function resumen() {
    const s = servicioActual(), profesional = $('#profesional').selectedOptions[0]?.textContent;
    $('#seleccionProfesional').textContent = $('#profesional').value ? 'Profesional seleccionada: ' + profesional : 'Selecciona una profesional.';
    const panel = $('#resumen'); panel.replaceChildren();
    const lineas = [
        ['Emprendimiento', negocio?.nombre || 'Selecciona un emprendimiento', 'negocio'],
        ['Servicio', s?.servicio || 'Selecciona un servicio disponible', 'servicio'],
        ['Profesional', $('#profesional').value ? profesional : 'Sin seleccionar', 'profesional'],
        ['Fecha', fechaLegible($('#fecha').value), 'fecha'],
        ['Hora', $('#hora').value ? $('#hora').value.slice(0, 5) : 'Sin seleccionar', 'hora'],
        ['Precio total', s ? dinero(s.precio) : 'Pendiente de selección', 'precio'],
        ['Abono requerido', s ? dinero(s.monto_abono) : 'Pendiente de selección', 'abono'],
        ['Correo de confirmación', correo.value.trim() || 'Escribe tu correo', 'correo']
    ];
    for (const [etiqueta, valor, campo] of lineas) {
        const fila = document.createElement('div'), titulo = document.createElement('dt'), dato = document.createElement('dd');
        fila.className = 'resumen-fila resumen-' + campo; titulo.textContent = etiqueta; dato.textContent = valor;
        fila.append(titulo, dato); panel.append(fila);
    }
    const horaValida = contextoHoras === contexto() && horas.includes($('#hora').value);
    $('#crearReserva').disabled = creada || enviando || intentoBloqueado() || !s || s.reservable === false || !$('#profesional').value || !horaValida || !validar();
}
function tarjetasServicios() {
    const lista = $('#listaServicios'); lista.replaceChildren();
    for (const s of servicios) {
        const tarjeta = document.createElement('article'), h = document.createElement('h3');
        tarjeta.className = 'servicio-card';
        tarjeta.dataset.seleccionado = String(String(s.id_servicio) === $('#servicio').value);
        tarjeta.dataset.disponible = String(s.reservable !== false);
        h.textContent = s.servicio; tarjeta.append(h);
        const fotografia = document.createElement('div');
        fotografia.className = 'servicio-fotografia';
        const sinFoto = () => { fotografia.replaceChildren(); fotografia.textContent = 'Fotografía no disponible'; };
        if (typeof s.imagen_url === 'string' && /^\/media\/servicios\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/.test(s.imagen_url)) {
            const imagen = document.createElement('img');
            imagen.alt = s.servicio; imagen.width = 640; imagen.height = 400;
            imagen.loading = 'lazy'; imagen.decoding = 'async';
            imagen.onerror = sinFoto; imagen.src = s.imagen_url;
            fotografia.append(imagen);
        } else sinFoto();
        tarjeta.append(fotografia);
        const detalles = [
            [negocio.nombre, 'servicio-negocio'],
            [negocio.comuna, 'servicio-comuna'],
            [s.categoria, 'servicio-categoria'],
            [s.descripcion, 'servicio-descripcion'],
            [s.precio != null ? 'Precio total: ' + dinero(s.precio) : '', 'servicio-precio'],
            [s.duracion_min != null ? 'Duración: ' + s.duracion_min + ' minutos' : '', 'servicio-duracion'],
            [s.monto_abono != null ? 'Abono requerido: ' + dinero(s.monto_abono) : '', 'servicio-abono'],
            [s.reservable === false ? 'Servicio publicado. '+noDisponible : 'Servicio publicado · Disponible para reservar', 'servicio-estado']
        ];
        for (const [texto, clase] of detalles) {
            if (!texto) continue;
            const p = document.createElement('p'); p.className = clase;
            if (clase === 'servicio-precio' || clase === 'servicio-abono') {
                const etiqueta = document.createElement('span'), importe = document.createElement('strong');
                etiqueta.textContent = clase === 'servicio-precio' ? 'Precio total' : 'Abono requerido';
                importe.textContent = dinero(clase === 'servicio-precio' ? s.precio : s.monto_abono);
                p.append(etiqueta, importe);
            } else p.textContent = texto;
            tarjeta.append(p);
        }
        const elegir = document.createElement('button'); elegir.type = 'button'; elegir.disabled = s.reservable === false || enviando || creada || intentoBloqueado();
        elegir.textContent = s.reservable === false ? 'Sin reservas disponibles' : 'Elegir ' + s.servicio;
        elegir.onclick = () => {
            if (enviando || creada || intentoBloqueado()) return;
            $('#servicio').value = String(s.id_servicio);
            // La tarjeta se vuelve a dibujar; conservar el foco en un control estable.
            $('#servicio').focus();
            return profesionales();
        };
        tarjeta.append(elegir); lista.append(tarjeta);
    }
}
async function profesionales() {
    if (intentoBloqueado()) return;
    const version = ++versionProfesional;
    opciones($('#profesional'), [], 'id_trabajadora', undefined, 'Selecciona una profesional'); limpiarHoras(); tarjetasServicios();
    $('#disponibilidad').disabled = true;
    const s = servicioActual();
    if (!s || s.reservable === false) { $('#avisoServicio').textContent = servicios.length ? noDisponible : 'No hay servicios publicados por el momento.'; return; }
    $('#avisoServicio').textContent = 'Buscando profesionales…';
    try {
        const datos = await api('/api/servicios/' + s.id_servicio + '/trabajadoras');
        if (version !== versionProfesional) return;
        opciones($('#profesional'), datos, 'id_trabajadora', undefined, 'Selecciona una profesional');
        $('#avisoServicio').textContent = datos.length ? 'Selecciona una profesional y una fecha para consultar horas.' : noDisponible;
        resumen();
    } catch (error) { if (version === versionProfesional) { $('#avisoServicio').textContent = error.message; informar(error.message, 'error'); } }
}
async function seleccionar(dato) {
    globalThis.destacarNegocioMapa?.(dato.id_emprendimiento);
    if (enviando || intentoBloqueado()) return;
    const version = ++versionSeleccion;
    versionProfesional++;
    // El aviso anterior puede estar en la reserva que se va a ocultar.
    $('#estadoCatalogo').append(estado);
    const cambioNegocio = negocio?.id_emprendimiento !== dato.id_emprendimiento;
    negocio = dato; creada = false; servicios = [];
    $('#camposReserva').disabled = false; $('#consulta').hidden = true; $('#nuevaReserva').hidden = true; $('#reserva').hidden = true;
    opciones($('#servicio'), [], 'id_servicio', undefined, 'Selecciona un servicio');
    opciones($('#profesional'), [], 'id_trabajadora', undefined, 'Selecciona una profesional');
    $('#listaServicios').replaceChildren();
    $('#avisoServicio').textContent = '';
    if (cambioNegocio) {
        $('#fecha').value = '';
        errorCampo($('#fecha'), '#errorFecha', '');
    }
    limpiarHoras();
    informar('Cargando servicios de ' + dato.nombre + '…', 'carga');
    try {
        const datos = await api('/api/emprendimientos/' + dato.id_emprendimiento + '/servicios');
        if (version !== versionSeleccion) return;
        servicios = datos;
        opciones($('#servicio'), datos, 'id_servicio', s => s.servicio + ' · ' + dinero(s.precio) + (s.reservable === false ? ' · No disponible por el momento' : ''), 'Selecciona un servicio');
        const primera = datos.find(s => s.reservable !== false); $('#servicio').value = primera ? String(primera.id_servicio) : '';
        $('#tituloReserva').textContent = 'Reserva en ' + dato.nombre; $('#reserva').hidden = false;
        $('#estadoReserva').append(estado);
        informar(primera ? 'Elige profesional, fecha y hora.' : datos.length ? noDisponible : 'No hay servicios publicados por el momento.');
        await profesionales();
        if(version===versionSeleccion) $('#listaServicios').scrollIntoView?.({behavior:'smooth',block:'start'});
    } catch {
        if (version === versionSeleccion) informar('No se pudieron cargar los servicios de ' + dato.nombre + '. Vuelve a elegir el emprendimiento para reintentar.', 'error');
    }
}

let actualizandoServicios=null;
async function actualizarServicios(){
    if(!negocio||enviando||creada||intentoBloqueado())return;
    if(actualizandoServicios)return actualizandoServicios;
    const version=versionSeleccion,id=negocio.id_emprendimiento;
    const boton=$('#actualizarCatalogoServicios');boton.disabled=true;
    actualizandoServicios=(async()=>{
        try{
            const datos=await api('/api/emprendimientos/'+id+'/servicios');
            if(version!==versionSeleccion||enviando||creada||intentoBloqueado())return;
            const anterior=servicioActual(),elegido=$('#servicio').value;
            servicios=datos;
            opciones($('#servicio'),datos,'id_servicio',s=>s.servicio+' · '+dinero(s.precio)+(s.reservable===false?' · No disponible por el momento':''),'Selecciona un servicio');
            const vigente=datos.find(s=>String(s.id_servicio)===elegido&&s.reservable!==false);
            $('#servicio').value=vigente?elegido:'';
            const cambio=!vigente||!anterior||['precio','monto_abono','duracion_min','reservable'].some(k=>String(anterior[k])!==String(vigente[k]));
            tarjetasServicios();resumen();
            if(cambio)await profesionales();
            informar('Servicios actualizados.'+(cambio?' Revisa la selección y vuelve a consultar disponibilidad.':''));
        }catch(e){if(version===versionSeleccion&&!enviando&&!creada&&!intentoBloqueado())informar('No se pudieron actualizar los servicios. Intenta nuevamente.','error');}
    })();
    try{await actualizandoServicios;}finally{actualizandoServicios=null;boton.disabled=false;}
}
$('#actualizarCatalogoServicios').onclick=actualizarServicios;
document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='visible')void actualizarServicios();});
globalThis.addEventListener?.('focus',()=>{void actualizarServicios();});

// Solo memoria de esta visita; las distancias se derivan al dibujar y no se guardan.
let resultadosCatalogo = [], ubicacionCatalogo = null, calcularDistancia = null;
function actualizarCercania(posicion, calcular) {
    ubicacionCatalogo = posicion ? {...posicion} : null; calcularDistancia = calcular;
    $('#controlCercania').hidden = !posicion;
    $('#ordenCercania').value = posicion ? 'cercania' : 'original';
    dibujarCatalogo();
}
let receptorMapa = null, vistaIndicaciones=null;
function configurarIndicaciones(crearVista) {vistaIndicaciones=crearVista;dibujarCatalogo();}
function suscribirMapa(receptor) { receptorMapa = receptor; receptor(resultadosCatalogo,{ubicacion:ubicacionCatalogo}); }
function dibujarCatalogo() {
    const foco=document.activeElement;
    const idEnFoco=foco?.closest?.('article[data-id-negocio]')?.dataset.idNegocio;
    const accionEnFoco=foco?.dataset.accion;

    $('#resultados').replaceChildren();
    const filas = resultadosCatalogo.map((dato, indice) => ({dato, indice, distancia:ubicacionCatalogo && calcularDistancia ? calcularDistancia(ubicacionCatalogo.latitud, ubicacionCatalogo.longitud, dato.latitud, dato.longitud) : null}));
    if (ubicacionCatalogo && $('#ordenCercania').value === 'cercania') filas.sort((a,b) => (a.distancia ?? Infinity) - (b.distancia ?? Infinity) || a.indice - b.indice);
    receptorMapa?.(filas.map(f=>({...f.dato,distancia:f.distancia})),{ubicacion:ubicacionCatalogo});
        for (const {dato:d, distancia} of filas) {
            const a = document.createElement('article'), h = document.createElement('h3'), p = document.createElement('p'), b = document.createElement('button');
            a.className = 'negocio-card';a.dataset.idNegocio=String(d.id_emprendimiento);
            h.textContent = d.nombre; p.textContent = [d.descripcion, d.comuna, d.direccion].filter(Boolean).join(' · ');
            b.type = 'button'; b.dataset.accion='servicios'; b.textContent = 'Ver servicios de ' + d.nombre; b.onclick = () => seleccionar(d);
            a.append(h, p, b);
            const foto=document.createElement('div');foto.className='fotoEmprendimiento';
            const sinFoto=()=>{foto.replaceChildren();const aviso=document.createElement('span');aviso.textContent='Sin fotografía disponible';foto.append(aviso);};
            if(typeof d.imagen_url==='string'&&/^\/media\/servicios\/[a-f0-9-]+\.webp$/.test(d.imagen_url)){
                const img=document.createElement('img');img.src=d.imagen_url;img.alt='Servicio de '+d.nombre;img.loading='lazy';img.onerror=sinFoto;foto.append(img);
            }else sinFoto();
            a.append(foto);
            if (vistaIndicaciones && (d.latitud==null || d.longitud==null)) a.append(vistaIndicaciones(d));

            if (ubicacionCatalogo) {
                const distanciaTexto = document.createElement('p'); distanciaTexto.className = 'distanciaNegocio';
                distanciaTexto.textContent = distancia === null ? 'Distancia no disponible' : 'Aprox. ' + (distancia < 0.1 ? 'menos de 0,1' : new Intl.NumberFormat('es-CL', {maximumFractionDigits:1}).format(distancia)) + ' km';
                a.append(distanciaTexto);
            } $('#resultados').append(a);
        }
    if (idEnFoco && ['servicios','indicaciones'].includes(accionEnFoco)) {
        const tarjeta=Array.from($('#resultados').children).find(n=>n.dataset.idNegocio===idEnFoco);
        const destino=tarjeta?.querySelector('[data-accion="'+accionEnFoco+'"]');
        (destino||$('#tituloCatalogo')).focus();
    }
}
$('#ordenCercania').onchange = dibujarCatalogo;

async function cargarCategorias() {
    const selector = $('#categoriaBusqueda');
    const estadoCategorias = $('#estadoCategorias');
    try {
        const categorias = await api('/api/categorias');
        if (!Array.isArray(categorias) || categorias.some(c =>
            !c || !Number.isSafeInteger(c.id_categoria) || c.id_categoria < 1 ||
            typeof c.nombre !== 'string' || !c.nombre.trim())) {
            throw Error('Categorías inválidas');
        }
        opciones(selector, categorias, 'id_categoria', c => c.nombre, 'Todas las categorías');
        selector.disabled = categorias.length === 0;
        estadoCategorias.textContent = categorias.length ? '' : 'No hay categorías disponibles.';
    } catch {
        estadoCategorias.textContent = 'Las categorías no están disponibles temporalmente. Puedes buscar por nombre y comuna.';
    }
}

const camposBusqueda = {nombre:'Nombre', comuna:'Comuna', id_categoria:'Categoría'};
let ultimaBusqueda = new URLSearchParams();

function repetirBusqueda(filtros, campoFoco) {
    if (enviando || intentoBloqueado()) return;
    const formulario = $('#buscar');
    for (const clave of Object.keys(camposBusqueda)) {
        formulario.elements.namedItem(clave).value = filtros.get(clave) || '';
    }
    if (campoFoco) formulario.elements.namedItem(campoFoco).focus();
    else $('#tituloCatalogo').focus();
    return formulario.requestSubmit();
}

function mostrarFiltros(filtros) {
    const lista = $('#filtrosAplicados');
    lista.replaceChildren();
    for (const [clave, etiqueta] of Object.entries(camposBusqueda)) {
        const valor = filtros.get(clave)?.trim();
        if (!valor) continue;
        const visible = clave === 'id_categoria'
            ? $('#categoriaBusqueda').selectedOptions[0]?.textContent || valor
            : valor;
        const item = document.createElement('li');
        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'secundario';
        quitar.textContent = etiqueta + ': ' + visible + ' ×';
        quitar.setAttribute('aria-label', 'Quitar filtro ' + etiqueta + ': ' + visible);
        quitar.onclick = () => {
            const restantes = new URLSearchParams(filtros);
            restantes.delete(clave);
            return repetirBusqueda(restantes, clave);
        };
        item.append(quitar);
        lista.append(item);
    }
    lista.hidden = lista.children.length === 0;
}

$('#reintentarBusqueda').onclick = () => repetirBusqueda(ultimaBusqueda);

$('#buscar').onsubmit = async evento => {
    evento.preventDefault(); if (enviando || intentoBloqueado()) return;
    const filtros = new URLSearchParams(new FormData(evento.target));
    if (!filtros.get('id_categoria')) filtros.delete('id_categoria');
    ultimaBusqueda = filtros;
    mostrarFiltros(filtros);
    const version = ++versionBusqueda; versionSeleccion++; versionProfesional++; limpiarHoras();
    $('#reserva').hidden = true; resultadosCatalogo = []; receptorMapa?.([]); $('#resultados').replaceChildren();
    $('#resultados').setAttribute('aria-busy', 'true');
    $('#reintentarBusqueda').hidden = true;
    $('#estadoCatalogo').append(estado);
    informar('Buscando emprendimientos…', 'carga');
    try {
        const datos = await api('/api/emprendimientos?' + filtros);
        if (version !== versionBusqueda) return;
        resultadosCatalogo = datos; dibujarCatalogo();
        informar(datos.length ? datos.length + ' emprendimiento(s). Selecciona uno para ver sus servicios.' : 'No encontramos emprendimientos con esos filtros. Prueba quitando algún filtro o pulsa Ver todos.');
    } catch (error) {
        if (version !== versionBusqueda) return;
        informar(error.message, 'error');
        $('#reintentarBusqueda').hidden = false;
    } finally {
        if (version === versionBusqueda) $('#resultados').setAttribute('aria-busy', 'false');
    }
};
$('#limpiarBusqueda').onclick = () => {
    if (enviando || intentoBloqueado()) return;
    const orden = $('#ordenCercania').value;
    $('#buscar').reset();
    $('#ordenCercania').value = orden;
    return $('#buscar').requestSubmit();
};
$('#servicio').onchange = profesionales;
$('#profesional').onchange = () => { if (intentoBloqueado()) return; limpiarHoras(); $('#disponibilidad').disabled = !$('#profesional').value; };
$('#fecha').onchange = () => { if (intentoBloqueado()) return; limpiarHoras(); errorCampo($('#fecha'), '#errorFecha', !$('#fecha').value ? 'Selecciona una fecha.' : $('#fecha').value < $('#fecha').min ? 'Elige hoy o una fecha posterior.' : ''); };
$('#hora').onchange = () => { if (intentoBloqueado()) return; resumen(); if ($('#hora').value) informar('Revisa el resumen y completa tus datos para crear la reserva.'); };
for (const campo of [nombre, correo, telefono]) {
    campo.oninput = campo.onblur = () => { if (intentoBloqueado()) return; camposInteractuados.add(campo); validar(); resumen(); };
}
$('#disponibilidad').onclick = async () => {
    if (intentoBloqueado()) return;
    limpiarHoras();
    const s = servicioActual();
    if (!s || s.reservable === false || !$('#profesional').value) { informar('Selecciona un servicio disponible y una profesional.', 'error'); return; }
    if (!$('#fecha').value || $('#fecha').value < $('#fecha').min) {
        const texto = !$('#fecha').value ? 'Selecciona una fecha antes de consultar horas.' : 'Elige hoy o una fecha posterior.';
        errorCampo($('#fecha'), '#errorFecha', texto); informar(texto, 'error'); return;
    }
    const version = versionHoras, consulta = contexto();
    const parametros = new URLSearchParams({id_servicio:$('#servicio').value, id_trabajadora:$('#profesional').value, fecha:$('#fecha').value});
    $('#disponibilidad').disabled = true; $('#hora').setAttribute('aria-busy', 'true'); informar('Consultando horas disponibles…', 'carga');
    try {
        const datos = await api('/api/disponibilidad?' + parametros);
        if (version !== versionHoras || consulta !== contexto()) return;
        horas = datos.map(d => d.hora_inicio); contextoHoras = consulta;
        opciones($('#hora'), horas.map(hora => ({hora})), 'hora', d => d.hora.slice(0, 5), datos.length ? 'Selecciona una hora' : 'Sin horas disponibles');
        const texto = datos.length ? 'Selecciona una de las horas disponibles.' : 'No hay horas disponibles para esta selección. Prueba otra fecha o profesional.';
        $('#ayudaHora').textContent = texto; informar(texto); resumen();
    } catch (error) { if (version === versionHoras) informar(error.message, 'error'); }
    finally { if (version === versionHoras) { $('#disponibilidad').disabled = !$('#profesional').value; $('#hora').setAttribute('aria-busy', 'false'); } }
};
function presentarIntento(mensaje) {
    const estadoIntento=intentoInvitada?.estado||'preparacion';
    $('#recuperacionReserva').hidden=!['resultado_incierto','intento_vencido'].includes(estadoIntento)&&!(enviando&&intentoInvitada?.recuperando);
    $('#recuperacionReserva').setAttribute('aria-busy',String(enviando));
    $('#mensajeRecuperacion').textContent=mensaje||'';
    $('#verificarSolicitud').hidden=estadoIntento!=='resultado_incierto'&&!(enviando&&intentoInvitada?.recuperando);
    $('#verificarSolicitud').disabled=enviando||Date.now()<(intentoInvitada?.reintentarDesde||0);
    $('#camposReserva').disabled=creada||enviando||intentoBloqueado();
    $('#reserva').dataset.intento=estadoIntento;
    tarjetasServicios();resumen();
}
function plazoReintento(valor) {
    if(typeof valor!=='string')return 0;
    if(/^\d+$/.test(valor))return Date.now()+Math.min(Number(valor)*1000,86400000);
    const fecha=Date.parse(valor);return Number.isFinite(fecha)?Math.min(Math.max(Date.now(),fecha),Date.now()+86400000):0;
}
async function enviarIntento(recuperando=false) {
    const intento=intentoInvitada;
    if(!intento||enviando||Date.now()<(intento.reintentarDesde||0))return;
    if(recuperando&&intento.estado!=='resultado_incierto')return;
    const version=++versionIntento;
    const vigente=()=>version===versionIntento&&intento===intentoInvitada;
    intento.recuperando=recuperando;
    enviando=true;
    versionBusqueda++;versionSeleccion++;versionProfesional++;versionHoras++;
    intento.estado='enviando';presentarIntento();
    informar(recuperando?'Verificando la misma solicitud…':'Preparando tu solicitud…','carga');
    let postIniciado=false;
    try {
        // Solo la primera solicitud obtiene contexto; nunca se renueva al recuperar.
        if(!recuperando){
            const contextoInvitado=await api('/api/reservas/invitada/contexto');
            if(contextoInvitado?.disponible!==true)throw Error('Contexto no disponible');
        }
        if(!vigente())return;
        postIniciado=true;
        informar(recuperando?'Verificando la misma solicitud…':'Creando tu reserva…','carga');
        const d=await api('/api/reservas/invitada','POST',intento.cuerpo,{'X-Meraki-Action':'1','Idempotency-Key':intento.clave});
        if(!vigente())return;
        const r=d?.reserva;
        if(!r||!Number.isSafeInteger(r.id_reserva)||r.id_reserva<=0||typeof r.token_consulta!=='string'||
            !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(r.token_consulta)||
            !['pendiente_abono','confirmada','cancelada','atendida','no_atendida'].includes(r.estado))throw Error('Respuesta incompleta');
        creada=true;intento.estado='reserva_completada';
        $('#consulta').href='/consulta/#'+encodeURIComponent(r.token_consulta);$('#consulta').hidden=false;$('#nuevaReserva').hidden=false;
        const etiquetas={pendiente_abono:'pendiente de abono',confirmada:'confirmada',cancelada:'cancelada',atendida:'atendida',no_atendida:'no atendida'};
        informar('Reserva '+r.id_reserva+(recuperando?' recuperada':' registrada')+' y '+etiquetas[r.estado]+'. Guarda el enlace privado para consultarla. Esta verificación no inicia pagos.','exito');
    } catch(error) {
        if(!vigente())return;
        if(!postIniciado) {
            intento.estado='preparacion';
            informar('No se envió la reserva porque no se pudo preparar la conexión. Puedes volver a intentarlo.','error');
        } else if(error.status===410||error.status===401) {
            intento.estado='intento_vencido';
            const mensaje='No podemos verificar este intento porque venció o su contexto ya no está disponible. La reserva podría existir. No crees otra sin revisar con el emprendimiento. No renueves el contexto ni recargues para reintentar.';
            presentarIntento(mensaje);informar('El intento requiere revisión.','error');
        } else if(!recuperando&&((error.status===409&&error.codigo==='HORARIO_NO_DISPONIBLE')||
            (error.status===400&&['DATOS_INVALIDOS','CLAVE_INVALIDA'].includes(error.codigo))||error.status===403)) {
            intento.estado='rechazo_definitivo';
            informar(error.codigo==='HORARIO_NO_DISPONIBLE'?'El horario ya no está disponible. Consulta otra hora antes de crear una nueva solicitud.':'La solicitud fue rechazada antes de registrarse. Revisa los datos antes de continuar.','error');
            limpiarHoras();
        } else {
            intento.estado='resultado_incierto';
            intento.reintentarDesde=error.status===429?plazoReintento(error.retryAfter):0;
            const mensaje='No fue posible comprobar si la reserva se registró. Conservamos esta misma solicitud durante esta visita. '+
                (error.status===429?'Espera antes de verificar nuevamente. ':'')+
                'Verificar mi solicitud reenviará la misma operación y podría completarla si todavía no se había registrado. No recargues: la recuperación no se conserva al cerrar o recargar esta página.';
            presentarIntento(mensaje);informar('Resultado de la reserva pendiente de verificar.','error');
            if(intento.reintentarDesde>Date.now())globalThis.setTimeout?.(()=>{if(vigente()&&intento.estado==='resultado_incierto')presentarIntento(mensaje);},intento.reintentarDesde-Date.now());
        }
    } finally {
        if(vigente()) {enviando=false;presentarIntento($('#mensajeRecuperacion').textContent);}
    }
}
$('#formReserva').onsubmit=async evento=>{
    evento.preventDefault();if(enviando||creada||intentoBloqueado())return;
    validar(true);resumen();if($('#crearReserva').disabled){informar('Completa los datos obligatorios y selecciona una hora disponible.','error');return;}
    const cuerpo=Object.freeze({id_servicio:Number($('#servicio').value),id_trabajadora:Number($('#profesional').value),fecha:$('#fecha').value,hora:$('#hora').value.slice(0,5),
        contacto:Object.freeze({nombre:nombre.value.trim(),correo:correo.value.trim(),telefono:telefono.value.trim()})});
    intentoInvitada={cuerpo,clave:crypto.randomUUID(),estado:'preparacion',reintentarDesde:0};
    return enviarIntento();
};
$('#verificarSolicitud').onclick=()=>enviarIntento(true);
$('#nuevaReserva').onclick=()=>{
    if(enviando||intentoBloqueado()||!creada)return;
    versionIntento++;intentoInvitada=null;$('#recuperacionReserva').hidden=true;
    $('#formReserva').reset();camposInteractuados.clear();
    for(const id of ['#errorNombre','#errorCorreo','#errorTelefono','#errorFecha'])$(id).textContent='';
    for(const campo of [nombre,correo,telefono,$('#fecha')])campo.setAttribute('aria-invalid','false');
    return seleccionar(negocio);
};
$('#fecha').min = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Santiago', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
opciones($('#profesional'), [], 'id_trabajadora', undefined, 'Selecciona una profesional'); limpiarHoras(); $('#buscar').requestSubmit();
void cargarCategorias();
