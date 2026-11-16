import {crearProveedorLeaflet} from './mapa-leaflet.mjs';
import {crearLectorConfiguracion} from './mapa-configuracion.mjs';
import {crearProveedorSimulado} from './mapa-simulado.mjs';
import {configurarGoogle,cargadorGoogle,crearProveedorGoogle} from './mapa-google.mjs';

// Elección fijada en la primera apertura; cambios de configuración requieren recargar.
export function crearProveedorMapa({documento,contenedor,mundo=globalThis,leerConfiguracion=crearLectorConfiguracion({mundo})}) {
    let proveedor=null, notificar=()=>{};
    let modo='simulado';
    const instalar=valor=>{
        if (proveedor) return;
        const config=configurarGoogle(valor);
        if (config && mundo.isSecureContext===true) {
            modo='google';
            proveedor=crearProveedorGoogle({documento,contenedor,config,cargador:cargadorGoogle(documento,mundo),alError:()=>notificar()});
        } else proveedor=crearProveedorSimulado(documento,contenedor);
    };
    const elegir=()=>{
        if (proveedor) return;
        if (mundo.L) {modo='leaflet';proveedor=crearProveedorLeaflet({documento,contenedor,L:mundo.L});return;}
        if (mundo.MERAKI_MAPAS_CONFIG!==undefined) {instalar(mundo.MERAKI_MAPAS_CONFIG);return;}
        const valor=leerConfiguracion();
        if (valor?.then) return valor.then(instalar);
        instalar(valor);
    };
    return {
        get modo() {return mundo.L ? 'leaflet' : modo;},
        get admiteVacio() {return !!mundo.L;},
        alError:receptor=>{notificar=receptor;},
        abrir:()=>proveedor?.abrir?.(),
        limpiar:()=>proveedor?.limpiar(),
        invalidar:()=>{if(proveedor?.invalidar) proveedor.invalidar();else proveedor?.limpiar();},
        preparar(datos,seleccionar) {const carga=elegir();return carga?.then ? carga.then(()=>proveedor.preparar(datos,seleccionar)) : proveedor.preparar(datos,seleccionar);},
        renderizar:contenido=>proveedor.renderizar(contenido)
    };
}
