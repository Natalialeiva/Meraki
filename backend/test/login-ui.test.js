const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const fuente=fs.readFileSync(require.resolve('../../frontend/back-office/back'),'utf8');
function pantalla(responder=async()=>({}),sinBoton=false){
    const boton={disabled:false},form={querySelector:()=>sinBoton?null:boton,reset(){this.limpiado=true;}};
    const estado={textContent:''},llamadas=[];let iniciadas=0;
    const inicio=fuente.indexOf("$('#login').onsubmit="),fin=fuente.indexOf("\n$('#salir')",inicio);
    assert(inicio>=0&&fin>inicio);
    const c=vm.createContext({$:()=>form,estado,ocultarClave(){},
        api:async(...args)=>{llamadas.push(args);return responder();},iniciar:async()=>{iniciadas++;},
        FormData:class{*[Symbol.iterator](){yield ['correo','login@example.test'];yield ['password','clave-ficticia'];}}
    });
    vm.runInContext('let ingresando=false;\n'+fuente.slice(inicio,fin),c);
    return {boton,form,estado,llamadas,iniciadas:()=>iniciadas,
        enviar:submitter=>form.onsubmit({preventDefault(){},target:form,submitter})};
}
test('Login sin submitter utiliza el botón del formulario sin bloquear el acceso',async()=>{
    const p=pantalla();await p.enviar(null);
    assert.equal(p.llamadas.length,1);assert.equal(p.iniciadas(),1);
    assert.equal(p.form.limpiado,true);assert.equal(p.boton.disabled,false);
    assert.equal(p.estado.textContent,'Sesión iniciada.');
});
test('Login bloquea eventos repetidos mientras espera respuesta',async()=>{
    const resolver=[];const p=pantalla(()=>new Promise(r=>resolver.push(r)));
    const primero=p.enviar(p.boton),segundo=p.enviar(p.boton);
    try{assert.equal(p.llamadas.length,1);assert.equal(p.boton.disabled,true);}
    finally{for(const terminar of resolver)terminar({});await Promise.all([primero,segundo]);}
    assert.equal(p.iniciadas(),1);assert.equal(p.boton.disabled,false);
});
test('Login fallido conserva formulario y permite reintentar sin exponer credenciales',async()=>{
    const p=pantalla(async()=>{throw Error('Correo o contraseña incorrectos');});
    await p.enviar(null);assert.equal(p.form.limpiado,undefined);assert.equal(p.boton.disabled,false);
    assert.equal(p.estado.textContent,'Correo o contraseña incorrectos');
    assert(!p.estado.textContent.includes('clave-ficticia'));assert.equal(p.iniciadas(),0);
});
test('Login conserva el manejo de error aunque no haya un botón asociado al evento',async()=>{
    const p=pantalla(async()=>{throw Error('Sin conexión');},true);
    await p.enviar(null);assert.equal(p.estado.textContent,'Sin conexión');
});
