const {test}=require('node:test'),assert=require('node:assert/strict');
const googleModulo=import('../../frontend/front-office/mapa-google.mjs');
const proveedoresModulo=import('../../frontend/front-office/mapa-proveedores.mjs');
const mapaModulo=import('../../frontend/front-office/mapa.mjs');
// Clave deliberadamente ficticia. El documento y SDK son objetos en memoria:
// ningún nodo real se inserta en navegador ni se utiliza red.
const configuracion={habilitado:true,autorizado:true,apiKey:'CLAVE_FICTICIA_NO_REAL',mapId:'DEMO_MAP_ID',entorno:'pruebas'};
const negocio={id:1,nombre:'Negocio ficticio',latitud:-33.4,longitud:-70.6};
const negocioAPI={id_emprendimiento:1,nombre:negocio.nombre,latitud:negocio.latitud,longitud:negocio.longitud};
const pausa=()=>new Promise(setImmediate);
function entorno() {
    const scripts=[],temporizadores=[],mapas=[],marcadores=[],bibliotecas=[];
    class Nodo {
        constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.hidden=false;}
        setAttribute(k,v){this.attributes[k]=v;}
        replaceChildren(...n){this.children=n;}
        remove(){this.eliminado=true;}
    }
    const mundo={isSecureContext:true};
    let falloImportacion=false,falloMapa=false;
    class Mapa {
        constructor(host,opciones){if(falloMapa)throw Error('API simulada');this.host=host;this.opciones=opciones;mapas.push(this);}
        setCenter(p){this.center=p;}
        setZoom(z){this.zoom=z;}
        fitBounds(b){this.bounds=b;}
    }
    class Limites {constructor(){this.puntos=[];}extend(p){this.puntos.push(p);}}
    class Marcador {
        constructor(opciones){Object.assign(this,opciones);marcadores.push(this);}
        addListener(evento,fn){this.evento=evento;this.elegir=fn;return {remove:()=>{this.eliminado=true;}};}
    }
    const documento={head:{append:n=>{scripts.push(n);}},createElement:tag=>new Nodo(tag),querySelector:()=>scripts.find(n=>!n.eliminado)||null};
    const aceptar=()=>{
        mundo.google={maps:{importLibrary:async nombre=>{
            bibliotecas.push(nombre);if(falloImportacion)throw Error('Biblioteca simulada');
            if(nombre==='maps')return {Map:Mapa};
            if(nombre==='core')return {LatLngBounds:Limites};
            if(nombre==='marker')return {AdvancedMarkerElement:Marcador};
            throw Error('Biblioteca inesperada');
        }}};
        mundo.__merakiMapsReady();
    };
    return {documento,mundo,scripts,mapas,marcadores,bibliotecas,contenedor:new Nodo('div'),aceptar,
        esperar:fn=>{temporizadores.push(fn);return temporizadores.length-1;},cancelar:id=>{temporizadores[id]=null;},temporizadores,
        falloImportacion:v=>{falloImportacion=v;},falloMapa:v=>{falloMapa=v;}};
}
async function cargador(e) {
    const {crearCargadorGoogle}=await googleModulo;
    return crearCargadorGoogle({documento:e.documento,mundo:e.mundo,esperar:e.esperar,cancelar:e.cancelar});
}

test('Google requiere configuración completa, autorización y entorno DEMO permitido',async()=>{
    const {configurarGoogle}=await googleModulo;
    for(const valor of [undefined,null,{},configuracion && {...configuracion,habilitado:false},{...configuracion,autorizado:false},{...configuracion,apiKey:''},{...configuracion,mapId:''},{...configuracion,entorno:'produccion'}])assert.equal(configurarGoogle(valor),null);
    const normal=configurarGoogle(configuracion);assert(normal);assert(Object.isFrozen(normal));
    assert(configurarGoogle({...configuracion,mapId:'id_propio',entorno:'produccion'}));
});

test('Configuración ausente, sin clave o sin autorización conserva simulador sin scripts',async()=>{
    const {crearProveedorMapa}=await proveedoresModulo;
    for(const config of [undefined,{}, {...configuracion,apiKey:''},{...configuracion,autorizado:false}]) {
        const e=entorno();const p=crearProveedorMapa({documento:e.documento,contenedor:e.contenedor,mundo:e.mundo,leerConfiguracion:()=>config});
        assert.equal(e.scripts.length,0);p.abrir();p.renderizar(await p.preparar([negocio],()=>{}));
        assert.equal(p.modo,'simulado');assert.equal(e.scripts.length,0);assert.equal(e.contenedor.children.length,1);
    }
});

