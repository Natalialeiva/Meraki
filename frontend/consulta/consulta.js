let token = '';
try { token = decodeURIComponent(location.hash.slice(1)); } catch {}
const estado = document.querySelector('#estado');
const detalle = document.querySelector('#detalle');
const pagar = document.querySelector('#pagar');
const cancelar = document.querySelector('#cancelar');
const actualizar = document.querySelector('#actualizar');
let version = 0;
let iniciandoPago = false;

async function api(url, method = 'GET', data) {
    const respuesta = await fetch(url, {
        method, headers: {'Content-Type': 'application/json'},
        body: data ? JSON.stringify(data) : undefined, cache: 'no-store'
    });
    const texto = await respuesta.text();
    let datos;
    try { datos = JSON.parse(texto); } catch {
        // No mostrar respuestas HTML/texto ni errores internos del parser.
        datos = null;
    }
    if (!respuesta.ok) {
        if (respuesta.status === 405) {
            pagar.hidden = true;
            cancelar.hidden = true;
            throw Error(datos?.mensaje || 'Esta prueba solo permite consultar. La reserva no se ha cancelado.');
        }
        throw Error(datos?.mensaje || 'No se pudo completar la operación. Intenta nuevamente más tarde.');
    }
    if (!datos || typeof datos !== 'object') throw Error('El servidor devolvió una respuesta inesperada. Intenta nuevamente más tarde.');
    if (respuesta.headers?.get('X-Meraki-Solo-Consulta') === '1') datos.capacidades = {...datos.capacidades, soloConsulta:true};
    return datos;
}

// Son componentes civiles almacenados, no instantes UTC. No resolver DST aquí:
// una hora repetida o inexistente necesita revisión al crear la reserva.
function presentarHoraCivil(valor, zona) {
    if (zona !== 'America/Santiago' || typeof valor !== 'string') return null;
    const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(valor);
    if (!partes) return null;
    const [a, m, d, h, min, seg] = partes.slice(1).map(Number);
    const bisiesto = a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0);
    const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (a < 1 || m < 1 || m > 12 || d < 1 || d > dias[m - 1] || h > 23 || min > 59 || seg > 59) return null;
    return `${partes[3]}/${partes[2]}/${partes[1]}, ${partes[4]}:${partes[5]}${seg ? ':' + partes[6] : ''} — hora de Santiago`;
}

const ruta = '/api/reservas/consulta/' + encodeURIComponent(token);
async function cargar(aviso = '') {
    const actual = ++version;
    pagar.hidden = true;
    cancelar.hidden = true;
    try {
        if (!token) throw Error('Abre el enlace privado recibido por correo.');
        const datos = await api(ruta);
        if (actual !== version) return;
        if (!datos.reserva) throw Error('No se pudo obtener la reserva.');
        const soloConsulta = datos.capacidades?.soloConsulta === true;
        const pago = datos.pago;
        const permitido = !soloConsulta && datos.reserva.estado === 'pendiente_abono' &&
            pago?.puede_iniciar === true && pago.motivo === null && ['disponible','rechazado'].includes(pago.estado);
        const mensajePago = pago?.estado === 'en_revision' ? 'Pago en revisión. Consulta nuevamente antes de intentar pagar.' :
            pago?.estado === 'rechazado' && permitido ? 'El abono anterior no fue aprobado. Puedes solicitar otro intento.' :
            pago?.estado === 'no_disponible' && datos.reserva.estado === 'pendiente_abono' ? 'El pago no está disponible por ahora.' : '';
        estado.textContent = soloConsulta
            ? 'Reserva de prueba: solo consulta. Los pagos y las cancelaciones están deshabilitados.'
            : [aviso, datos.mensaje, mensajePago, datos.capacidades?.motivoCancelacion].filter(Boolean).join(' ');
        detalle.replaceChildren();
        for (const [campo, etiqueta] of [['inicio', 'Inicio'], ['fin', 'Fin']]) {
            const p = document.createElement('p');
            const civil = presentarHoraCivil(datos.reserva[`fecha_hora_${campo}_civil`], datos.reserva.zona_horaria);
            // El ISO anterior depende de la zona del servidor: no permite reconstruir
            // con certeza el timestamp civil original.
            p.textContent = etiqueta + ': ' + (civil || 'Horario no disponible. Consulta al emprendimiento.');
            detalle.append(p);
        }
        for (const [clave, valor] of Object.entries(datos.reserva)) {
            if (['fecha_hora_inicio', 'fecha_hora_fin', 'fecha_hora_inicio_civil', 'fecha_hora_fin_civil', 'zona_horaria'].includes(clave)) continue;
            const p = document.createElement('p');
            p.textContent = clave.replaceAll('_', ' ') + ': ' + valor;
            detalle.append(p);
        }
        pagar.textContent = permitido && pago.estado === 'rechazado' ? 'Intentar de nuevo' : 'Pagar abono con Webpay';
        pagar.hidden = !permitido || iniciandoPago;
        cancelar.hidden = soloConsulta || datos.capacidades?.cancelar === false || !['pendiente_abono', 'confirmada'].includes(datos.reserva.estado);
    } catch (error) {
        if (actual !== version) return;
        detalle.replaceChildren();
        estado.textContent = [aviso,error.message].filter(Boolean).join(' ');
    }
}

pagar.onclick = async () => {
    if (iniciandoPago || pagar.hidden || pagar.disabled) return;
    iniciandoPago = true;
    ++version;
    pagar.disabled = true;
    actualizar.disabled = true;
    cancelar.hidden = true;
    try {
        const datos = await api('/api/abonos/cliente/iniciar', 'POST', {token_consulta: token});
        const url = new URL(datos.url);
        if (url.protocol !== 'https:' || !['webpay3gint.transbank.cl', 'webpay3g.transbank.cl'].includes(url.hostname)) throw Error('Destino de pago inválido');
        try {
            if (/^[A-Za-z0-9_-]{43}$/.test(datos.correlacion) && /^[a-f0-9-]{36}$/i.test(token)) {
                const prefijo = 'meraki:webpay:';
                for (let i = sessionStorage.length - 1; i >= 0; i--) {
                    const clave = sessionStorage.key(i);
                    if (clave?.startsWith(prefijo)) {
                        let item;
                        try { item = JSON.parse(sessionStorage.getItem(clave)); } catch {}
                        if (!(item?.vence > Date.now())) sessionStorage.removeItem(clave);
                    }
                }
                sessionStorage.setItem(prefijo + datos.correlacion, JSON.stringify({
                    enlace:'/consulta/#'+encodeURIComponent(token), vence:Date.now()+30*60*1000
                }));
            }
        } catch { /* La consulta original sigue disponible si la pestaña no permite almacenamiento. */ }
        const formulario = document.createElement('form');
        formulario.method = 'POST'; formulario.action = url.href;
        const campo = document.createElement('input');
        campo.type = 'hidden'; campo.name = 'token_ws'; campo.value = datos.token;
        formulario.append(campo); document.body.append(formulario); formulario.submit();
    } catch (error) {
        pagar.hidden = true;
        iniciandoPago = false;
        await cargar(error.message);
        pagar.disabled = false;
        actualizar.disabled = false;
    }
};
actualizar.onclick = () => cargar();
cancelar.onclick = async () => {
    if (!confirm('¿Cancelar esta reserva?')) return;
    cancelar.disabled = true;
    try {
        await api(ruta + '/cancelar', 'PATCH');
        await cargar();
    } catch (error) { estado.textContent = error.message; }
    finally { cancelar.disabled = false; }
};
cargar();
