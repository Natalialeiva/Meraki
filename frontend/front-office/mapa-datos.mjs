import {validarCoordenadas} from './geografia.mjs';

// Condición interna preparada para una fuente confiable futura. No se lee ni
// se inventa un campo de confirmación en la API actual: los consumidores no
// pasan true mientras esa fuente no exista. Una dirección libre no es alternativa.
export function crearEnlaceIndicaciones(negocio, destinoConfirmado=false) {
    if (destinoConfirmado!==true) return null;
    const par=validarCoordenadas(negocio?.latitud,negocio?.longitud);
    if (!par) return null;
    const enlace=new URL('https://www.google.com/maps/dir/');
    enlace.search=new URLSearchParams({api:'1',destination:par.latitud+','+par.longitud}).toString();
    return enlace.href;
}

export function crearVistaIndicaciones(documento, negocio, destinoConfirmado=false) {
    const vista=documento.createElement('div');vista.className='indicaciones';
    const destino=crearEnlaceIndicaciones(negocio,destinoConfirmado);
    const mensaje=documento.createElement('p');mensaje.className='ayuda';
    if (!destino) mensaje.textContent='Ubicación exacta no disponible';
    else {
        const enlace=documento.createElement('a');enlace.href=destino;
        enlace.className='enlaceIndicaciones';enlace.textContent='Cómo llegar';
        enlace.dataset.accion='indicaciones';
        enlace.setAttribute('aria-label','Cómo llegar a '+(negocio.nombre||'este emprendimiento'));
        enlace.target='_blank';enlace.rel='noopener noreferrer';enlace.referrerPolicy='no-referrer';
        mensaje.textContent='Abre Google Maps fuera de Meraki, en otra pestaña o aplicación.';
        enlace.setAttribute('aria-description','Abre Google Maps fuera de Meraki, en otra pestaña o aplicación.');
        vista.append(enlace);
    }
    vista.append(mensaje);return vista;
}

// Lista pública, un registro por ID válido; primer registro válido prevalece.
export function normalizarMarcadores(datos) {
    const unicos=new Map();
    for(const dato of datos) {
        if(!dato || typeof dato!=='object') continue;
        const valor=dato.id;
        if (!(typeof valor==='number' || (typeof valor==='string' && /^[1-9]\d*$/.test(valor)))) continue;
        const id=Number(valor), par=validarCoordenadas(dato.latitud,dato.longitud);
        if (!Number.isSafeInteger(id) || id<=0 || !par || unicos.has(id)) continue;
        unicos.set(id,{id,nombre:typeof dato.nombre==='string'?dato.nombre:'',comuna:typeof dato.comuna==='string'?dato.comuna:'',...par});
    }
    return [...unicos.values()].sort((a,b)=>a.id-b.id);
}
