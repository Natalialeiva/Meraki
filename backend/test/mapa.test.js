const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const modulo=import('../../frontend/front-office/mapa.mjs');
const negocio={id_emprendimiento:1,nombre:'Demo',comuna:'Santiago',latitud:'-33.4',longitud:'-70.6',privado:'no compartir'};
async function iniciar(preparar) {
    const {crearMapa}=await modulo;const llamadas=[],renders=[],estados=[],selecciones=[],detalles=[];
    const proveedor={limpiar(){},async preparar(datos,elegir){llamadas.push({datos,elegir});return preparar?preparar(datos):datos;},renderizar:datos=>renders.push(datos)};
    const control=crearMapa({proveedor,mostrar:e=>estados.push(e),seleccionar:n=>selecciones.push(n),presentarSeleccion:n=>detalles.push(n)});
    return {control,llamadas,renders,estados,selecciones,detalles};
}
test('Mapa cerrado no prepara proveedor y permite abrir y cerrar explícitamente',async()=>{
    const p=await iniciar();await p.control.actualizar([negocio]);assert.equal(p.llamadas.length,0);assert.equal(p.estados[0].abierto,false);
    await p.control.alternar();assert.equal(p.llamadas.length,1);await p.control.alternar();assert.equal(p.estados.at(-1).abierto,false);
});
test('Mapa entrega solo negocios válidos y campos públicos, admite cero y filtros vacíos',async()=>{
    const p=await iniciar();await p.control.actualizar([negocio,{...negocio,id_emprendimiento:2,latitud:null},{...negocio,id_emprendimiento:3,latitud:91},{...negocio,id_emprendimiento:4,latitud:0,longitud:0}]);await p.control.alternar();
    assert.equal(p.llamadas[0].datos.length,2);assert.deepEqual(Object.keys(p.llamadas[0].datos[0]),['id','nombre','comuna','latitud','longitud']);
    await p.control.actualizar([]);assert.match(p.estados.at(-1).mensaje,/No hay/);
    await p.control.actualizar([negocio]);assert.equal(p.llamadas.length,2);
});
test('Respuesta tardía no reemplaza filtro nuevo ni permite seleccionar un negocio antiguo',async()=>{
    let resolver;let veces=0;const p=await iniciar(()=>++veces===1?new Promise(r=>resolver=r):['actual']);
    await p.control.actualizar([negocio]);const pendiente=p.control.alternar();
    await p.control.actualizar([{...negocio,id_emprendimiento:2}]);resolver(['antiguo']);await pendiente;
    assert.deepEqual(p.renders,[['actual']]);p.llamadas[0].elegir(1);assert.equal(p.selecciones.length,0);
    p.llamadas[1].elegir(2);assert.equal(p.selecciones.length,0);p.control.verServicios();assert.equal(p.selecciones[0].id_emprendimiento,2);
});
test('Cerrar invalida render y selección tardíos',async()=>{
    let resolver;const p=await iniciar(()=>new Promise(r=>resolver=r));await p.control.actualizar([negocio]);const pendiente=p.control.alternar();await p.control.alternar();resolver([]);await pendiente;
    assert.equal(p.renders.length,0);p.llamadas[0].elegir(1);assert.equal(p.selecciones.length,0);
});
test('Error simulado del proveedor permite continuar con tarjetas y reintentar',async()=>{
    let falla=true;const p=await iniciar(()=>{if(falla)throw Error('simulado');return [];});await p.control.actualizar([negocio]);await p.control.alternar();assert.match(p.estados.at(-1).mensaje,/tarjetas/);
    await p.control.alternar();falla=false;await p.control.alternar();assert.equal(p.renders.length,1);
});
test('Mapa no usa red, ubicación personal, almacenamiento ni SDK externo',()=>{
    const fuente=fs.readFileSync(path.join(__dirname,'../../frontend/front-office/mapa.mjs'),'utf8');
    assert.doesNotMatch(fuente,/fetch\s*\(|XMLHttpRequest|navigator|localStorage|sessionStorage|\.cookie|console\.|https?:\/\/|google\.maps/);
});

test('Marcadores deduplica IDs numéricos y textuales y rechaza IDs y coordenadas inválidos',async()=>{
 const {normalizarMarcadores}=await import('../../frontend/front-office/mapa-datos.mjs');
 const normal=normalizarMarcadores([{...negocio,id:1},{...negocio,id:'1',nombre:'Duplicado'}, {...negocio,id:2,latitud:null},{...negocio,id:2},{...negocio,id:0},{...negocio,id:-1},{...negocio,id:'1e2'},{...negocio,id:3,longitud:181},null]);
 assert.equal(normal.length,2);assert.deepEqual(normal.map(n=>n.id),[1,2]);assert.equal(normal[0].nombre,'Demo');assert.equal(normal[0].privado,undefined);
});

test('Seleccionar marcador muestra nombre y comuna; Ver servicios exige selección vigente',async()=>{
 const p=await iniciar();await p.control.actualizar([negocio]);await p.control.alternar();p.control.verServicios();assert.equal(p.selecciones.length,0);
 p.llamadas[0].elegir(1);assert.deepEqual(p.detalles.at(-1),{id:1,nombre:'Demo',comuna:'Santiago',latitud:-33.4,longitud:-70.6});assert.equal(p.selecciones.length,0);
 p.control.verServicios();assert.equal(p.selecciones.length,1);
 await p.control.actualizar([{...negocio,id_emprendimiento:2}]);assert.equal(p.detalles.at(-1),null);p.control.verServicios();assert.equal(p.selecciones.length,1);
 p.llamadas[0].elegir(1);assert.equal(p.detalles.at(-1),null);
});

test('Reordenar o cambiar solo datos privados no prepara nuevamente ni comparte ubicación',async()=>{
 const p=await iniciar();await p.control.actualizar([negocio,{...negocio,id_emprendimiento:2}]);await p.control.alternar();
 await p.control.actualizar([{...negocio,id_emprendimiento:2},{...negocio,privado:'Cambio',ubicacionClienta:{latitud:80,longitud:80}}]);
 assert.equal(p.llamadas.length,1);assert(!JSON.stringify(p.llamadas[0].datos).includes('ubicacionClienta'));
 await p.control.actualizar([{...negocio,id_emprendimiento:2,longitud:-71}]);assert.equal(p.llamadas.length,2);
});

test('Cerrar limpia selección y callbacks de Ver servicios, incluso tras reabrir',async()=>{
 const p=await iniciar();await p.control.actualizar([negocio]);await p.control.alternar();p.llamadas[0].elegir(1);
 await p.control.alternar();p.control.verServicios();assert.equal(p.selecciones.length,0);assert.equal(p.detalles.at(-1),null);
 await p.control.alternar();p.llamadas[0].elegir(1);p.control.verServicios();assert.equal(p.selecciones.length,0);
});

test('Panel simulado selecciona detalle público y solo Ver servicios inicia el flujo existente',async()=>{
 const {montarMapa}=await modulo;
 class Nodo {constructor(){this.children=[];this.attributes={};this.hidden=false;this.disabled=false;this.textContent='';this.listeners={};}focus(){doc.activeElement=this;}contains(el){return el===this||this.children.some(n=>n.contains?.(el));}addEventListener(k,fn){this.listeners[k]=fn;}setAttribute(k,v){this.attributes[k]=v;}replaceChildren(...hijos){this.children=hijos;}append(...hijos){this.children.push(...hijos);}}
 const ids=['verMapa','panelMapa','negociosMapa','estadoMapa','seleccionMapa','nombreMapa','comunaMapa','serviciosMapa','tituloMapa','descripcionMapa','indicacionesMapa'];
 const nodos=Object.fromEntries(ids.map(id=>['#'+id,new Nodo()]));
 const doc={querySelector:id=>{assert(nodos[id],id);return nodos[id];},createElement:tag=>{assert(['button','div','p'].includes(tag));return new Nodo();}};
 nodos['#panelMapa'].append(nodos['#negociosMapa'],nodos['#seleccionMapa']);nodos['#seleccionMapa'].append(nodos['#serviciosMapa']);
 let publicar,selecciones=0;const anterior=globalThis.seleccionar;globalThis.seleccionar=()=>{selecciones++;};
 try {
  montarMapa(doc,receptor=>{publicar=receptor;});await publicar([negocio]);assert.equal(nodos['#panelMapa'].hidden,true);
  await nodos['#verMapa'].onclick();assert.equal(nodos['#negociosMapa'].children.length,1);
  nodos['#negociosMapa'].children[0].onclick();assert.equal(nodos['#nombreMapa'].textContent,'Demo');assert.equal(nodos['#comunaMapa'].textContent,'Santiago');
  assert.equal(nodos['#seleccionMapa'].hidden,false);assert.equal(selecciones,0);
  nodos['#serviciosMapa'].onclick();assert.equal(selecciones,1);
  doc.activeElement=nodos['#serviciosMapa'];
  await publicar([{...negocio,id_emprendimiento:2}]);assert.equal(doc.activeElement,nodos['#verMapa']);assert.equal(nodos['#seleccionMapa'].hidden,true);assert.equal(nodos['#serviciosMapa'].disabled,true);
  nodos['#serviciosMapa'].onclick();assert.equal(selecciones,1);
  await nodos['#verMapa'].onclick();assert.equal(nodos['#panelMapa'].hidden,true);assert.equal(nodos['#negociosMapa'].children.length,0);
  await nodos['#verMapa'].onclick();doc.activeElement=nodos['#negociosMapa'].children[0];let evitado=false;
  nodos['#panelMapa'].listeners.keydown({key:'Escape',preventDefault(){evitado=true;}});
  assert(evitado);assert.equal(nodos['#panelMapa'].hidden,true);assert.equal(doc.activeElement,nodos['#verMapa']);
 } finally {if(anterior===undefined)delete globalThis.seleccionar;else globalThis.seleccionar=anterior;}
});
