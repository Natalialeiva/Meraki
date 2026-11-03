let token = '';
try { token = decodeURIComponent(location.hash.slice(1)); } catch {}
const estado = document.querySelector('#estado');
const detalle = document.querySelector('#detalle');
const pagar = document.querySelector('#pagar');
const cancelar = document.querySelector('#cancelar');

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
async function cargar() {
    try {
        if (!token) throw Error('Abre el enlace privado recibido por correo.');
        const datos = await api(ruta);
        if (!datos.reserva) throw Error('No se pudo obtener la reserva.');
        const soloConsulta = datos.capacidades?.soloConsulta === true;
        estado.textContent = soloConsulta
            ? 'Reserva de prueba: solo consulta. Los pagos y las cancelaciones están deshabilitados.'
            : [datos.mensaje, datos.capacidades?.motivoCancelacion].filter(Boolean).join(' ');
        detalle.replaceChildren();
        for (const [clave, valor] of Object.entries(datos.reserva)) {
            const p = document.createElement('p');
            p.textContent = clave.replaceAll('_', ' ') + ': ' + valor;
            detalle.append(p);
        }
        pagar.hidden = soloConsulta || datos.reserva.estado !== 'pendiente_abono';
        cancelar.hidden = soloConsulta || datos.capacidades?.cancelar === false || !['pendiente_abono', 'confirmada'].includes(datos.reserva.estado);
    } catch (error) { estado.textContent = error.message; }
}

pagar.onclick = async () => {
    pagar.disabled = true;
    try {
        const datos = await api('/api/abonos/cliente/iniciar', 'POST', {token_consulta: token});
        const url = new URL(datos.url);
        if (url.protocol !== 'https:' || !['webpay3gint.transbank.cl', 'webpay3g.transbank.cl'].includes(url.hostname)) throw Error('Destino de pago inválido');
        const formulario = document.createElement('form');
        formulario.method = 'POST'; formulario.action = url.href;
        const campo = document.createElement('input');
        campo.type = 'hidden'; campo.name = 'token_ws'; campo.value = datos.token;
        formulario.append(campo); document.body.append(formulario); formulario.submit();
    } catch (error) { estado.textContent = error.message; pagar.disabled = false; }
};
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
