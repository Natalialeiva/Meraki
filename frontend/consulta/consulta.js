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
        for (const [clave, valor] of Object.entries(datos.reserva)) {
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
