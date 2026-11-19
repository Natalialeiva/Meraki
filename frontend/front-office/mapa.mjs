import {validarCoordenadas} from './geografia.mjs';
import {normalizarMarcadores,crearVistaIndicaciones} from './mapa-datos.mjs';
import {crearProveedorMapa} from './mapa-proveedores.mjs';

// Contrato: preparar(datos, seleccionar), renderizar(contenido), limpiar().
export function crearMapa({proveedor, mostrar, seleccionar, presentarSeleccion=()=>{}}) {
    let abierto=false, version=0, negocios=[], firma='', seleccion=null;
    const publicos=()=>normalizarMarcadores(negocios.filter(n=>n && typeof n==='object').map(n=>({id:n.id_emprendimiento,nombre:n.nombre,comuna:n.comuna,latitud:n.latitud,longitud:n.longitud})));
    const borrarSeleccion=()=>{seleccion=null;presentarSeleccion(null);};
    const errorMapa=()=>{
        version++;borrarSeleccion();proveedor.limpiar();
        if(abierto && proveedor.modo==='leaflet') {void dibujar();return;}
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
        if (!disponibles.length && !proveedor.admiteVacio) return;
        try {
            // Solo campos públicos de negocio, nunca estado de ubicación personal.
            const datos=disponibles;
            const contenido=await proveedor.preparar(datos, id=>{
                if (abierto && actual===version) {
                    const negocio=datos.find(n=>n.id===id);
                    if (negocio) {seleccion={id,version:actual};const original=negocios.find(n=>Number(n.id_emprendimiento)===id);const detalle={...negocio};for(const k of ['categoria','especialidad','imagen_url','distancia'])if(original?.[k]!==undefined)detalle[k]=original[k];presentarSeleccion(detalle);}
                }
            });
            if (!abierto || actual!==version) return;
            proveedor.renderizar(contenido);
            mostrar({abierto,mensaje:datos.length ? datos.length+' emprendimiento(s) disponibles'+(['google','leaflet'].includes(proveedor.modo)?' en el mapa.':' en esta vista de preparación.') : 'No hay emprendimientos con coordenadas válidas en esta búsqueda.'});
        } catch {
            if (actual===version && abierto) {proveedor.limpiar();mostrar({abierto,mensaje:'No se pudo preparar la vista. Puedes seguir usando las tarjetas o cerrar y volver a intentar.'});}
        }
    }
    mostrar({abierto,mensaje:''});
    return {
        destacar:id=>proveedor.destacar?.(Number(id)),
        actualizar(datos, contexto={}) {
            proveedor.ubicar?.(contexto.ubicacion||null);
            negocios=datos.slice();
            const nueva=JSON.stringify([publicos(),contexto.ubicacion||null]);
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
    const accion=documento.querySelector('#serviciosMapa'), indicaciones=documento.querySelector('#indicacionesMapa');
    const control=crearMapa({proveedor,presentarSeleccion:negocio=>{
        const pierdeFoco=!negocio && detalle.contains?.(documento.activeElement);
        detalle.hidden=!negocio;nombre.textContent=negocio?.nombre||'';comuna.textContent=negocio?.comuna||'';
        accion.disabled=!negocio;
        proveedor.destacar?.(negocio?.id??null);
        documento.querySelectorAll?.('article[data-id-negocio]').forEach(n=>n.classList.toggle('negocioSeleccionado',Number(n.dataset.idNegocio)===negocio?.id));
        const extra=documento.querySelector('#extraMapa');
        if(extra){extra.replaceChildren();if(negocio){
            const texto=documento.createElement('p');texto.textContent=[negocio.categoria,negocio.especialidad,typeof negocio.distancia==='number'?'Aprox. '+new Intl.NumberFormat('es-CL',{maximumFractionDigits:1}).format(negocio.distancia)+' km en línea recta':null].filter(Boolean).join(' · ');extra.append(texto);
            if(typeof negocio.imagen_url==='string'&&/^\/media\/servicios\/[a-zA-Z0-9_-]+\.webp$/.test(negocio.imagen_url)){const img=documento.createElement('img');img.src=negocio.imagen_url;img.alt=negocio.nombre;img.onerror=()=>img.remove();extra.append(img);}
        }}

        indicaciones.replaceChildren();
        if(negocio) indicaciones.append(crearVistaIndicaciones(documento,negocio));
        if(pierdeFoco)boton.focus();
    },mostrar:({abierto,mensaje})=>{
        const pierdeFoco=!abierto && panel.contains?.(documento.activeElement);
        panel.hidden=!abierto;if(pierdeFoco)boton.focus();boton.setAttribute('aria-expanded',String(abierto));
        boton.textContent=abierto?'Cerrar mapa':'Ver mapa';estado.textContent=[proveedor.aviso,mensaje].filter(Boolean).join(' ');
        documento.querySelector('#tituloMapa').textContent=['google','leaflet'].includes(proveedor.modo)?'Mapa de emprendimientos':'Vista de preparación del mapa';
        documento.querySelector('#descripcionMapa').textContent=proveedor.modo==='leaflet'?'Cartografía de OpenStreetMap. Selecciona un marcador para consultar sus servicios.':proveedor.modo==='google'?'Mapa real de Google. Puedes seleccionar un emprendimiento para consultar sus servicios.':'Esta vista no es un mapa real. Puedes elegir un emprendimiento para consultar sus servicios.';
    },seleccionar:negocio=>globalThis.seleccionar?.(negocio)});
    boton.onclick=control.alternar;
    accion.onclick=()=>control.verServicios();
    panel.addEventListener?.('keydown',evento=>{
        if(evento.key==='Escape' && !panel.hidden) {evento.preventDefault();control.alternar();boton.focus();}
    });
    globalThis.destacarNegocioMapa=id=>control.destacar(id);
    suscribir((datos,contexto)=>{
        const listaCompacta=documento.getElementById?.('listaMapaCompacta');
        if(listaCompacta){
            listaCompacta.replaceChildren();
            for(const negocio of datos){
                const tarjeta=documento.createElement('article');tarjeta.className='negocioCompacto';tarjeta.dataset.idNegocio=String(negocio.id_emprendimiento);
                const titulo=documento.createElement('h5');titulo.textContent=negocio.nombre;
                const comuna=documento.createElement('p');comuna.textContent=negocio.comuna||'';
                const distancia=documento.createElement('p');distancia.className='distanciaNegocio';
                distancia.textContent=typeof negocio.distancia==='number'?'Aprox. '+new Intl.NumberFormat('es-CL',{maximumFractionDigits:1}).format(negocio.distancia)+' km · en línea recta':'';
                const boton=documento.createElement('button');boton.type='button';boton.textContent='Ver servicios';boton.setAttribute('aria-label','Ver servicios de '+negocio.nombre+' desde el mapa');boton.onclick=()=>globalThis.seleccionar?.(negocio);
                tarjeta.append(titulo,comuna,distancia,boton);listaCompacta.append(tarjeta);
            }
            if(!datos.length){const vacio=documento.createElement('p');vacio.textContent='No hay emprendimientos para estos filtros.';listaCompacta.append(vacio);}
        }
        return control.actualizar(datos,contexto);
    });
    return control;
}
if (typeof document!=='undefined') montarMapa(document, escuchar=>globalThis.suscribirMapa?.(escuchar));