test('SDK solo carga bajo demanda y deduplica script y bibliotecas concurrentes',async()=>{
    const e=entorno(),c=await cargador(e);assert.equal(e.scripts.length,0);
    const a=c.cargar(configuracion),b=c.cargar(configuracion);assert.equal(e.scripts.length,1);
    assert.equal(new URL(e.scripts[0].src).origin,'https://maps.googleapis.com');
    e.aceptar();await Promise.all([a,b]);await c.cargar(configuracion);
    assert.equal(e.scripts.length,1);assert.deepEqual(e.bibliotecas,['maps','marker','core']);
});

test('Cargadores por documento se comparten y bloquean contexto inseguro o SDK ajeno',async()=>{
    const {cargadorGoogle}=await googleModulo;const e=entorno();assert.equal(cargadorGoogle(e.documento,e.mundo),cargadorGoogle(e.documento,e.mundo));
    const c=await cargador(e);e.mundo.isSecureContext=false;await assert.rejects(c.cargar(configuracion));assert.equal(e.scripts.length,0);
    e.mundo.isSecureContext=true;e.mundo.google={maps:{}};await assert.rejects(c.cargar(configuracion));assert.equal(e.scripts.length,0);
});

test('Error de red permite reintento explícito sin scripts duplicados activos',async()=>{
    const e=entorno(),c=await cargador(e);const a=c.cargar(configuracion);e.scripts[0].onerror();await assert.rejects(a);
    assert(e.scripts[0].eliminado);const b=c.cargar(configuracion);assert.equal(e.scripts.length,2);e.aceptar();await b;
    assert.equal(e.scripts.filter(n=>!n.eliminado).length,1);
});

test('Fallo de autorización bloquea nuevas cargas incluso después de resolver SDK',async()=>{
    const e=entorno(),c=await cargador(e);let errores=0;c.alFallar(()=>errores++);
    const a=c.cargar(configuracion);e.mundo.gm_authFailure();await assert.rejects(a);await assert.rejects(c.cargar(configuracion));
    assert.equal(e.scripts.length,1);assert.equal(errores,1);
    const f=entorno(),d=await cargador(f);let tardios=0;d.alFallar(()=>tardios++);const b=d.cargar(configuracion);f.aceptar();await b;f.mundo.gm_authFailure();assert.equal(tardios,1);await assert.rejects(d.cargar(configuracion));
});

test('Timeout de SDK no reinyecta automáticamente un script de resultado incierto',async()=>{
    const e=entorno(),c=await cargador(e);const a=c.cargar(configuracion);e.temporizadores[0]();await assert.rejects(a);
    e.aceptar();await assert.rejects(c.cargar(configuracion));assert.equal(e.scripts.length,1);
});

test('Error de biblioteca puede reintentarse sin volver a descargar SDK',async()=>{
    const e=entorno(),c=await cargador(e);e.falloImportacion(true);const a=c.cargar(configuracion);e.aceptar();await assert.rejects(a);
    e.falloImportacion(false);await c.cargar(configuracion);assert.equal(e.scripts.length,1);
});

test('Proveedor crea una sola instancia, cambia marcadores y encuadra solo negocios',async()=>{
    const {crearProveedorGoogle}=await googleModulo;const e=entorno(),c=await cargador(e),elegidos=[];
    const p=crearProveedorGoogle({documento:e.documento,contenedor:e.contenedor,config:configuracion,cargador:c});
    const a=p.preparar([{...negocio,ubicacionClienta:{latitud:80,longitud:80}}, {...negocio,id:2,latitud:null}],id=>elegidos.push(id));
    e.aceptar();p.renderizar(await a);assert.equal(e.mapas.length,1);assert.equal(e.marcadores.length,1);
    assert.deepEqual(e.mapas[0].opciones.center,{lat:-33.4,lng:-70.6});assert.equal(e.mapas[0].opciones.mapId,'DEMO_MAP_ID');
    e.marcadores[0].elegir();assert.deepEqual(elegidos,[1]);p.limpiar();assert.equal(e.marcadores[0].map,null);assert(e.marcadores[0].eliminado);
    p.abrir();p.renderizar(await p.preparar([negocio,{...negocio,id:3,latitud:-34}],()=>{}));
    assert.equal(e.mapas.length,1);assert.equal(e.scripts.length,1);assert.equal(e.mapas[0].bounds.puntos.length,2);
});

