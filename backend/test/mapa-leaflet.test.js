const {test}=require('node:test'),assert=require('node:assert/strict');
const modulo=import('../../frontend/front-office/mapa-leaflet.mjs');
function entorno(){
 const layers=[],marks=[];
 const node=()=>({attributes:{},setAttribute(k,v){this.attributes[k]=v;},replaceChildren(...x){this.children=x;}});
 const host=node(),mapa={setView(...x){this.vista=x;return this},fitBounds(x){this.bounds=x},invalidateSize(){}};
 const L={DomEvent:{on(n,k,f){n.eventos[k]=f;},off(n,k,f){if(n.eventos[k]===f)delete n.eventos[k];},stop(e){e.detenido=true;}},map:()=>mapa,
 tileLayer:(url,options)=>{const layer={url,options,eventos:{},on(k,fn){this.eventos[k]=fn;return this},off(){this.eventos={}},remove(){this.eventos.remove?.();this.eliminado=true},addTo(){this.eventos.remove=()=>{this.desconectada=true;};layers.push(this);return this}};return layer},
 marker:(coords,options)=>{const icono={eventos:{}};const m={coords,options,eventos:{},getElement:()=>icono,addTo(){this.eventos.remove=()=>{this.desconectada=true;};marks.push(this);return this},on(k,fn){this.eventos[k]=fn;return this},off(){this.eventos={}},remove(){this.eventos.remove?.();this.eliminado=true}};return m}};
 return {host,L,mapa,layers,marks,documento:{createElement:node},aviso:()=>host.children[1],estado:()=>host.children[1].attributes['data-estado']};
}
const negocio={id:1,nombre:'Ficticio',latitud:-33.4,longitud:-70.6};
async function preparar(datos=[negocio]){const {crearProveedorLeaflet}=await modulo;const e=entorno();e.selecciones=[];e.p=crearProveedorLeaflet({documento:e.documento,contenedor:e.host,L:e.L});e.render=async(d=datos)=>e.p.renderizar(await e.p.preparar(d,id=>e.selecciones.push(id)));await e.render();return e;}
function iniciarTesela(layer,tile={}){layer.eventos.tileloadstart({tile});return tile;}
test('Leaflet conserva atribución, URL oficial, deduplicación y capacidades accesibles',async()=>{
 const e=await preparar([negocio,negocio]);assert.equal(e.marks.length,1);assert.equal(e.layers[0].url,'https://tile.openstreetmap.org/{z}/{x}/{y}.png');assert.match(e.layers[0].options.attribution,/OpenStreetMap/);assert.equal(e.layers[0].options.referrerPolicy,'strict-origin-when-cross-origin');assert.equal(e.marks[0].options.keyboard,true);assert.equal(e.marks[0].options.alt,'Seleccionar Ficticio');
});
test('Click selecciona únicamente el ID público',async()=>{const e=await preparar();e.marks[0].eventos.click();assert.deepEqual(e.selecciones,[1]);});
for(const key of ['Enter',' '])test('Teclado '+JSON.stringify(key)+' activa una vez, sin scroll ni repetición',async()=>{
 const e=await preparar(),icono=e.marks[0].getElement();const evento={key};icono.eventos.keydown(evento);assert.equal(evento.detenido,true);icono.eventos.keydown({key,repeat:true});e.marks[0].eventos.click({originalEvent:{detail:0}});assert.deepEqual(e.selecciones,[1]);icono.eventos.keyup({key});await Promise.resolve();icono.eventos.keydown({key});assert.deepEqual(e.selecciones,[1,1]);
});
test('Click posterior independiente, incluso de asistencia, no queda bloqueado',async()=>{
 const e=await preparar(),icono=e.marks[0].getElement();icono.eventos.keydown({key:'Enter'});icono.eventos.keyup({key:'Enter'});await Promise.resolve();e.marks[0].eventos.click({originalEvent:{detail:0}});assert.deepEqual(e.selecciones,[1,1]);
});
test('Teclas ajenas no seleccionan; blur permite otra acción de teclado',async()=>{
 const e=await preparar(),icono=e.marks[0].getElement();icono.eventos.keydown({key:'ArrowLeft'});assert.deepEqual(e.selecciones,[]);icono.eventos.keydown({key:'Enter'});icono.eventos.blur();icono.eventos.keydown({key:'Enter'});assert.deepEqual(e.selecciones,[1,1]);
});
test('Filtros retiran marcadores y manejadores; callbacks antiguos no seleccionan',async()=>{
 const e=await preparar(),viejo=e.marks[0],icono=viejo.getElement(),click=viejo.eventos.click,tecla=icono.eventos.keydown;
 await e.render([{...negocio,id:2}]);assert.equal(viejo.eliminado,true);assert.deepEqual(icono.eventos,{});assert.deepEqual(viejo.eventos,{});click();tecla({key:'Enter'});assert.deepEqual(e.selecciones,[]);e.marks[1].eventos.click();assert.deepEqual(e.selecciones,[2]);
 e.p.limpiar();assert.deepEqual(e.marks[1].getElement().eventos,{});assert.equal(e.layers.at(-1).eliminado,true);
});
test('Resultados sin coordenadas no crean marcadores y conservan referencia general',async()=>{
 const e=await preparar([{...negocio,latitud:null}]);assert.equal(e.marks.length,0);assert.deepEqual(e.mapa.vista[0],[-33.4379667,-70.6504]);
});
test('Fin de carga sin evidencia no anuncia cartografía disponible',async()=>{const e=await preparar();e.layers[0].eventos.load();assert.equal(e.estado(),'sin_evidencia');});
test('Una tesela correcta y load acreditan carga satisfactoria',async()=>{const e=await preparar(),l=e.layers[0],t=iniciarTesela(l);l.eventos.tileload({tile:t});l.eventos.load();assert.equal(e.estado(),'disponible');});
test('tileerror y load conservan fallo total; seleccionar servicios sigue siendo posible',async()=>{
 const e=await preparar(),l=e.layers[0],t=iniciarTesela(l);l.eventos.tileerror({tile:t});assert.equal(e.estado(),'error_en_carga');l.eventos.load();assert.equal(e.estado(),'fallo_total');assert.match(e.aviso().textContent,/tarjetas y los servicios/);e.marks[0].eventos.click();assert.deepEqual(e.selecciones,[1]);l.eventos.load();assert.equal(e.estado(),'fallo_total');
});
test('Resultados mixtos indican fallo parcial y no se borran por load',async()=>{
 const e=await preparar(),l=e.layers[0],a=iniciarTesela(l),b=iniciarTesela(l);l.eventos.tileload({tile:a});l.eventos.tileerror({tile:b});l.eventos.load();assert.equal(e.estado(),'fallo_parcial');l.eventos.load();assert.equal(e.estado(),'fallo_parcial');
});
test('Una carga posterior correcta acredita recuperación sin arrastrar errores anteriores',async()=>{
 const e=await preparar(),l=e.layers[0],t=iniciarTesela(l);l.eventos.tileerror({tile:t});l.eventos.load();await e.render();const nuevo=e.layers[1],a=iniciarTesela(nuevo);nuevo.eventos.tileload({tile:a});nuevo.eventos.load();assert.equal(e.estado(),'disponible');assert.equal(l.eliminado,true);assert.deepEqual(l.eventos,{});
});
test('Eventos de capa y teselas antiguas no modifican la vista actual',async()=>{
 const e=await preparar(),l=e.layers[0],t=iniciarTesela(l),viejos={...l.eventos};await e.render([{...negocio,id:2}]);const nuevo=e.layers[1],a=iniciarTesela(nuevo);nuevo.eventos.tileload({tile:a});nuevo.eventos.load();
 viejos.tileerror({tile:t});viejos.load();viejos.tileloadstart({tile:{}});assert.equal(e.estado(),'disponible');
 nuevo.eventos.tileerror({tile:t});assert.equal(e.estado(),'disponible');
});
test('load antiguo dentro de una capa no oculta teselas nuevas pendientes ni fallidas',async()=>{
 const e=await preparar(),l=e.layers[0],t=iniciarTesela(l);l.eventos.tileload({tile:t});l.eventos.load();l.eventos.loading();const a=iniciarTesela(l);l.eventos.load();assert.equal(e.estado(),'cargando');l.eventos.tileerror({tile:a});l.eventos.load();assert.equal(e.estado(),'fallo_parcial');
});
test('Descartar una tesela fallida deja aviso hasta tener evidencia de carga correcta',async()=>{
 const e=await preparar(),l=e.layers[0],a=iniciarTesela(l);l.eventos.tileerror({tile:a});l.eventos.load();l.eventos.tileunload({tile:a});assert.equal(e.estado(),'sin_evidencia');l.eventos.loading();const b=iniciarTesela(l);l.eventos.tileload({tile:b});l.eventos.load();assert.equal(e.estado(),'disponible');
});
test('Limpiar invalida eventos de teselas antes de reabrir',async()=>{const e=await preparar(),l=e.layers[0],f=l.eventos.load;e.p.limpiar();const texto=e.aviso().textContent;f();assert.equal(e.aviso().textContent,texto);assert.equal(e.aviso().hidden,true);});

test('Limpiar respeta los hooks internos de Leaflet antes de retirar manejadores',async()=>{
 const e=await preparar();await e.render([{...negocio,id:2}]);assert.equal(e.layers[0].desconectada,true);assert.equal(e.marks[0].desconectada,true);assert.deepEqual(e.layers[0].eventos,{});e.p.limpiar();assert.equal(e.layers[1].desconectada,true);assert.equal(e.marks[1].desconectada,true);
});
