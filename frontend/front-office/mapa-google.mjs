import {normalizarMarcadores} from './mapa-datos.mjs';

// La ausencia de cualquiera de las dos autorizaciones conserva el simulador.
export function configurarGoogle(valor) {
    if (!valor || valor.habilitado!==true || valor.autorizado!==true) return null;
    if (typeof valor.apiKey!=='string' || !/^[A-Za-z0-9_-]{10,200}$/.test(valor.apiKey)) return null;
    if (typeof valor.mapId!=='string' || !/^[A-Za-z0-9_-]{1,100}$/.test(valor.mapId)) return null;
    if (!['pruebas','produccion'].includes(valor.entorno)) return null;
    if (valor.mapId==='DEMO_MAP_ID' && valor.entorno!=='pruebas') return null;
    return Object.freeze({habilitado:true,autorizado:true,apiKey:valor.apiKey,mapId:valor.mapId,entorno:valor.entorno});
}

const cargadores=new WeakMap();
// Un cargador compartido por documento impide duplicar el script entre proveedores.
export function cargadorGoogle(documento, mundo) {
    if (!cargadores.has(documento)) cargadores.set(documento, crearCargadorGoogle({documento,mundo}));
    return cargadores.get(documento);
}

export function crearCargadorGoogle({documento,mundo,esperar=setTimeout,cancelar=clearTimeout}) {
    let clave=null, carga=null, librerias=null, cargado=false, fatal=false;
    const errores=new Set();
    const fallo=()=>Error('No se pudo habilitar Google Maps. Puedes seguir usando el catálogo.');
    const notificar=()=>{for(const receptor of errores) receptor();};
    async function cargar(config) {
        // Validación también aquí: ni siquiera el cargador directo acepta configuración incompleta.
        if (!configurarGoogle(config) || mundo.isSecureContext!==true || fatal) throw fallo();
        if (clave!==null && clave!==config.apiKey) throw fallo();
        clave=config.apiKey;
        if (!carga) {
            if (mundo.google || documento.querySelector('script[data-meraki-google]') || mundo.__merakiMapsReady || mundo.gm_authFailure) throw fallo();
            carga=new Promise((resolve,reject)=>{
                const script=documento.createElement('script');
                script.setAttribute('data-meraki-google','true'); script.async=true;
                const url=new URL('https://maps.googleapis.com/maps/api/js');
                url.search=new URLSearchParams({key:config.apiKey,v:'quarterly',loading:'async',callback:'__merakiMapsReady'}).toString();
                script.src=url.href;
                let terminado=false;
                const fin=()=>{terminado=true;cancelar(reloj);script.onerror=null;};
                const reloj=esperar(()=>{
                    if (terminado) return;
                    fin();fatal=true;script.remove();reject(fallo());
                },15000);
                mundo.gm_authFailure=()=>{
                    fatal=true;
                    if (!terminado) {fin();reject(fallo());}
                    notificar();
                };
                mundo.__merakiMapsReady=()=>{
                    if (terminado || fatal) return;
                    fin();cargado=true;resolve();
                };
                script.onerror=()=>{
                    if (terminado) return;
                    fin();script.remove();delete mundo.__merakiMapsReady;delete mundo.gm_authFailure;
                    reject(fallo());
                };
                documento.head.append(script);
            }).catch(()=>{
                carga=null;
                throw fallo();
            });
        }
        await carga;
        if (fatal || !cargado || typeof mundo.google?.maps?.importLibrary!=='function') throw fallo();
        if (!librerias) librerias=Promise.all([
            mundo.google.maps.importLibrary('maps'), mundo.google.maps.importLibrary('marker'), mundo.google.maps.importLibrary('core')
        ]).then(([maps,marker,core])=>{
            if (typeof maps.Map!=='function' || typeof core.LatLngBounds!=='function' || typeof marker.AdvancedMarkerElement!=='function') throw fallo();
            return {Map:maps.Map,LatLngBounds:core.LatLngBounds,AdvancedMarkerElement:marker.AdvancedMarkerElement};
        }).catch(()=>{librerias=null;throw fallo();});
        const sdk=await librerias;
        if (fatal) throw fallo();
        return sdk;
    }
    return {cargar, alFallar:receptor=>errores.add(receptor)};
}

export function crearProveedorGoogle({documento,contenedor,config,cargador,alError=()=>{}}) {
    let mapa=null, falloAnterior=false, revision=0;
    const marcadores=new Map();
    const superficie=documento.createElement('div'); superficie.className='mapaGoogle';
    superficie.setAttribute('aria-label','Mapa de emprendimientos');
    function invalidar() {
        revision++;superficie.hidden=true;
        for(const registro of marcadores.values()) {registro.evento?.remove();registro.evento=null;registro.marcador.map=null;}
    }
    function limpiar() {invalidar();marcadores.clear();}
    cargador.alFallar(()=>{falloAnterior=true;limpiar();alError();});
    return {
        limpiar, invalidar,
        abrir:()=>{falloAnterior=false;},
        async preparar(datos, seleccionar) {
            if (falloAnterior) throw Error('Mapa no disponible. Cierra y vuelve a intentar.');
            try {
                const publicos=normalizarMarcadores(datos);
                if (!publicos.length) return {sdk:null,datos:[],seleccionar};
                const sdk=await cargador.cargar(config);
                return {sdk,datos:publicos,seleccionar};
            } catch {falloAnterior=true;throw Error('Mapa no disponible.');}
        },
        renderizar({sdk,datos,seleccionar}) {
            if (falloAnterior) throw Error('Mapa no disponible.');
            const publicos=normalizarMarcadores(datos);
            if (!publicos.length) {limpiar();return;}
            try {
                const actual=++revision;
                const vigentes=new Set(publicos.map(d=>d.id));
                for(const [id,registro] of marcadores) {
                    registro.evento?.remove();registro.evento=null;
                    if(!vigentes.has(id)) {registro.marcador.map=null;marcadores.delete(id);}
                }
                superficie.hidden=false;
                if (!mapa) {
                    contenedor.replaceChildren(superficie);
                    mapa=new sdk.Map(superficie,{mapId:config.mapId,center:{lat:publicos[0].latitud,lng:publicos[0].longitud},zoom:14,streetViewControl:false,mapTypeControl:false});
                }
                if(falloAnterior)throw Error('Mapa no disponible.');
                const limites=new sdk.LatLngBounds();
                for(const d of publicos) {
                    const position={lat:d.latitud,lng:d.longitud};limites.extend(position);
                    let registro=marcadores.get(d.id);
                    if(!registro) {
                        registro={marcador:new sdk.AdvancedMarkerElement({map:mapa,position,title:d.nombre}),evento:null};
                        marcadores.set(d.id,registro);
                    } else {
                        registro.marcador.position=position;registro.marcador.title=d.nombre;registro.marcador.map=mapa;
                    }
                    registro.evento=registro.marcador.addListener('click',()=>{
                        if(actual===revision && marcadores.has(d.id))seleccionar(d.id);
                    });
                }
                if(publicos.length===1) {mapa.setCenter({lat:publicos[0].latitud,lng:publicos[0].longitud});mapa.setZoom(14);}
                else mapa.fitBounds(limites,32);
            } catch {falloAnterior=true;limpiar();throw Error('Mapa no disponible.');}
        }
    };
}
