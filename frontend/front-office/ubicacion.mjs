import {crearVistaIndicaciones} from './mapa-datos.mjs';
import {validarCoordenadas, distanciaKm} from './geografia.mjs';

// Estado privado de esta visita. No usa red, almacenamiento ni seguimiento.
export function crearUbicacion({geolocalizacion, seguro, mostrar, alCambiar = () => {}}) {
    let posicion = null, pendiente = false, version = 0;
    const estado = (codigo, mensaje) => { mostrar({codigo, mensaje, pendiente, activa:posicion !== null}); alCambiar(posicion ? {...posicion} : null); };
    const inicial = () => estado('no-solicitada', 'Ubicación no solicitada. Puedes buscar por nombre y comuna.');
    inicial();
    function dejar() {
        version++; posicion = null; pendiente = false; inicial();
    }
    function solicitar() {
        if (pendiente) return;
        posicion = null;
        if (!seguro) { estado('inseguro', 'Para usar tu ubicación, abre Meraki mediante HTTPS o localhost. Puedes seguir buscando manualmente.'); return; }
        if (!geolocalizacion?.getCurrentPosition) { estado('incompatible', 'Tu navegador no permite obtener la ubicación. Puedes buscar por nombre y comuna.'); return; }
        const solicitud = ++version;
        pendiente = true;
        estado('solicitando', 'Solicitando permiso y obteniendo tu ubicación…');
        const fallo = error => {
            if (solicitud !== version || !pendiente) return;
            pendiente = false;
            const mensajes = {1:['rechazado','Permiso rechazado. Puedes buscar manualmente o volver a intentarlo.'],2:['no-disponible','Ubicación no disponible. Puedes buscar manualmente o volver a intentarlo.'],3:['agotado','Se agotó el tiempo de espera. Puedes buscar manualmente o volver a intentarlo.']};
            estado(...(mensajes[error?.code] || mensajes[2]));
        };
        try {
            geolocalizacion.getCurrentPosition(resultado => {
                if (solicitud !== version || !pendiente) return;
                const par = validarCoordenadas(resultado?.coords?.latitude, resultado?.coords?.longitude);
                if (!par) { fallo({code:2}); return; }
                const precision = resultado.coords.accuracy;
                posicion = {...par, precisionMetros:typeof precision === 'number' && Number.isFinite(precision) && precision >= 0 ? precision : null};
                pendiente = false;
                const aviso = posicion.precisionMetros === null ? ' El dispositivo no informó su precisión.' : posicion.precisionMetros > 1000 ? ' La precisión del dispositivo es baja.' : ' La precisión depende de tu dispositivo.';
                estado('obtenida', 'Ubicación obtenida correctamente.' + aviso + ' Puedes seguir usando la búsqueda manual.');
            }, fallo, {enableHighAccuracy:false, timeout:10000, maximumAge:0});
        } catch { fallo({code:2}); }
    }
    return {solicitar, dejar, obtener:() => posicion ? {...posicion} : null};
}

export function montarUbicacion(documento, navegador, seguro) {
    const usar = documento.querySelector('#usarUbicacion');
    if (!usar) return;
    const dejar = documento.querySelector('#dejarUbicacion'), mensaje = documento.querySelector('#estadoUbicacion');
    const control = crearUbicacion({geolocalizacion:navegador.geolocation, seguro, alCambiar:posicion => globalThis.actualizarCercania?.(posicion, distanciaKm), mostrar:estado => {
        usar.disabled = estado.pendiente;
        usar.setAttribute('aria-busy', String(estado.pendiente));
        usar.textContent = estado.pendiente ? 'Obteniendo ubicación…' : estado.activa ? 'Actualizar mi ubicación' : 'Usar mi ubicación';
        dejar.hidden = !estado.activa && !estado.pendiente;
        mensaje.textContent = estado.mensaje;
        mensaje.dataset.estado = estado.codigo;
    }});
    usar.onclick = control.solicitar;
    dejar.onclick = control.dejar;
    return control;
}

if (typeof document !== 'undefined' && typeof navigator !== 'undefined') {
    // Sin indicador confiable de confirmación, la vista siempre permanece inhabilitada.
    globalThis.configurarIndicaciones?.(negocio=>crearVistaIndicaciones(document,negocio));
    montarUbicacion(document, navigator, globalThis.isSecureContext === true);
}
