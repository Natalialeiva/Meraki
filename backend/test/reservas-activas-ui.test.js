const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const MerakiAgenda=require('../../frontend/back-office/agenda');
const MerakiPagos=require('../../frontend/back-office/pagos');
const {calcularReservasPorCerrar}=require('../../frontend/back-office/resumen');
const codigo=fs.readFileSync(require.resolve('../../frontend/back-office/back'),'utf8');
const pausa=()=>new Promise(resolve=>setImmediate(resolve));

function elemento(tag){
    return {
        tag,hidden:false,value:'',textContent:'',children:[],dataset:{},
        get options(){return this.children;},
        append(...hijos){
            this.children.push(...hijos);
            if(hijos[0]?.tag==='option'&&!this.value)this.value=String(hijos[0].value);
        },
        replaceChildren(){this.children=[];},
        setAttribute(){},
        addEventListener(){},
        scrollIntoView(){},
        querySelectorAll(selector){
            return this.children.flatMap(hijo=>[
                ...(hijo.tag===selector?[hijo]:[]),...hijo.querySelectorAll(selector)
            ]);
        },
        querySelector(){return this.campo;}
    };
}

const respuesta=(datos,status=200)=>({status,ok:status>=200&&status<300,text:async()=>JSON.stringify(datos)});
const reserva=(id,puede_cerrar=true)=>({
    id_reserva:id,estado:'confirmada',fecha_hora_inicio:'2026-11-09T11:00:00',
    fecha_hora_fin:'2026-11-09T12:00:00',precio_servicio:10000,monto_abono:5000,puede_cerrar
});

async function montar(){
    const nodos=new Map(), solicitudes=[], pendientes=[];
    const $=id=>{
        if(!nodos.has(id))nodos.set(id,elemento());
        return nodos.get(id);
    };
    $('#panel').hidden=true;
    const modulo={montar:()=>({cargar:async()=>{},actualizarPermisos(){}})};
    const contexto=vm.createContext({
        document:{querySelector:$,createElement:elemento},
        fetch(url,{method}){
            solicitudes.push({url,method});
            if(url.startsWith('/api/reservas?'))return new Promise((resolve,reject)=>{
                pendientes.push({url,completar:(datos,status)=>resolve(respuesta(datos,status)),reject});
            });
            if(url==='/api/auth/yo')return respuesta({});
            if(url==='/api/mis-emprendimientos')return respuesta([
                {id_emprendimiento:1,nombre:'A'},{id_emprendimiento:2,nombre:'B'}
            ]);
            if(url==='/api/notificaciones')return respuesta([]);
            if(url==='/api/reservas/1/atender'&&method==='PATCH')return respuesta({mensaje:'Atendida'});
            if(url==='/api/abonos/9/estado'&&method==='GET')return respuesta({
                id_reserva:1,estado_local:'pendiente',estado_transbank:'AUTHORIZED',datos_coinciden:true,puede_recuperar:true
            });
            if(url==='/api/abonos/9/recuperar'&&method==='POST')return respuesta({mensaje:'Resultado simulado'});
            throw Error('Solicitud inesperada: '+url);
        },
        MerakiNavegacion:{montar:()=>({iniciar(){}})},
        MerakiAgenda,MerakiPagos,
        MerakiResumen:{calcularReservasPorCerrar,calcularResumenOperativo(){throw Error('A4.1b no debe ejecutarse');}},
        MerakiPerfil:modulo,MerakiServicios:modulo,MerakiTrabajadoras:modulo,MerakiHorarios:modulo,MerakiSuscripcion:modulo,
        FormData:class {constructor(form){this.form=form;}get(){return this.form.campo.value;}},
        setInterval(){},confirm:()=>true
    });
    vm.runInContext(codigo,contexto);
    await pausa();
    assert.equal(pendientes.length,1);
    return {
        $,solicitudes,pendientes,
        valor:()=>$('#reservasPorCerrar').textContent,
        cambiar(id){$('#negocio').value=String(id);$('#negocio').onchange();},
        cargar:()=>$('#cargar').onclick(),
        async completar(i,datos,status){pendientes[i].completar(datos,status);await pausa();}
    };
}

