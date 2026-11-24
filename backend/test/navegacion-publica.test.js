const {test}=require('node:test');
const assert=require('node:assert/strict');
const {montar}=require('../../frontend/front-office/navegacion-publica');

function pantalla(reducir=false){
    const destinos=Object.fromEntries(['#buscar','#resultados'].map(id=>[id,{scrollIntoView(opciones){this.scroll=opciones;},focus(opciones){this.foco=opciones;}}]));
    const campo={focus(opciones){this.foco=opciones;}};
    const enlaces=Object.keys(destinos).map(href=>({getAttribute:()=>href,addEventListener(nombre,fn){this.click=fn;}}));
    const ventana={location:{hash:''},matchMedia:()=>({matches:reducir})};
    montar({querySelectorAll:()=>enlaces,querySelector:id=>destinos[id],getElementById:()=>campo},ventana);
    return{enlaces,destinos,campo,ventana};
}
test('Buscar centra la barra y deja el campo listo para escribir',()=>{
    const p=pantalla();let cancelado=false;p.enlaces[0].click({button:0,preventDefault(){cancelado=true;}});
    assert(cancelado);assert.equal(p.ventana.location.hash,'#buscar');assert.deepEqual(p.campo.foco,{preventScroll:true});assert.equal(p.destinos['#buscar'].scroll.block,'start');
});
test('Emprendimientos lleva a las tarjetas y respeta movimiento reducido',()=>{
    const p=pantalla(true);p.enlaces[1].click({button:0,preventDefault(){}});
    assert.equal(p.ventana.location.hash,'#resultados');assert.equal(p.destinos['#resultados'].scroll.behavior,'instant');assert(p.destinos['#resultados'].foco);
});
test('Los enlaces conservan abrir en otra pestaña con teclado o clic central',()=>{
    for(const evento of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{button:1}]){
        const p=pantalla();p.enlaces[0].click({...evento,preventDefault(){assert.fail('Debe conservar la navegación nativa');}});assert.equal(p.ventana.location.hash,'');
    }
});
