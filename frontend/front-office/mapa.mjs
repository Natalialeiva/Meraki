import {validarCoordenadas} from './geografia.mjs';
import {normalizarMarcadores} from './mapa-datos.mjs';
import {crearProveedorMapa} from './mapa-proveedores.mjs';

// Contrato: preparar(datos, seleccionar), renderizar(contenido), limpiar().
export function crearMapa({proveedor, mostrar, seleccionar, presentarSeleccion=()=>{}}) {
    let abierto=false, version=0, negocios=[], firma='', seleccion=null;
    const publicos=()=>normalizarMarcadores(negocios.filter(n=>n && typeof n==='object').map(n=>({id:n.id_emprendimiento,nombre:n.nombre,comuna:n.comuna,latitud:n.latitud,longitud:n.longitud})));
    const borrarSeleccion=()=>{seleccion=null;presentarSeleccion(null);};
    const errorMapa=()=>{
        version++;borrarSeleccion();proveedor.limpiar();
        if (abierto) mostrar({abierto,mensaje:'No se pudo cargar el mapa. Puedes continuar con las tarjetas. Cierra y vuelve a intentar.'});
    };
    proveedor.alError?.(errorMapa);
    async function dibujar() {
        const actual=++version;
        borrarSeleccion();
        if (!abierto) {proveedor.limpiar();return;}
        const disponibles=publicos();
        if (disponibles.length) {if(proveedor.invalidar) proveedor.invalidar();else proveedor.limpiar();}
        else proveedor.limpiar();
        mostrar({abierto, mensaje:disponibles.length ? 'Preparando vista…' : 'No hay emprendimientos con coordenadas válidas en esta búsqueda.'});
        if (!disponibles.length) return;
        try {
            // Solo campos públicos de negocio, nunca estado de ubicación personal.
            const datos=disponibles;
            const contenido=await proveedor.preparar(datos, id=>{
                if (abierto && actual===version) {
                    const negocio=datos.find(n=>n.id===id);
                    if (negocio) {seleccion={id,version:actual};presentarSeleccion({id:negocio.id,nombre:negocio.nombre,comuna:negocio.comuna});}
                }
            });
            if (!abierto || actual!==version) return;
            proveedor.renderizar(contenido);
            mostrar({abierto,mensaje:datos.length+' emprendimiento(s) disponibles'+(proveedor.modo==='google'?' en el mapa.':' en esta vista de preparación.')});
        } catch {
            if (actual===version && abierto) {proveedor.limpiar();mostrar({abierto,mensaje:'No se pudo preparar la vista. Puedes seguir usando las tarjetas o cerrar y volver a intentar.'});}
        }
    }
    mostrar({abierto,mensaje:''});
    return {
        actualizar(datos) {
            negocios=datos.slice();
            const nueva=JSON.stringify(publicos());
            if (nueva===firma) return;
            firma=nueva;
            if (abierto) return dibujar();
        },
        verServicios() {
            if (!abierto || !seleccion || seleccion.version!==version) return;
            const negocio=negocios.find(n=>n && Number(n.id_emprendimiento)===seleccion.id && validarCoordenadas(n.latitud,n.longitud));
            if (negocio) return seleccionar(negocio);
        },
        alternar() { abierto=!abierto; if(abierto) proveedor.abrir?.(); mostrar({abierto,mensaje:''}); return dibujar(); }
    };
}

export function montarMapa(documento, suscribir) {
    const boton=documento.querySelector('#verMapa'), panel=documento.querySelector('#panelMapa');
    if (!boton || !panel) return;
    const lista=documento.querySelector('#negociosMapa'), estado=documento.querySelector('#estadoMapa');
    const proveedor=crearProveedorMapa({documento,contenedor:lista});
    const detalle=documento.querySelector('#seleccionMapa'), nombre=documento.querySelector('#nombreMapa'), comuna=documento.querySelector('#comunaMapa');
    const accion=documento.querySelector('#serviciosMapa');
    const control=crearMapa({proveedor,presentarSeleccion:negocio=>{
        detalle.hidden=!negocio;nombre.textContent=negocio?.nombre||'';comuna.textContent=negocio?.comuna||'';
        accion.disabled=!negocio;
    },mostrar:({abierto,mensaje})=>{
        panel.hidden=!abierto;boton.setAttribute('aria-expanded',String(abierto));
        boton.textContent=abierto?'Cerrar mapa':'Ver mapa';estado.textContent=mensaje;
        documento.querySelector('#tituloMapa').textContent=proveedor.modo==='google'?'Mapa de emprendimientos':'Vista de preparación del mapa';
        documento.querySelector('#descripcionMapa').textContent=proveedor.modo==='google'?'Mapa real de Google. Puedes seleccionar un emprendimiento para consultar sus servicios.':'Esta vista no es un mapa real. Puedes elegir un emprendimiento para consultar sus servicios.';
    },seleccionar:negocio=>globalThis.seleccionar?.(negocio)});
    boton.onclick=control.alternar;
    accion.onclick=()=>control.verServicios();
    suscribir(datos=>control.actualizar(datos));
    return control;
}
if (typeof document!=='undefined') montarMapa(document, escuchar=>globalThis.suscribirMapa?.(escuchar));
