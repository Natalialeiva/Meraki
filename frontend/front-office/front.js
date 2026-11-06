const $ = selector => document.querySelector(selector);
const estado = $('#estado');
const noDisponible = 'Este servicio no está disponible para reservar por el momento';
const nombre = $('#formReserva input[name="nombre"]');
const correo = $('#formReserva input[name="correo"]');
const telefono = $('#formReserva input[name="telefono"]');
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
async function api(url, method = 'GET', datos) {
    const respuesta = await fetch(url, {method, headers:{'Content-Type':'application/json'}, body:datos ? JSON.stringify(datos) : undefined});
    let d; try { d = JSON.parse(await respuesta.text()); } catch { throw Error('No se pudo leer la respuesta del servidor. Intenta nuevamente.'); }
    if (!respuesta.ok) throw Error(d.mensaje || 'No se pudo completar la operación');
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
    $('#crearReserva').disabled = creada || enviando || !s || s.reservable === false || !$('#profesional').value || !horaValida || !validar();
}
function tarjetasServicios() {
    const lista = $('#listaServicios'); lista.replaceChildren();
    for (const s of servicios) {
        const tarjeta = document.createElement('article'), h = document.createElement('h3');
        tarjeta.className = 'servicio-card';
        tarjeta.dataset.seleccionado = String(String(s.id_servicio) === $('#servicio').value);
        tarjeta.dataset.disponible = String(s.reservable !== false);
        h.textContent = s.servicio; tarjeta.append(h);
        const detalles = [
            [negocio.nombre, 'servicio-negocio'],
            [negocio.comuna, 'servicio-comuna'],
            [s.categoria, 'servicio-categoria'],
            [s.descripcion, 'servicio-descripcion'],
            [s.precio != null ? 'Precio total: ' + dinero(s.precio) : '', 'servicio-precio'],
            [s.duracion_min != null ? 'Duración: ' + s.duracion_min + ' minutos' : '', 'servicio-duracion'],
            [s.monto_abono != null ? 'Abono requerido: ' + dinero(s.monto_abono) : '', 'servicio-abono'],
            [s.reservable === false ? noDisponible : 'Disponible para reservar', 'servicio-estado']
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
        const elegir = document.createElement('button'); elegir.type = 'button'; elegir.disabled = s.reservable === false || enviando || creada;
        elegir.textContent = s.reservable === false ? 'No disponible por el momento' : 'Elegir ' + s.servicio;
        elegir.onclick = () => {
            if (enviando || creada) return;
            $('#servicio').value = String(s.id_servicio);
            // La tarjeta se vuelve a dibujar; conservar el foco en un control estable.
            $('#servicio').focus();
            return profesionales();
        };
        tarjeta.append(elegir); lista.append(tarjeta);
    }
}
async function profesionales() {
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
    if (enviando) return;
    const version = ++versionSeleccion; versionProfesional++; limpiarHoras();
    negocio = dato; creada = false; servicios = [];
    $('#camposReserva').disabled = false; $('#consulta').hidden = true; $('#nuevaReserva').hidden = true; $('#reserva').hidden = true;
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
    } catch (error) { if (version === versionSeleccion) informar(error.message, 'error'); }
}

// Solo memoria de esta visita; las distancias se derivan al dibujar y no se guardan.
let resultadosCatalogo = [], ubicacionCatalogo = null, calcularDistancia = null;
function actualizarCercania(posicion, calcular) {
    ubicacionCatalogo = posicion ? {...posicion} : null; calcularDistancia = calcular;
    $('#controlCercania').hidden = !posicion; $('#notaDistancias').hidden = !posicion;
    if (!posicion) $('#ordenCercania').value = 'original';
    dibujarCatalogo();
}
let receptorMapa = null;
function suscribirMapa(receptor) { receptorMapa = receptor; receptor(resultadosCatalogo); }
function dibujarCatalogo() {
    receptorMapa?.(resultadosCatalogo);
    $('#resultados').replaceChildren();
    const filas = resultadosCatalogo.map((dato, indice) => ({dato, indice, distancia:ubicacionCatalogo && calcularDistancia ? calcularDistancia(ubicacionCatalogo.latitud, ubicacionCatalogo.longitud, dato.latitud, dato.longitud) : null}));
    if (ubicacionCatalogo && $('#ordenCercania').value === 'cercania') filas.sort((a,b) => (a.distancia ?? Infinity) - (b.distancia ?? Infinity) || a.indice - b.indice);
        for (const {dato:d, distancia} of filas) {
            const a = document.createElement('article'), h = document.createElement('h3'), p = document.createElement('p'), b = document.createElement('button');
            a.className = 'negocio-card';
            h.textContent = d.nombre; p.textContent = [d.descripcion, d.comuna, d.direccion].filter(Boolean).join(' · ');
            b.type = 'button'; b.textContent = 'Ver servicios de ' + d.nombre; b.onclick = () => seleccionar(d);
            a.append(h, p, b);
            if (ubicacionCatalogo) {
                const distanciaTexto = document.createElement('p'); distanciaTexto.className = 'distanciaNegocio';
                distanciaTexto.textContent = distancia === null ? 'Distancia no disponible' : 'Aprox. ' + (distancia < 0.1 ? 'menos de 0,1' : new Intl.NumberFormat('es-CL', {maximumFractionDigits:1}).format(distancia)) + ' km';
                a.append(distanciaTexto);
            } $('#resultados').append(a);
        }

}
$('#ordenCercania').onchange = dibujarCatalogo;

