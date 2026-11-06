import {validarCoordenadas} from './geografia.mjs';

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
