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
function validar(mostrar = false) {
    const n = nombre.value.trim(), c = correo.value.trim(), t = telefono.value.trim();
    const errores = {
        nombre: !n ? 'Escribe tu nombre.' : n.length > 100 ? 'Usa como máximo 100 caracteres.' : '',
        correo: !c ? 'Escribe tu correo.' : c.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? 'Escribe un correo válido, por ejemplo nombre@correo.cl.' : '',
        telefono: t.length > 20 ? 'Usa como máximo 20 caracteres.' : '',
        fecha: !$('#fecha').value ? 'Selecciona una fecha.' : $('#fecha').value < $('#fecha').min ? 'Elige hoy o una fecha posterior.' : ''
    };
    if (mostrar) {
        errorCampo(nombre, '#errorNombre', errores.nombre); errorCampo(correo, '#errorCorreo', errores.correo);
        errorCampo(telefono, '#errorTelefono', errores.telefono); errorCampo($('#fecha'), '#errorFecha', errores.fecha);
    }
    return !Object.values(errores).some(Boolean);
}
function resumen() {
    const s = servicioActual(), profesional = $('#profesional').selectedOptions[0]?.textContent;
    $('#seleccionProfesional').textContent = $('#profesional').value ? 'Profesional seleccionada: ' + profesional : 'Selecciona una profesional.';
    const panel = $('#resumen'); panel.replaceChildren();
    const lineas = [
        'Emprendimiento: ' + (negocio?.nombre || 'Selecciona un emprendimiento'),
        'Servicio: ' + (s?.servicio || 'Selecciona un servicio disponible'),
        'Profesional: ' + ($('#profesional').value ? profesional : 'Sin seleccionar'),
        'Fecha: ' + ($('#fecha').value || 'Sin seleccionar'),
        'Hora: ' + ($('#hora').value ? $('#hora').value.slice(0, 5) : 'Sin seleccionar'),
        'Precio total: ' + (s ? dinero(s.precio) : 'Pendiente de selección'),
        'Abono requerido: ' + (s ? dinero(s.monto_abono) : 'Pendiente de selección'),
        'Correo de confirmación: ' + (correo.value.trim() || 'Escribe tu correo')
    ];
    for (const texto of lineas) { const p = document.createElement('p'); p.textContent = texto; panel.append(p); }
    const horaValida = contextoHoras === contexto() && horas.includes($('#hora').value);
    $('#crearReserva').disabled = creada || enviando || !s || s.reservable === false || !$('#profesional').value || !horaValida || !validar();
}
function tarjetasServicios() {
    const lista = $('#listaServicios'); lista.replaceChildren();
    for (const s of servicios) {
        const tarjeta = document.createElement('article'), h = document.createElement('h3');
        tarjeta.dataset.seleccionado = String(String(s.id_servicio) === $('#servicio').value);
        h.textContent = s.servicio; tarjeta.append(h);
        const detalles = [negocio.nombre, s.categoria, s.descripcion,
            s.precio != null ? 'Precio total: ' + dinero(s.precio) : '',
            s.duracion_min != null ? 'Duración: ' + s.duracion_min + ' minutos' : '',
            s.monto_abono != null ? 'Abono requerido: ' + dinero(s.monto_abono) : '',
            s.reservable === false ? noDisponible : 'Disponible para reservar'];
        for (const texto of detalles.filter(Boolean)) { const p = document.createElement('p'); p.textContent = texto; tarjeta.append(p); }
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
        informar(primera ? 'Elige profesional, fecha y hora.' : datos.length ? noDisponible : 'No hay servicios publicados por el momento.');
        await profesionales();
    } catch (error) { if (version === versionSeleccion) informar(error.message, 'error'); }
}
$('#buscar').onsubmit = async evento => {
    evento.preventDefault(); if (enviando) return;
    const version = ++versionBusqueda; versionSeleccion++; versionProfesional++; limpiarHoras();
    $('#reserva').hidden = true; $('#resultados').replaceChildren(); informar('Buscando emprendimientos…', 'carga');
    try {
        const filtros = new URLSearchParams(new FormData(evento.target));
        const datos = await api('/api/emprendimientos?' + filtros);
        if (version !== versionBusqueda) return;
        for (const d of datos) {
            const a = document.createElement('article'), h = document.createElement('h2'), p = document.createElement('p'), b = document.createElement('button');
            h.textContent = d.nombre; p.textContent = [d.descripcion, d.comuna, d.direccion].filter(Boolean).join(' · ');
            b.type = 'button'; b.textContent = 'Ver servicios de ' + d.nombre; b.onclick = () => seleccionar(d);
            a.append(h, p, b); $('#resultados').append(a);
        }
        informar(datos.length ? datos.length + ' emprendimiento(s). Selecciona uno para ver sus servicios.' : 'No encontramos emprendimientos con esos filtros. Prueba solo con el nombre o pulsa Ver todos.');
    } catch (error) { if (version === versionBusqueda) informar(error.message, 'error'); }
};
$('#limpiarBusqueda').onclick = () => { if (enviando) return; $('#buscar').reset(); $('#buscar').requestSubmit(); };
$('#servicio').onchange = profesionales;
$('#profesional').onchange = () => { limpiarHoras(); $('#disponibilidad').disabled = !$('#profesional').value; };
$('#fecha').onchange = () => { limpiarHoras(); errorCampo($('#fecha'), '#errorFecha', !$('#fecha').value ? 'Selecciona una fecha.' : $('#fecha').value < $('#fecha').min ? 'Elige hoy o una fecha posterior.' : ''); };
$('#hora').onchange = () => { resumen(); if ($('#hora').value) informar('Revisa el resumen y completa tus datos para crear la reserva.'); };
for (const campo of [nombre, correo, telefono]) campo.oninput = () => { validar(true); resumen(); };
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
$('#nuevaReserva').onclick = () => { if (enviando) return; $('#formReserva').reset(); for (const id of ['#errorNombre','#errorCorreo','#errorTelefono','#errorFecha']) $(id).textContent = ''; for (const campo of [nombre,correo,telefono,$('#fecha')]) campo.setAttribute('aria-invalid','false'); return seleccionar(negocio); };
$('#fecha').min = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Santiago', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
opciones($('#profesional'), [], 'id_trabajadora', undefined, 'Selecciona una profesional'); limpiarHoras(); $('#buscar').requestSubmit();
