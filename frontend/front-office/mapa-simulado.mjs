import {normalizarMarcadores} from './mapa-datos.mjs';
// Sin cartografía ni conexiones externas; prepara nodos antes de publicarlos.
export function crearProveedorSimulado(documento, contenedor) {
    return {
        limpiar:()=>contenedor.replaceChildren(),
        async preparar(datos, elegir) {
            return normalizarMarcadores(datos).map(d=>{
                const b=documento.createElement('button'); b.type='button'; b.className='secundario';
                b.setAttribute('data-emprendimiento-id',String(d.id));
                b.setAttribute('aria-label','Seleccionar '+d.nombre);
                b.textContent=d.nombre+(d.comuna ? ' · '+d.comuna : '');
                b.onclick=()=>elegir(d.id);return b;
            });
        },
        renderizar:botones=>contenedor.replaceChildren(...botones)
    };
}
