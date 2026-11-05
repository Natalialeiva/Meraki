const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulo = import('../../frontend/front-office/ubicacion.mjs');
async function iniciar(opciones = {}) {
    const {crearUbicacion} = await modulo;
    const estados=[], llamadas=[];
    const geo={getCurrentPosition:(ok,error,config)=>llamadas.push({ok,error,config})};
    const control=crearUbicacion({geolocalizacion:geo,seguro:true,mostrar:e=>estados.push(e),...opciones});
    return {control,estados,llamadas};
}
const resultado={coords:{latitude:-33.4,longitude:-70.6,accuracy:25}};
test('Ubicación no solicita automáticamente y acepta permiso con precisión sin duplicados', async()=>{
    const p=await iniciar(); assert.equal(p.llamadas.length,0); assert.equal(p.control.obtener(),null);
    p.control.solicitar(); p.control.solicitar(); assert.equal(p.llamadas.length,1);
    assert.equal(p.estados.at(-1).codigo,'solicitando');
    assert.deepEqual(p.llamadas[0].config,{enableHighAccuracy:false,timeout:10000,maximumAge:0});
    p.llamadas[0].ok(resultado); assert.equal(p.estados.at(-1).codigo,'obtenida');
    assert.equal(p.control.obtener().precisionMetros,25);
    const copia=p.control.obtener(); copia.latitud=0; assert.equal(p.control.obtener().latitud,-33.4);
});
for(const [code,estado] of [[1,'rechazado'],[2,'no-disponible'],[3,'agotado'],[99,'no-disponible']]) {
    test('Error de ubicación '+estado+' permite reintento explícito '+code,async()=>{
        const p=await iniciar(); p.control.solicitar(); p.llamadas[0].error({code});
        assert.equal(p.estados.at(-1).codigo,estado); assert.equal(p.control.obtener(),null);
        assert.equal(p.llamadas.length,1); p.control.solicitar(); assert.equal(p.llamadas.length,2);
        p.llamadas[1].ok(resultado); assert.equal(p.estados.at(-1).codigo,'obtenida');
    });
}
test('Navegador incompatible o contexto inseguro no solicita posición',async()=>{
    const p=await iniciar({geolocalizacion:undefined});p.control.solicitar();assert.equal(p.estados.at(-1).codigo,'incompatible');
    const q=await iniciar({seguro:false});q.control.solicitar();assert.equal(q.estados.at(-1).codigo,'inseguro');assert.equal(q.llamadas.length,0);
});
test('Coordenadas inválidas se rechazan y precisión baja se comunica',async()=>{
    for(const coords of [{latitude:null,longitude:0},{latitude:91,longitude:0},{latitude:0},{latitude:NaN,longitude:0}]) {
        const p=await iniciar();p.control.solicitar();p.llamadas[0].ok({coords});assert.equal(p.control.obtener(),null);assert.equal(p.estados.at(-1).codigo,'no-disponible');
    }
    const p=await iniciar();p.control.solicitar();p.llamadas[0].ok({coords:{latitude:0,longitude:0,accuracy:2000}});assert.match(p.estados.at(-1).mensaje,/baja/);
});
test('Dejar ubicación borra memoria e ignora callbacks tardíos incluso tras reintento',async()=>{
    const p=await iniciar();p.control.solicitar();p.control.dejar();p.llamadas[0].ok(resultado);assert.equal(p.control.obtener(),null);
    p.control.solicitar();p.llamadas[0].error({code:1});assert.equal(p.estados.at(-1).codigo,'solicitando');
    p.llamadas[1].ok(resultado);p.control.dejar();assert.equal(p.control.obtener(),null);assert.equal(p.estados.at(-1).codigo,'no-solicitada');
});
test('Montaje accesible conserva filtros y búsqueda sin red ni almacenamiento',async()=>{
    const {montarUbicacion}=await modulo;
    const nodos=Object.fromEntries(['#usarUbicacion','#dejarUbicacion','#estadoUbicacion'].map(k=>[k,{dataset:{},setAttribute(){}}]));
    const consultas=[];let aceptar;
    const doc={querySelector:s=>{consultas.push(s);assert(nodos[s]);return nodos[s];}};
    const control=montarUbicacion(doc,{geolocation:{getCurrentPosition:ok=>{aceptar=ok;}}},true);
    assert.equal(aceptar,undefined);nodos['#usarUbicacion'].onclick();assert.equal(nodos['#usarUbicacion'].disabled,true);
    aceptar(resultado);assert.equal(nodos['#dejarUbicacion'].hidden,false);nodos['#dejarUbicacion'].onclick();assert.equal(control.obtener(),null);
    assert.equal(nodos['#dejarUbicacion'].hidden,true);
    const fuente=fs.readFileSync(path.join(__dirname,'../../frontend/front-office/ubicacion.mjs'),'utf8');
    assert.doesNotMatch(fuente,/fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|\.cookie|console\.|watchPosition|location\.(?:href|search)/);
});
