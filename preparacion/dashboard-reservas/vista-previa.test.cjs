const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {escenarios,crearEscenario,montar}=require('./vista-previa.js');
const html=fs.readFileSync(path.join(__dirname,'vista-previa.html'),'utf8');
class Elemento{
    constructor(){this.children=[];this.dataset={};this.attributes={};this.textContent='';this.hidden=false;this.disabled=false;this.value='1';}
    append(...elementos){this.children.push(...elementos);}
    replaceChildren(){this.children=[];}
    setAttribute(k,v){this.attributes[k]=v;}
    focus(){this.enfocado=true;}
}
function documento(){const elementos=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Elemento()]));return {elementos,querySelector:id=>elementos[id.slice(1)],createElement:()=>new Elemento()};}
for(const e of escenarios)test('Escenario ficticio reutiliza módulo: '+e.id,()=>{
    const r=crearEscenario(e.id);assert.equal(r.vista.estado,e.id);assert(r.vista.mensaje);
    assert.equal(r.vista.accesibilidad.role,'status');
    if(e.id==='actualizada')assert.equal(r.filas.length,2);else assert.equal(r.filas.length,0);
});
test('Render de los ocho estados, botones, errores frente a cero y foco declarado',()=>{
    const d=documento(),p=montar(d),el=d.elementos;
    assert.equal(el.escenarios.children.length,8);
    for(const boton of el.escenarios.children){
        boton.onclick();const esperado=crearEscenario(boton.dataset.escenario).vista;
        assert.equal(el.mensaje.textContent,esperado.mensaje);
        assert.equal(el.total.textContent,esperado.datos.total===null?'—':String(esperado.datos.total));
        assert.equal(el.agenda.attributes['aria-busy'],String(esperado.accesibilidad.ariaBusy));
        assert.equal(el.mensaje.attributes['aria-live'],'polite');assert.equal(boton.attributes['aria-pressed'],'true');
    }
    p.mostrar('agenda_vacia');assert.equal(el.total.textContent,'0');
    p.mostrar('error_carga');assert.equal(el.total.textContent,'—');
    p.mostrar('sesion_vencida',true);assert.equal(el.acceso.hidden,false);assert.equal(el.acceso.enfocado,true);
});
test('Fallo de actualización conserva marca y advierte sin mostrar reservas anteriores',()=>{
    const d=documento(),p=montar(d);p.mostrar('error_actualizacion');
    assert.match(d.elementos.ultima.textContent,/15:04:12/);assert.match(d.elementos.advertencia.textContent,/falló/);
    assert.equal(d.elementos.total.textContent,'—');assert.equal(d.elementos.lista.children.length,1);
    d.elementos.acciones.children[0].onclick();assert.equal(d.elementos.total.textContent,'2');assert.equal(d.elementos.advertencia.textContent,'');
});
test('Cambiar negocio limpia nombre, marca y filas; siguiente éxito contiene solo negocio seleccionado',()=>{
    const d=documento(),p=montar(d);assert.match(d.elementos.titulo.textContent,/A/);
    d.elementos.negocio.value='2';d.elementos.negocio.onchange();
    assert(!d.elementos.titulo.textContent.includes('ficticio A'));assert(!d.elementos.ultima.textContent.includes('15:04:12'));
    p.mostrar('actualizada');assert.match(d.elementos.titulo.textContent,/ficticio B/);
    assert.match(d.elementos.lista.children[0].children[1].textContent,/Servicio ficticio B/);
});
test('Estados de filtros y sesión tienen acciones solo simuladas',()=>{
    const d=documento(),p=montar(d);p.mostrar('filtros_sin_coincidencias');assert.equal(d.elementos.total.textContent,'2');
    assert.equal(d.elementos.visibles.textContent,'0 de 2 reservas');
    d.elementos.acciones.children[0].onclick();assert.equal(d.elementos.visibles.textContent,'2 de 2 reservas');
    p.mostrar('sesion_vencida');d.elementos.acciones.children[0].onclick();assert.equal(d.elementos.acceso.hidden,false);
    assert(!html.includes('type="password"'));assert(!html.includes('<form'));
});
test('HTML local accesible y CSP bloquea conexiones, fuentes e imágenes externas',()=>{
    assert.match(html,/<html lang="es">/);assert.match(html,/width=device-width,initial-scale=1/);
    assert.match(html,/<legend>/);assert.match(html,/<label for="negocio">/);assert.match(html,/connect-src 'none'/);
    for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g))assert(!/^(?:https?:|\/\/)/.test(m[1]));
    const css=fs.readFileSync(path.join(__dirname,'vista-previa.css'),'utf8');
    assert(css.includes(':focus-visible'));assert(css.includes('@media(max-width:480px)'));
});
test('Pares principales de texto superan contraste 4.5:1 y foco supera 3:1',()=>{
    const luz=hex=>{const rgb=hex.match(/\w\w/g).map(c=>parseInt(c,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
    const contraste=(a,b)=>{const x=luz(a),y=luz(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    const css=fs.readFileSync(path.join(__dirname,'vista-previa.css'),'utf8').replace(/#([0-9a-f])([0-9a-f])([0-9a-f])\b/gi,(_,r,g,b)=>'#'+r+r+g+g+b+b);
    for(const [t,f] of [['392f3b','ffffff'],['65576b','f7f5f8'],['ffffff','775269'],['503957','faf7fc'],['693c37','fff4f3']]){
        assert(css.includes('#'+t),t);assert(css.includes('#'+f),f);assert(contraste(t,f)>=4.5,t+'/'+f);
    }
    assert(contraste('775269','ffffff')>=3);
});
test('Recorre vista y acciones con red, almacenamiento y temporizadores prohibidos',()=>{
    const d=documento();let llamadas=0;const prohibido=()=>{llamadas++;throw Error('Operación externa prohibida');};
    const c=vm.createContext({document:d,Intl,Date,fetch:prohibido,XMLHttpRequest:prohibido,WebSocket:prohibido,setTimeout:prohibido});
    for(const k of ['localStorage','sessionStorage'])Object.defineProperty(c,k,{get:prohibido});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'presentacion.js'),'utf8'),c);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'vista-previa.js'),'utf8'),c);
    for(const e of escenarios){const p=c.MerakiVistaPreviaReservas.montar(documento());p.mostrar(e.id);}
    for(const boton of d.elementos.escenarios.children)boton.onclick();
    for(const boton of d.elementos.acciones.children)if(!boton.disabled)boton.onclick();
    assert.equal(llamadas,0);
});
