// Posiciones ilustrativas solicitadas para el ensayo, nunca direcciones reales.
// Ensayo local en el Front Office habitual; no se guardan ni envían a la API.
import {validarCoordenadas} from './geografia.mjs';
export function aplicarDemoMapa(datos, url) {
    const pagina=new URL(url);
    if(!['localhost','127.0.0.1','[::1]'].includes(pagina.hostname)) return datos;
    const lugares={
        'Belleza Camila':{latitud:-33.51,longitud:-70.76,comuna:'Maipú'},
        'Belleza Daniela':{latitud:-33.408,longitud:-70.567,comuna:'Las Condes'}
    };
    return datos.map(n=>lugares[n.nombre]&&!validarCoordenadas(n.latitud,n.longitud)?{...n,...lugares[n.nombre],nombre:n.nombre+' · ubicación de demostración'}:n);
}
