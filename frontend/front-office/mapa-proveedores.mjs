import {crearProveedorSimulado} from './mapa-simulado.mjs';
import {configurarGoogle,cargadorGoogle,crearProveedorGoogle} from './mapa-google.mjs';

// Elección fijada en la primera apertura; cambios de configuración requieren recargar.
export function crearProveedorMapa({documento,contenedor,mundo=globalThis,leerConfiguracion=()=>mundo.MERAKI_MAPAS_CONFIG}) {
    let proveedor=null, notificar=()=>{};
    let modo='simulado';
    const elegir=()=>{
        if (proveedor) return;
        const config=configurarGoogle(leerConfiguracion());
        if (config && mundo.isSecureContext===true) {
            modo='google';
            proveedor=crearProveedorGoogle({documento,contenedor,config,cargador:cargadorGoogle(documento,mundo),alError:()=>notificar()});
        } else proveedor=crearProveedorSimulado(documento,contenedor);
    };
    return {
        get modo() {return modo;},
        alError:receptor=>{notificar=receptor;},
        abrir:()=>proveedor?.abrir?.(),
        limpiar:()=>proveedor?.limpiar(),
        invalidar:()=>{if(proveedor?.invalidar) proveedor.invalidar();else proveedor?.limpiar();},
        preparar(datos,seleccionar) {elegir();return proveedor.preparar(datos,seleccionar);},
        renderizar:contenido=>proveedor.renderizar(contenido)
    };
}