$('#buscar').onsubmit = async evento => {
    evento.preventDefault(); if (enviando) return;
    const version = ++versionBusqueda; versionSeleccion++; versionProfesional++; limpiarHoras();
    $('#reserva').hidden = true; resultadosCatalogo = []; receptorMapa?.([]); $('#resultados').replaceChildren(); informar('Buscando emprendimientos…', 'carga');
    $('#estadoCatalogo').append(estado);
    try {
        const filtros = new URLSearchParams(new FormData(evento.target));
        const datos = await api('/api/emprendimientos?' + filtros);
        if (version !== versionBusqueda) return;
        resultadosCatalogo = datos; dibujarCatalogo();
        informar(datos.length ? datos.length + ' emprendimiento(s). Selecciona uno para ver sus servicios.' : 'No encontramos emprendimientos con esos filtros. Prueba solo con el nombre o pulsa Ver todos.');
    } catch (error) { if (version === versionBusqueda) informar(error.message, 'error'); }
};
$('#limpiarBusqueda').onclick = () => { if (enviando) return; $('#buscar').reset(); $('#buscar').requestSubmit(); };
$('#servicio').onchange = profesionales;
$('#profesional').onchange = () => { limpiarHoras(); $('#disponibilidad').disabled = !$('#profesional').value; };
$('#fecha').onchange = () => { limpiarHoras(); errorCampo($('#fecha'), '#errorFecha', !$('#fecha').value ? 'Selecciona una fecha.' : $('#fecha').value < $('#fecha').min ? 'Elige hoy o una fecha posterior.' : ''); };
$('#hora').onchange = () => { resumen(); if ($('#hora').value) informar('Revisa el resumen y completa tus datos para crear la reserva.'); };
for (const campo of [nombre, correo, telefono]) {
    campo.oninput = campo.onblur = () => { camposInteractuados.add(campo); validar(); resumen(); };
}
$('#disponibilidad').onclick = async () => {
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
$('#formReserva').onsubmit = async evento => {
    evento.preventDefault(); if (enviando || creada) return;
    validar(true); resumen(); if ($('#crearReserva').disabled) { informar('Completa los datos obligatorios y selecciona una hora disponible.', 'error'); return; }
    const datos = {nombre:nombre.value.trim(), correo:correo.value.trim(), telefono:telefono.value.trim()};
    const reserva = {id_servicio:Number($('#servicio').value), id_trabajadora:Number($('#profesional').value), fecha:$('#fecha').value, hora:$('#hora').value.slice(0, 5)};
    enviando = true; $('#camposReserva').disabled = true; tarjetasServicios(); resumen(); informar('Creando tu reserva…', 'carga');
    try {
        const cliente = await api('/api/clientas', 'POST', datos);
        const d = await api('/api/reservas', 'POST', {...reserva, id_clienta:cliente.id_clienta, nombre_clienta:datos.nombre});
        creada = true; $('#consulta').href = '/consulta/#' + encodeURIComponent(d.reserva.token_consulta); $('#consulta').hidden = false; $('#nuevaReserva').hidden = false;
        informar('Reserva ' + d.reserva.id_reserva + ' creada y pendiente de abono. Guarda el enlace privado y continúa con Webpay. Todavía no se ha realizado un cobro.', 'exito');
    } catch (error) { informar(error.message, 'error'); $('#camposReserva').disabled = false; }
    finally { enviando = false; tarjetasServicios(); resumen(); }
};
$('#nuevaReserva').onclick = () => { if (enviando) return; $('#formReserva').reset(); camposInteractuados.clear(); for (const id of ['#errorNombre','#errorCorreo','#errorTelefono','#errorFecha']) $(id).textContent = ''; for (const campo of [nombre,correo,telefono,$('#fecha')]) campo.setAttribute('aria-invalid','false'); return seleccionar(negocio); };
$('#fecha').min = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Santiago', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
opciones($('#profesional'), [], 'id_trabajadora', undefined, 'Selecciona una profesional'); limpiarHoras(); $('#buscar').requestSubmit();