test('API fallida se limpia, filtros no reintentan y apertura explícita permite recuperar',async()=>{
    const {crearProveedorGoogle}=await googleModulo;const e=entorno(),c=await cargador(e);e.falloMapa(true);
    const p=crearProveedorGoogle({documento:e.documento,contenedor:e.contenedor,config:configuracion,cargador:c});
    const a=p.preparar([negocio],()=>{});e.aceptar();const contenido=await a;
    assert.throws(()=>p.renderizar(contenido));assert.equal(e.mapas.length,0);
    await assert.rejects(p.preparar([negocio],()=>{}));assert.equal(e.scripts.length,1);
    e.falloMapa(false);p.abrir();p.renderizar(await p.preparar([negocio],()=>{}));assert.equal(e.mapas.length,1);
});


test('Adaptador Google no carga al buscar o montar, espera apertura y reutiliza mapa al cerrar',async()=>{
 const {crearProveedorMapa}=await proveedoresModulo,{crearMapa}=await mapaModulo;
 const e=entorno(),estados=[],selecciones=[];
 const proveedor=crearProveedorMapa({documento:e.documento,contenedor:e.contenedor,mundo:e.mundo,leerConfiguracion:()=>configuracion});
 const control=crearMapa({proveedor,mostrar:valor=>estados.push(valor),seleccionar:n=>selecciones.push(n)});
 await control.actualizar([negocioAPI]);assert.equal(e.scripts.length,0);
 const apertura=control.alternar();assert.equal(e.scripts.length,1);e.aceptar();await apertura;assert.equal(e.mapas.length,1);
 e.marcadores[0].elegir();assert.equal(selecciones.length,0);control.verServicios();assert.equal(selecciones[0].id_emprendimiento,1);
 await control.alternar();assert.equal(e.marcadores[0].map,null);
 await control.alternar();assert.equal(e.mapas.length,1);assert.equal(e.scripts.length,1);
});

test('Filtros nuevos y cierre durante carga descartan renders y selecciones antiguos',async()=>{
 const {crearProveedorMapa}=await proveedoresModulo,{crearMapa}=await mapaModulo;
 const e=entorno(),selecciones=[];const proveedor=crearProveedorMapa({documento:e.documento,contenedor:e.contenedor,mundo:e.mundo,leerConfiguracion:()=>configuracion});
 const c=crearMapa({proveedor,mostrar:()=>{},seleccionar:n=>selecciones.push(n)});
 await c.actualizar([negocioAPI]);const a=c.alternar();const b=c.actualizar([{...negocioAPI,id_emprendimiento:2,nombre:'Actual'}]);e.aceptar();await Promise.all([a,b]);
 assert.equal(e.marcadores.length,1);assert.equal(e.marcadores[0].title,'Actual');
 const anterior=e.marcadores[0];await c.actualizar([]);anterior.elegir();assert.equal(selecciones.length,0);
 await c.actualizar([negocioAPI]);await c.alternar();assert.equal(e.marcadores.at(-1).map,null);
 const f=entorno();const p=crearProveedorMapa({documento:f.documento,contenedor:f.contenedor,mundo:f.mundo,leerConfiguracion:()=>configuracion});
 const d=crearMapa({proveedor:p,mostrar:()=>{},seleccionar:()=>{}});await d.actualizar([negocioAPI]);const pendiente=d.alternar();await d.alternar();f.aceptar();await pendiente;assert.equal(f.mapas.length,0);
});

test('Fallo de red no reintenta por filtros y mantiene catálogo disponible',async()=>{
 const {crearProveedorMapa}=await proveedoresModulo,{crearMapa}=await mapaModulo;const e=entorno(),estados=[];
 const p=crearProveedorMapa({documento:e.documento,contenedor:e.contenedor,mundo:e.mundo,leerConfiguracion:()=>configuracion});
 const c=crearMapa({proveedor:p,mostrar:s=>estados.push(s),seleccionar:()=>{}});await c.actualizar([negocioAPI]);const a=c.alternar();e.scripts[0].onerror();await a;
 assert.match(estados.at(-1).mensaje,/tarjetas/);await c.actualizar([negocioAPI]);assert.equal(e.scripts.length,1);
 await c.alternar();const b=c.alternar();assert.equal(e.scripts.length,2);e.aceptar();await b;assert.equal(e.mapas.length,1);
});

