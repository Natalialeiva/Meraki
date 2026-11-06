const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const modulo=import('../../frontend/front-office/mapa-datos.mjs');
const negocio={nombre:'Negocio ficticio',latitud:'-33.4489000',longitud:'-70.6693000'};
class Nodo {
    constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attributes={};}
    setAttribute(k,v){this.attributes[k]=v;}
    append(...hijos){this.children.push(...hijos);}
}
const documento={createElement:tag=>new Nodo(tag)};
test('Indicaciones exige confirmación separada explícita; no acepta indicadores inventados de API',async()=>{
    const {crearEnlaceIndicaciones}=await modulo;
    for(const prueba of [undefined,false,null,1,'true',{}])assert.equal(crearEnlaceIndicaciones(negocio,prueba),null);
    assert.equal(crearEnlaceIndicaciones({...negocio,ubicacion_confirmada:true,confirmada:true,direccion:'Calle ficticia 123'}),null);
});
test('Indicaciones normaliza decimales, ceros y negativos para destino confirmado ficticio',async()=>{
    const {crearEnlaceIndicaciones}=await modulo;
    for(const par of [negocio,{latitud:0,longitud:0},{latitud:'0.0000000',longitud:'-180.0000000'},{latitud:-90,longitud:180}]){
        const u=new URL(crearEnlaceIndicaciones(par,true));
        assert.equal(u.protocol,'https:');assert.equal(u.hostname,'www.google.com');assert.equal(u.pathname,'/maps/dir/');
        assert.equal(u.searchParams.get('api'),'1');assert.equal(u.searchParams.get('destination'),Number(par.latitud)+','+Number(par.longitud));
        assert(u.href.includes('%2C'));
    }
});
test('Indicaciones rechaza ausencias, pares incompletos, rangos inválidos y direcciones libres',async()=>{
    const {crearEnlaceIndicaciones}=await modulo;
    for(const par of [null,{}, {direccion:'Calle 123',comuna:'Santiago'}, {latitud:0}, {latitud:91,longitud:0}, {latitud:0,longitud:-181}, {latitud:NaN,longitud:0}, {latitud:Infinity,longitud:0}, {latitud:null,longitud:0}, {latitud:'',longitud:0}])assert.equal(crearEnlaceIndicaciones(par,true),null);
});
test('URL solo contiene api y destino público; nunca origen, token o campos privados',async()=>{
    const {crearEnlaceIndicaciones}=await modulo;
    const u=new URL(crearEnlaceIndicaciones({...negocio,nombre:'<script>',token:'PRIVADO',origin:'80,80',ubicacionClienta:{latitud:80,longitud:80},url:'javascript:alert(1)'},true));
    assert.deepEqual([...u.searchParams.keys()],['api','destination']);assert.equal(u.hash,'');assert.equal(u.username,'');assert.equal(u.password,'');
    assert(!u.href.includes('PRIVADO'));assert(!u.href.includes('80'));
});
test('Sin confirmación no hay enlace enfocable, href ni destino de navegación',async()=>{
    const {crearVistaIndicaciones}=await modulo;const vista=crearVistaIndicaciones(documento,negocio);
    assert.equal(vista.children.length,1);assert.equal(vista.children[0].tag,'p');assert.equal(vista.children[0].textContent,'Ubicación exacta no disponible');
});
test('Enlace preparado es HTML nativo para Tab/Enter, con etiqueta y aviso de salida',async()=>{
    const {crearVistaIndicaciones}=await modulo;const vista=crearVistaIndicaciones(documento,negocio,true);const a=vista.children[0];
    assert.equal(a.tag,'a');assert.equal(a.textContent,'Cómo llegar');assert.equal(a.attributes['aria-label'],'Cómo llegar a Negocio ficticio');
    assert.equal(a.target,'_blank');assert.equal(a.rel,'noopener noreferrer');assert.equal(a.referrerPolicy,'no-referrer');
    assert.match(vista.children[1].textContent,/fuera de Meraki/);assert.match(a.attributes['aria-description'],/Google Maps/);
    assert.equal(a.attributes.tabindex,undefined);assert.equal(a.onclick,undefined);
});
test('Módulo de indicaciones no solicita red, SDK, geolocalización o almacenamiento',()=>{
    const fuente=fs.readFileSync(path.join(__dirname,'../../frontend/front-office/mapa-datos.mjs'),'utf8');
    assert.doesNotMatch(fuente,/fetch\s*\(|XMLHttpRequest|navigator|localStorage|sessionStorage|\.cookie|console\.|window\.open|location\.(?:href|assign)|createElement\(['"]script/);
});