test('carga inicial, cero autorizado y filtros sin peticiones adicionales',async()=>{
    const h=await montar();
    assert.equal(h.valor(),'Cargando…');
    await h.completar(0,[]);
    assert.equal(h.valor(),'0');
    const carga=h.cargar();
    await h.completar(1,[reserva(1),reserva(2),reserva(3,'true')]);
    await carga;
    assert.equal(h.valor(),'2');
    h.$('#filtroEstado').value='cancelada';
    h.$('#filtroEstado').onchange();
    assert.equal(h.valor(),'2');
    assert.equal(h.$('#resumenReservas').textContent,'0 de 3 reservas');
    assert.equal(h.pendientes.length,2);
});

for(const fallo of ['red',401,403,'cuerpo inválido']){
    test('solicitud vigente fallida limpia la agenda: '+fallo,async()=>{
        const h=await montar();
        await h.completar(0,[reserva(1)]);
        h.cargar();
        assert.equal(h.valor(),'Cargando…');
        assert.equal(h.$('#reservas').children.length,0);
        if(fallo==='red'){h.pendientes[1].reject(Error('Sin red'));await pausa();}
        else await h.completar(1,{mensaje:'Error simulado'},typeof fallo==='number'?fallo:200);
        assert.equal(h.valor(),'No disponible');
        assert.equal(h.$('#panel').hidden,fallo===401);
        assert.equal(h.$('#reservas').children.length,0);
    });
}

test('A → B → A descarta éxito antiguo y 401 tardío sin cerrar el panel',async()=>{
    const h=await montar();
    h.cambiar(2);
    h.cambiar(1);
    assert.deepEqual(h.pendientes.map(x=>x.url.split('=').pop()),['1','2','1']);
    await h.completar(2,[reserva(1)]);
    await h.completar(1,{mensaje:'Sesión antigua'},401);
    await h.completar(0,[reserva(2),reserva(3)]);
    assert.equal(h.valor(),'1');
    assert.equal(h.$('#panel').hidden,false);
});

test('dos recargas del mismo negocio conservan solo el resultado vigente',async()=>{
    const h=await montar();
    await h.completar(0,[]);
    h.cargar();
    h.cargar();
    await h.completar(2,[reserva(1)]);
    h.pendientes[1].reject(Error('Fallo obsoleto'));
    await pausa();
    assert.equal(h.valor(),'1');
    assert.notEqual(h.$('#estado').textContent,'Fallo obsoleto');
});

test('cambio de negocio elimina inmediatamente la lista anterior',async()=>{
    const h=await montar();
    await h.completar(0,[reserva(1)]);
    h.cambiar(2);
    assert.equal(h.valor(),'Cargando…');
    assert.equal(h.$('#reservas').children.length,0);
    await h.completar(1,[]);
    assert.equal(h.valor(),'0');
});

test('marcar atendida recarga agenda y actualiza el indicador una vez',async()=>{
    const h=await montar();
    await h.completar(0,[reserva(1)]);
    const boton=h.$('#reservas').querySelectorAll('button').find(b=>b.textContent==='Marcar atendida');
    const accion=boton.onclick();
    await pausa();
    assert.equal(h.valor(),'Cargando…');
    await h.completar(1,[{...reserva(1,false),estado:'atendida'}]);
    await accion;
    assert.equal(h.valor(),'0');
    assert.equal(h.pendientes.length,2);
    assert.equal(h.solicitudes.filter(x=>x.method==='PATCH').length,1);
});

test('recuperación de abono simulada conserva la recarga existente',async()=>{
    const h=await montar();
    await h.completar(0,[reserva(1,false)]);
    const form=h.$('#pago');
    form.campo=elemento('input');
    form.campo.value='9';
    const enviar=value=>form.onsubmit({preventDefault(){},target:form,submitter:{value}});
    await enviar('estado');
    assert.equal(h.$('#recuperarPago').disabled,false);
    const recuperar=enviar('recuperar');
    await pausa();
    assert.equal(h.valor(),'Cargando…');
    await h.completar(1,[reserva(1)]);
    await recuperar;
    assert.equal(h.valor(),'1');
    assert.deepEqual(h.solicitudes.filter(x=>x.url.startsWith('/api/abonos/')),[
        {url:'/api/abonos/9/estado',method:'GET'},
        {url:'/api/abonos/9/recuperar',method:'POST'}
    ]);
    assert.equal(h.pendientes.length,2);
});
