const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {crearReferenciasWebpay,urlRetornoVisual}=require('../resultado-webpay');

test('El retorno visual conserva el origen configurado y exige la ruta heredada',()=>{
    assert.equal(urlRetornoVisual('https://meraki.example/api/abonos/retorno'),
        'https://meraki.example/api/abonos/retorno/navegador');
    assert.equal(urlRetornoVisual('http://localhost:3000/api/abonos/retorno'),
        'http://localhost:3000/api/abonos/retorno/navegador');
    for(const url of [undefined,'//otro.example/api/abonos/retorno','http://meraki.example/api/abonos/retorno',
        'https://u:p@meraki.example/api/abonos/retorno','https://meraki.example/api/abonos/retorno#fragmento',
        'https://meraki.example/otra-ruta']){
        assert.equal(urlRetornoVisual(url),null);
    }
});

test('La referencia es autenticada, opaca, de propósito específico y vence',()=>{
    let ahora=1000;
    const r=crearReferenciasWebpay('clave-ficticia',()=>ahora);
    const correlacion=r.correlacion('token-ficticio');
    const ref=r.emitir(23,correlacion,'pendiente');
    assert.notEqual(ref,r.emitir(23,correlacion,'pendiente'));
    assert.equal(r.abrir(ref).enlace,correlacion);
    assert.equal(r.abrir((ref[0]==='A'?'B':'A')+ref.slice(1)),null);
    assert.equal(crearReferenciasWebpay('otra-clave',()=>ahora).abrir(ref),null);
    ahora+=10*60*1000;
    assert.equal(r.abrir(ref),null);
});

async function pantalla({datos,contextos=[],fallo=false,referencia='X'.repeat(80)}){
    const elementos=Object.fromEntries(['volver','ayuda','titulo','mensaje'].map(id=>['#'+id,{
        hidden:true,removeAttribute(nombre){delete this[nombre];}
    }]));
    const datosLocales=new Map(contextos);
    const peticiones=[];
    const script=fs.readFileSync(require.resolve('../../frontend/consulta/resultado.js'),'utf8');
    await vm.runInNewContext(script,{
        location:{hash:'#'+referencia},
        document:{querySelector:s=>elementos[s]},
        sessionStorage:{getItem:k=>datosLocales.get(k)??null,removeItem:k=>datosLocales.delete(k)},
        fetch:async(url,opciones)=>{
            peticiones.push({url,opciones});
            if(fallo)throw Error('Sin conexión');
            return {ok:!!datos,json:async()=>datos};
        }
    });
    return {elementos,datosLocales,peticiones};
}

test('Dos pestañas muestran regreso solo si coincide su correlación',async()=>{
    const token1='11111111-1111-4111-8111-111111111111';
    const token2='22222222-2222-4222-8222-222222222222';
    const correlacion='a'.repeat(43),otra='b'.repeat(43);
    const contexto=(c,t)=>['meraki:webpay:'+c,JSON.stringify({enlace:'/consulta/#'+t,vence:Date.now()+10000})];
    const datos={estado:'aprobado',correlacion};
    const primera=await pantalla({datos,contextos:[contexto(correlacion,token1)]});
    const segunda=await pantalla({datos,contextos:[contexto(otra,token2)]});
    const sinContexto=await pantalla({datos});
    assert.equal(primera.elementos['#volver'].href,'/consulta/#'+token1);
    assert.equal(primera.elementos['#volver'].hidden,false);
    assert.equal(segunda.elementos['#volver'].hidden,true);
    assert.equal(sinContexto.elementos['#volver'].hidden,true);
    assert.equal(primera.peticiones.length,1);
    assert.equal(primera.peticiones[0].url,'/api/abonos/resultado');
    assert.equal(primera.peticiones[0].opciones.headers['X-Meraki-Resultado'],'X'.repeat(80));
    primera.elementos['#volver'].onclick();
    assert.equal(primera.datosLocales.size,0);
});

test('Error de lectura, referencia inválida o contexto vencido dejan el regreso oculto',async()=>{
    const correlacion='a'.repeat(43);
    const datos={estado:'aprobado',correlacion};
    for(const opciones of [{fallo:true},{referencia:'inválida'},{}, {
        datos,contextos:[['meraki:webpay:'+correlacion,JSON.stringify({enlace:'/consulta/#11111111-1111-4111-8111-111111111111',vence:0})]]
    }]){
        const p=await pantalla(opciones);
        assert.equal(p.elementos['#volver'].hidden,true);
        if(!opciones.datos)assert.match(p.elementos['#titulo'].textContent,/no disponible/i);
    }
});