test('Autorización tardía limpia marcadores y muestra alternativa de catálogo',async()=>{
 const {crearProveedorMapa}=await proveedoresModulo,{crearMapa}=await mapaModulo;const e=entorno(),estados=[];
 const p=crearProveedorMapa({documento:e.documento,contenedor:e.contenedor,mundo:e.mundo,leerConfiguracion:()=>configuracion});
 const c=crearMapa({proveedor:p,mostrar:s=>estados.push(s),seleccionar:()=>{}});await c.actualizar([negocioAPI]);const a=c.alternar();e.aceptar();await a;e.mundo.gm_authFailure();
 assert.equal(e.marcadores[0].map,null);assert.match(estados.at(-1).mensaje,/tarjetas/);
 await c.alternar();await c.alternar();assert.equal(e.scripts.length,1);
});

test('Sin negocios válidos no carga SDK, ni recibe campos o ubicación de clienta',async()=>{
 const {crearProveedorMapa}=await proveedoresModulo,{crearMapa}=await mapaModulo;const e=entorno();
 const p=crearProveedorMapa({documento:e.documento,contenedor:e.contenedor,mundo:e.mundo,leerConfiguracion:()=>configuracion});
 const c=crearMapa({proveedor:p,mostrar:()=>{},seleccionar:()=>{}});await c.actualizar([{...negocioAPI,latitud:null}]);await c.alternar();assert.equal(e.scripts.length,0);
 await c.alternar();await c.actualizar([{...negocioAPI,ubicacionClienta:{latitud:80,longitud:80}}]);const a=c.alternar();e.aceptar();await a;
 assert.deepEqual(e.mapas[0].opciones.center,{lat:-33.4,lng:-70.6});assert.deepEqual(e.marcadores[0].position,{lat:-33.4,lng:-70.6});
});

test('Google sincroniza por ID: actualiza, incorpora y elimina sin duplicar SDK o mapa',async()=>{
 const {crearProveedorGoogle}=await googleModulo;const e=entorno(),c=await cargador(e),selecciones=[];
 const p=crearProveedorGoogle({documento:e.documento,contenedor:e.contenedor,config:configuracion,cargador:c});
 const a=p.preparar([negocio,{...negocio,id:'1',nombre:'Duplicado'}],id=>selecciones.push(id));e.aceptar();p.renderizar(await a);
 assert.equal(e.marcadores.length,1);const primero=e.marcadores[0],viejoClick=primero.elegir;
 p.invalidar();p.renderizar(await p.preparar([{...negocio,nombre:'Actual',latitud:-34},{...negocio,id:2}],id=>selecciones.push(id)));
 assert.equal(e.marcadores.length,2);assert.equal(e.marcadores[0],primero);assert.equal(primero.title,'Actual');assert.equal(primero.position.lat,-34);
 viejoClick();assert.equal(selecciones.length,0);primero.elegir();assert.deepEqual(selecciones,[1]);
 p.invalidar();p.renderizar(await p.preparar([{...negocio,id:2}],()=>{}));assert.equal(primero.map,null);assert.equal(e.marcadores[1].map,e.mapas[0]);
 assert.equal(e.mapas.length,1);assert.equal(e.scripts.length,1);
 p.limpiar();assert(e.marcadores.every(m=>m.map===null));
});

test('Google con cero marcadores no carga, y limpiar tras resultados vacíos retira todos',async()=>{
 const {crearProveedorGoogle}=await googleModulo;const e=entorno(),c=await cargador(e);
 const p=crearProveedorGoogle({documento:e.documento,contenedor:e.contenedor,config:configuracion,cargador:c});
 p.renderizar(await p.preparar([{...negocio,latitud:null}],()=>{}));assert.equal(e.scripts.length,0);
 const a=p.preparar([negocio],()=>{});e.aceptar();p.renderizar(await a);
 p.renderizar(await p.preparar([],()=>{}));assert.equal(e.marcadores[0].map,null);assert.equal(e.mapas[0].host.hidden,true);
});
