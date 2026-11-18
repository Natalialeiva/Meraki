import {crearProveedorLeaflet} from './mapa-leaflet.mjs';
import {crearLectorConfiguracion} from './mapa-configuracion.mjs';
import {crearProveedorSimulado} from './mapa-simulado.mjs';
import {configurarGoogle,cargadorGoogle,crearProveedorGoogle} from './mapa-google.mjs';

// Elección fijada en la primera apertura; cambios de configuración requieren recargar.
export function crearProveedorMapa({documento,contenedor,mundo=globalThis,leerConfiguracion=crearLectorConfiguracion({mundo})}) {
    let proveedor=null, notificar=()=>{};
    let modo='simulado';
    let aviso='',ubicacion=null;
    const alternativa=()=>{
        if(!mundo.L)return false;
        proveedor?.limpiar();
        modo='leaflet';
        proveedor=crearProveedorLeaflet({documento,contenedor,L:mundo.L});
        return true;
    };
    const instalar=valor=>{
        if (proveedor) return;
        const config=configurarGoogle(valor);
        if (config && mundo.isSecureContext===true) {
            modo='google';
            proveedor=crearProveedorGoogle({documento,contenedor,config,cargador:cargadorGoogle(documento,mundo),alError:()=>{
                aviso='Google Maps rechazó la autenticación. Se utiliza OpenStreetMap.';
                alternativa();notificar();
            }});
        } else if(!alternativa()) proveedor=crearProveedorSimulado(documento,contenedor);
    };
    const elegir=()=>{
        if (proveedor) return;
        if (mundo.MERAKI_MAPAS_CONFIG!==undefined) {instalar(mundo.MERAKI_MAPAS_CONFIG);return;}
        const valor=leerConfiguracion();
        if (valor?.then) return valor.then(instalar);
        instalar(valor);
    };
    return {
        get modo() {return modo;},
        get aviso() {return aviso;},
        get admiteVacio() {return !!ubicacion || modo==='leaflet' || (!proveedor && !!mundo.L);},
        ubicar:valor=>{ubicacion=valor;proveedor?.ubicar?.(valor);},
        destacar:id=>proveedor?.destacar?.(id),
        alError:receptor=>{notificar=receptor;},
        abrir:()=>proveedor?.abrir?.(),
        limpiar:()=>proveedor?.limpiar(),
        invalidar:()=>{if(proveedor?.invalidar) proveedor.invalidar();else proveedor?.limpiar();},
        preparar(datos,seleccionar) {
            const preparar=()=>{proveedor.ubicar?.(ubicacion);return proveedor.preparar(datos,seleccionar).catch(error=>{
                if(modo==='google' && alternativa()) aviso='No se pudo cargar Google Maps. Se utiliza OpenStreetMap.';
                else if(modo!=='leaflet') throw error;
                proveedor.ubicar?.(ubicacion);return proveedor.preparar(datos,seleccionar);
            });};
            const carga=elegir();return carga?.then ? carga.then(preparar) : preparar();
        },
        renderizar:contenido=>{
            try {proveedor.renderizar(contenido);}
            catch(error){
                if(modo!=='google'||!alternativa())throw error;
                aviso='No se pudo mostrar Google Maps. Se utiliza OpenStreetMap.';
                proveedor.renderizar(contenido);
            }
        }
    };
}
