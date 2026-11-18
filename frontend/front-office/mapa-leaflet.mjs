import {validarCoordenadas} from './geografia.mjs';
import {normalizarMarcadores} from './mapa-datos.mjs';
// Biblioteca local; solo teselas públicas tras una apertura explícita.
export function crearProveedorLeaflet({documento,contenedor,L}) {
    let mapa=null,version=0,teselas=null;
    const marcadores=new Map();
    let ubicacion=null,clienta=null;
    const superficie=documento.createElement('div');superficie.className='mapaLeaflet';
    superficie.setAttribute('aria-label','Mapa de emprendimientos con OpenStreetMap');
    const aviso=documento.createElement('p');aviso.className='ayuda';aviso.setAttribute('role','status');
    function retirarMarcadores() {
        for(const registro of marcadores.values()) {
            registro.limpiarTeclado();registro.marcador.remove();registro.marcador.off();
        }
        marcadores.clear();
    }
    function retirarTeselas() {
        if(teselas){
            const anterior=teselas;teselas=null;
            // Leaflet debe ejecutar primero sus propios hooks de remove para
            // desconectar los eventos del mapa; off antes de remove los borraría.
            anterior.remove();anterior.off();
        }
    }
    function limpiar() {
        version++;retirarMarcadores();retirarTeselas();if(clienta){clienta.remove();clienta=null;}
        superficie.hidden=true;aviso.hidden=true;
    }
    function crearCartografia(actual) {
        // Cada capa tiene su propia identidad. Ningún evento de una capa retirada
        // puede describir la nueva vista. El navegador conserva su caché HTTP normal.
        const capa=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
            maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',
            attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        });
        teselas=capa;
        const resultados=new Map();let cargando=true;
        const vigente=()=>actual===version&&teselas===capa;
        function anunciar() {
            if(!vigente())return;
            const estados=[...resultados.values()];
            const correctas=estados.filter(v=>v==='correcta').length;
            const fallidas=estados.filter(v=>v==='fallida').length;
            const pendientes=estados.filter(v=>v==='pendiente').length;
            let texto,estado;
            if(fallidas) {
                if(correctas) {estado='fallo_parcial';texto='Parte de la cartografía no pudo cargarse. Puedes continuar con las tarjetas y los servicios.';}
                else if(pendientes||cargando) {estado='error_en_carga';texto='No se pudieron cargar algunas teselas; la carga todavía no ha terminado. Puedes continuar con las tarjetas.';}
                else {estado='fallo_total';texto='No se pudo cargar ninguna de las teselas verificadas de esta vista. Puedes continuar con las tarjetas y los servicios.';}
            } else if(pendientes||cargando) {estado='cargando';texto='Cargando cartografía de OpenStreetMap…';}
            else if(correctas) {estado='disponible';texto='Cartografía de OpenStreetMap cargada. Selecciona un marcador para ver el emprendimiento.';}
            else {estado='sin_evidencia';texto='No se pudo verificar la carga de la cartografía. Puedes continuar con las tarjetas.';}
            aviso.textContent=texto;aviso.setAttribute('data-estado',estado);
        }
        capa.on('loading',()=>{if(vigente()){cargando=true;anunciar();}});
        capa.on('tileloadstart',evento=>{
            if(!vigente()||!evento.tile)return;
            resultados.set(evento.tile,'pendiente');anunciar();
        });
        for(const [evento,resultado]of [['tileload','correcta'],['tileerror','fallida']]) {
            capa.on(evento,datos=>{
                if(!vigente()||!resultados.has(datos.tile))return;
                resultados.set(datos.tile,resultado);anunciar();
            });
        }
        capa.on('tileunload',evento=>{
            if(!vigente()||!resultados.delete(evento.tile))return;
            anunciar();
        });
        // Leaflet emite load también cuando todas las solicitudes terminan en error.
        capa.on('load',()=>{if(vigente()){cargando=false;anunciar();}});
        anunciar();capa.addTo(mapa);
    }
    return {
        limpiar,invalidar:limpiar,abrir:()=>{},
        ubicar:valor=>{ubicacion=validarCoordenadas(valor?.latitud,valor?.longitud);},
        destacar:id=>{for(const [clave,r]of marcadores){r.marcador.setZIndexOffset?.(clave===id?1000:0);r.marcador.getElement()?.classList?.toggle('pinLeafletSeleccionado',clave===id);}},
        async preparar(datos,seleccionar){return {datos:normalizarMarcadores(datos),seleccionar};},
        renderizar({datos,seleccionar}) {
            const actual=++version;
            retirarMarcadores();retirarTeselas();
            superficie.hidden=false;aviso.hidden=false;
            const publicos=normalizarMarcadores(datos);
            if(!mapa){
                contenedor.replaceChildren(superficie,aviso);
                mapa=L.map(superficie,{scrollWheelZoom:false}).setView([-33.4379667,-70.6504],13);
            }
            for(const d of publicos){
                const m=L.marker([d.latitud,d.longitud],{title:d.nombre,alt:'Seleccionar '+d.nombre,keyboard:true}).addTo(mapa);
                const vigente=()=>actual===version&&marcadores.get(d.id)?.marcador===m;
                const activar=()=>{if(vigente())seleccionar(d.id);};
                let pulsada=false,clickTeclado=false;
                const esActivacion=evento=>['Enter',' ','Spacebar'].includes(evento.key)||evento.code==='Space';
                const teclado=evento=>{
                    if(!vigente()||!esActivacion(evento))return;
                    L.DomEvent.stop(evento); // Impide scroll y acción nativa duplicada.
                    if(evento.repeat||pulsada)return;
                    pulsada=true;clickTeclado=true;activar();
                    // Solo suprime el click sintético de esta misma acción, sin
                    // bloquear clicks posteriores de tecnologías de asistencia.
                    queueMicrotask(()=>{clickTeclado=false;});
                };
                const soltar=evento=>{if(esActivacion(evento))pulsada=false;};
                const desenfocar=()=>{pulsada=false;};
                const icono=m.getElement();
                L.DomEvent.on(icono,'keydown',teclado);
                L.DomEvent.on(icono,'keyup',soltar);
                L.DomEvent.on(icono,'blur',desenfocar);
                m.on('click',evento=>{
                    if(clickTeclado&&evento?.originalEvent?.detail===0)return;
                    activar();
                });
                marcadores.set(d.id,{marcador:m,limpiarTeclado:()=>{
                    L.DomEvent.off(icono,'keydown',teclado);L.DomEvent.off(icono,'keyup',soltar);L.DomEvent.off(icono,'blur',desenfocar);
                    pulsada=false;clickTeclado=false;
                }});
            }
            if(clienta){clienta.remove();clienta=null;}
            if(ubicacion&&L.circleMarker)clienta=L.circleMarker([ubicacion.latitud,ubicacion.longitud],{radius:10,color:'#fff',weight:3,fillColor:'#1976d2',fillOpacity:1}).addTo(mapa);
            mapa.invalidateSize();
            // Ajustar el encuadre antes de añadir la capa evita pedir dos vistas.
            if(ubicacion)mapa.fitBounds([...publicos.map(d=>[d.latitud,d.longitud]),[ubicacion.latitud,ubicacion.longitud]],{padding:[32,32],maxZoom:16,animate:false});
            else if(publicos.length===1)mapa.setView([publicos[0].latitud,publicos[0].longitud],15,{animate:false});
            else if(publicos.length>1)mapa.fitBounds(publicos.map(d=>[d.latitud,d.longitud]),{padding:[32,32],maxZoom:16,animate:false});
            else mapa.setView([-33.4379667,-70.6504],13,{animate:false});
            crearCartografia(actual);
        }
    };
}
