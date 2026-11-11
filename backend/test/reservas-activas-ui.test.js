const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const MerakiAgenda=require('../../frontend/back-office/agenda');
const MerakiPagos=require('../../frontend/back-office/pagos');
const {calcularReservasPorCerrar}=require('../../frontend/back-office/resumen');
const MerakiPresentacionReservas=require('../../frontend/back-office/presentacion-reservas');
const codigo=fs.readFileSync(require.resolve('../../frontend/back-office/back'),'utf8');
const pausa=()=>new Promise(resolve=>setImmediate(resolve));

function elemento(tag){
    return {
        tag,hidden:false,value:'',children:[],dataset:{},attributes:{},historial:[],
        get textContent(){return this._texto??'';},
        set textContent(valor){this._texto=valor;this.historial.push(valor);},
        get options(){return this.children;},
        append(...hijos){
            this.children.push(...hijos);
            if(hijos[0]?.tag==='option'&&!this.value)this.value=String(hijos[0].value);
        },
        replaceChildren(){this.children=[];},
        setAttribute(k,v){this.attributes[k]=v;},
        focus(){this.enfocado=true;},
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

async function montar(temporal={
    disponible:()=>true,
    calcularResumenOperativo:({reservas})=>{
        const siguiente=reservas.find(r=>r.estado==='confirmada');
        return {proximaAtencion:siguiente
            ? {estado:'disponible',inicioEpochMs:Date.UTC(2027,0,1,2,30),reserva:{servicio:'Servicio '+siguiente.id_reserva,trabajadora:'Profesional'}}
            : {estado:'sin_proximas'}};
    }
}){
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
        MerakiAgenda,MerakiPagos,MerakiPresentacionReservas,
        MerakiResumen:{calcularReservasPorCerrar,calcularResumenOperativo(){throw Error('A4.1b no debe ejecutarse');}},
        MerakiResumenTemporal:temporal,
        MerakiPerfil:modulo,MerakiServicios:modulo,MerakiTrabajadoras:modulo,MerakiHorarios:modulo,MerakiSuscripcion:modulo,
        FormData:class {constructor(form){this.form=form;}get(){return this.form.campo.value;}},
        setInterval(){},confirm:()=>true
    });
    vm.runInContext(codigo,contexto);
    await pausa();
    assert.equal(pendientes.length,1);
    return {
        $,solicitudes,pendientes,
        reloj(ms){vm.runInContext('Date.now=()=>'+Number(ms),contexto);},
        valor:()=>$('#reservasPorCerrar').textContent,
        cambiar(id){$('#negocio').value=String(id);$('#negocio').onchange();},
        cargar:()=>$('#cargar').onclick(),
        async completar(i,datos,status){pendientes[i].completar(datos,status);await pausa();}
    };
}

test('carga inicial, cero autorizado y filtros sin peticiones adicionales',async()=>{
    const h=await montar();
    assert.equal(h.valor(),'Cargando…');
    assert.equal(h.$('#proximaAtencionEstado').textContent,'Buscando próxima atención…');
    await h.completar(0,[]);
    assert.equal(h.valor(),'0');
    assert.equal(h.$('#proximaAtencionEstado').textContent,'No hay próximas reservas confirmadas');
    const carga=h.cargar();
    await h.completar(1,[reserva(1),reserva(2),reserva(3,'true')]);
    await carga;
    assert.equal(h.valor(),'2');
    assert.match(h.$('#proximaAtencionFecha').textContent,/23:30/);
    assert.match(h.$('#proximaAtencionFecha').textContent,/31/);
    assert.equal(h.$('#proximaAtencionDetalle').textContent,'Servicio 1 · Profesional');
    h.$('#filtroEstado').value='cancelada';
    h.$('#filtroEstado').onchange();
    assert.equal(h.valor(),'2');
    assert.equal(h.$('#resumenReservas').textContent,'0 de 3 reservas');
    assert.equal(h.$('#proximaAtencionDetalle').textContent,'Servicio 1 · Profesional');
    assert.equal(h.pendientes.length,2);
});

for(const fallo of ['red',401,403,'cuerpo inválido']){
    test('solicitud vigente fallida limpia la agenda: '+fallo,async()=>{
        const h=await montar();
        await h.completar(0,[reserva(1)]);
        h.cargar();
        assert.equal(h.valor(),'Cargando…');
        assert.equal(h.$('#reservas').children.length,0);
        assert.equal(h.$('#proximaAtencionFecha').textContent,'');
        if(fallo==='red'){h.pendientes[1].reject(Error('Sin red'));await pausa();}
        else await h.completar(1,{mensaje:'Error simulado'},typeof fallo==='number'?fallo:200);
        assert.equal(h.valor(),'No disponible');
        assert.equal(h.$('#panel').hidden,fallo===401);
        assert.equal(h.$('#reservas').children.length,0);
        assert.equal(h.$('#proximaAtencionEstado').textContent,
            fallo===401?'Próxima atención no disponible':'No se pudo cargar la agenda');
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
    assert.equal(h.$('#proximaAtencionDetalle').textContent,'Servicio 1 · Profesional');
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
    assert.equal(h.$('#proximaAtencionDetalle').textContent,'Servicio 1 · Profesional');
});

test('cambio de negocio elimina inmediatamente la lista anterior',async()=>{
    const h=await montar();
    await h.completar(0,[reserva(1)]);
    h.cambiar(2);
    assert.equal(h.valor(),'Cargando…');
    assert.equal(h.$('#reservas').children.length,0);
    assert.equal(h.$('#proximaAtencionDetalle').textContent,'');
    await h.completar(1,[]);
    assert.equal(h.valor(),'0');
});

for(const [nombre,temporal,mensaje] of [
    ['sin Temporal',{disponible:()=>false},'Próxima atención no disponible en este navegador'],
    ['hora indeterminada',{disponible:()=>true,calcularResumenOperativo:()=>({proximaAtencion:{estado:'pendiente_revision'}})},'No se pudo determinar la próxima atención con certeza'],
    ['fallo de cálculo',{disponible:()=>true,calcularResumenOperativo:()=>{throw Error('Fallo simulado');}},'No se pudo calcular la próxima atención']
]){
    test('Próxima atención '+nombre+' conserva el contador y la agenda',async()=>{
        const h=await montar(temporal);
        await h.completar(0,[reserva(1)]);
        assert.equal(h.$('#proximaAtencionEstado').textContent,mensaje);
        assert.equal(h.$('#proximaAtencionFecha').textContent,'');
        assert.equal(h.valor(),'1');
        assert.equal(h.$('#reservas').children.length,1);
        assert.equal(h.pendientes.length,1);
    });
}

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
    assert.equal(h.$('#proximaAtencionEstado').textContent,'No hay próximas reservas confirmadas');
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

test('Módulo publicable es un artefacto exacto de la única fuente editable',()=>{
    const publicado=fs.readFileSync(require.resolve('../../frontend/back-office/presentacion-reservas'),'utf8');
    const fuente=fs.readFileSync(require.resolve('../../preparacion/dashboard-reservas/presentacion'),'utf8');
    assert.match(publicado.split('\n')[0],/^\/\/ GENERADO: no editar/);
    assert.equal(publicado.slice(publicado.indexOf('\n')+1),fuente);
});

test('Servidor estático existente puede servir el módulo clásico antes de back.js',async()=>{
    const express=require('express'),request=require('supertest'),path=require('node:path');
    const app=express();app.use('/back-office',express.static(path.join(__dirname,'../../frontend/back-office')));
    const r=await request(app).get('/back-office/presentacion-reservas.js').expect(200);
    assert.match(r.headers['content-type'],/javascript/);assert(r.text.includes('MerakiPresentacionReservas'));
    const html=(await request(app).get('/back-office/').expect(200)).text;
    assert(html.indexOf('src="presentacion-reservas.js')<html.indexOf('src="back.js'));
    const sinNode=vm.createContext({Intl});vm.runInContext(r.text,sinNode);
    assert.equal(sinNode.MerakiPresentacionReservas.crearPresentador().obtenerEstado().estado,'sin_contexto');
    assert(!html.match(/id="reservasPorCerrar"[^>]*role="status"/));
    assert(!html.match(/id="proximaAtencionEstado"[^>]*role="status"/));
});

test('Carga, vacío autorizado y filtro sin coincidencias se presentan como estados diferentes',async()=>{
    const h=await montar();assert.equal(h.$('#estadoAgenda').dataset.estado,'cargando');
    assert.equal(h.$('#agendaContenido').attributes['aria-busy'],'true');
    assert.equal(h.$('#cargar').disabled,true);
    await h.completar(0,[]);assert.equal(h.$('#estadoAgenda').dataset.estado,'agenda_vacia');
    assert.match(h.$('#estadoAgenda').textContent,/todavía no tiene reservas/);
    const cargar=h.cargar();await h.completar(1,[reserva(1)]);await cargar;
    h.$('#filtroEstado').value='cancelada';h.$('#filtroEstado').onchange();
    assert.equal(h.$('#estadoAgenda').dataset.estado,'filtros_sin_coincidencias');
    assert.equal(h.$('#totalReservas').textContent,1);assert.equal(h.valor(),'1');
    assert.equal(h.pendientes.length,2);assert.equal(h.$('#cargar').disabled,false);
});

test('Los seis indicadores conservan sus reglas y no dependen del filtro visible',async()=>{
    const h=await montar();
    const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    await h.completar(0,[reserva(1),reserva(2,false),{...reserva(3,false),estado:'pendiente_abono'},
        {...reserva(4,false),estado:'cancelada',fecha_hora_inicio:hoy+'T10:00:00'}]);
    const nombres=['#totalReservas','#reservasHoy','#reservasConfirmadas','#reservasPendientes','#reservasPorCerrar','#proximaAtencionFecha'];
    const previos=nombres.map(id=>h.$(id).textContent);
    assert.deepEqual(previos.slice(0,5),[4,1,2,1,'1']);assert.match(previos[5],/23:30/);
    h.$('#filtroEstado').value='atendida';h.$('#filtroEstado').onchange();
    assert.deepEqual(nombres.map(id=>h.$(id).textContent),previos);
});

test('Respuesta válida fija hora de recepción de Santiago; filtrar y fallar no la cambian',async()=>{
    const h=await montar();h.reloj(Date.UTC(2026,10,18,18,4,12));await h.completar(0,[reserva(1)]);
    const marca=h.$('#ultimaActualizacionAgenda').textContent;assert.match(marca,/A.*15:04:12/);assert.match(marca,/Santiago/);
    h.$('#filtroEstado').value='cancelada';h.$('#filtroEstado').onchange();assert.equal(h.$('#ultimaActualizacionAgenda').textContent,marca);
    h.cargar();h.pendientes[1].reject(Error('Fallo privado con secreto'));await pausa();
    assert.equal(h.$('#estadoAgenda').dataset.estado,'error_actualizacion');assert.equal(h.$('#ultimaActualizacionAgenda').textContent,marca);
    assert.match(h.$('#advertenciaActualizacionAgenda').textContent,/falló/);assert.equal(h.$('#totalReservas').textContent,'—');
    assert(!h.$('#estadoAgenda').textContent.includes('secreto'));assert.equal(h.$('#reintentarAgenda').hidden,false);
    h.reloj(Date.UTC(2026,10,18,18,5,12));const reintento=h.$('#reintentarAgenda').onclick();
    await h.completar(2,[]);await reintento;assert.match(h.$('#ultimaActualizacionAgenda').textContent,/15:05:12/);
    assert.equal(h.$('#cargar').enfocado,true);assert.equal(h.$('#advertenciaActualizacionAgenda').textContent,'');
});

test('Error inicial no tiene marca ni ceros; respuesta inválida no registra actualización',async()=>{
    const h=await montar();await h.completar(0,{mensaje:'No es una agenda'});
    assert.equal(h.$('#estadoAgenda').dataset.estado,'error_carga');assert.equal(h.$('#ultimaActualizacionAgenda').textContent,'Sin actualización exitosa en esta sesión.');
    assert.equal(h.$('#totalReservas').textContent,'—');
    const recarga=h.cargar();await h.completar(1,[{...reserva(1),id_emprendimiento:2}]);await recarga;
    assert.equal(h.$('#estadoAgenda').dataset.estado,'error_carga');assert.equal(h.$('#reservas').children.length,0);
});

test('Cambio rápido oculta marca anterior y respuestas antiguas no cambian presentación ni sesión',async()=>{
    const h=await montar();await h.completar(0,[reserva(1)]);h.cambiar(2);
    assert.equal(h.$('#ultimaActualizacionAgenda').textContent,'Sin actualización exitosa en esta sesión.');
    assert.equal(h.$('#reservas').children.length,0);h.cambiar(1);
    assert(h.$('#estadoAgenda').historial.some(texto=>texto.includes('emprendimiento seleccionado')));
    h.reloj(Date.UTC(2026,10,18,18,6,0));await h.completar(2,[]);
    const marca=h.$('#ultimaActualizacionAgenda').textContent,mensaje=h.$('#estadoAgenda').textContent;
    await h.completar(1,{mensaje:'Vencida antigua'},401);
    assert.equal(h.$('#ultimaActualizacionAgenda').textContent,marca);assert.equal(h.$('#estadoAgenda').textContent,mensaje);
    assert.equal(h.$('#panel').hidden,false);
});

test('Selector sin negocio o con ID no autorizado elimina marca y datos, sin consulta nueva',async()=>{
    const h=await montar();await h.completar(0,[reserva(1)]);h.cambiar(999);
    assert.equal(h.$('#ultimaActualizacionAgenda').textContent,'');assert.equal(h.$('#reservas').children.length,0);
    assert.equal(h.pendientes.length,1);assert.equal(h.$('#totalReservas').textContent,'—');
});

test('Filtrado repetido no duplica anuncios; estado de carga utiliza una sola región accesible',async()=>{
    const h=await montar();await h.completar(0,[reserva(1)]);const avisos=h.$('#estadoAgenda').historial.length;
    h.$('#filtroEstado').onchange();h.$('#filtroEstado').onchange();
    assert.equal(h.$('#estadoAgenda').historial.length,avisos);
    const html=fs.readFileSync(require.resolve('../../frontend/back-office/index.html'),'utf8');
    assert.match(html,/id="estadoAgenda"[^>]*role="status"[^>]*aria-live="polite"/);
    assert.match(html,/id="tituloReservas" tabindex="-1"/);
    assert(!html.match(/id="resumenReservas"[^>]*role="status"/));
});

test('Navegación existente mantiene mensajes y marca dentro de la vista Reservas',()=>{
    const {montar:montarNavegacion,resolver}=require('../../frontend/back-office/navegacion');
    const paneles=['reservas','perfil','pagos'].map(id=>({dataset:{vista:id},hidden:false}));
    let enfocado=false;
    const contenedor={querySelectorAll:()=>paneles,querySelector:()=>({focus(){enfocado=true;}})};
    const ventana={location:{hash:''},addEventListener(){},scrollTo(){}};
    const titulo={},descripcion={};
    const nav=montarNavegacion({contenedor,menu:{querySelectorAll:()=>[]},titulo,descripcion,ventana});
    nav.mostrar('pagos');assert.equal(paneles[0].hidden,true);
    nav.mostrar('reservas');assert.equal(paneles[0].hidden,false);assert.equal(paneles[2].hidden,true);
    assert.equal(titulo.textContent,'Reservas');assert.equal(enfocado,true);assert.equal(resolver(ventana.location.hash),'reservas');
    const html=fs.readFileSync(require.resolve('../../frontend/back-office/index.html'),'utf8');
    const reservas=html.split('data-vista="reservas"')[1].split('</section>')[0];
    for(const id of ['estadoAgenda','ultimaActualizacionAgenda','advertenciaActualizacionAgenda','agendaContenido'])assert(reservas.includes('id="'+id+'"'));
});

test('Sesión vencida vigente limpia marcas y enfoca acceso sin aceptar respuestas anteriores',async()=>{
    const h=await montar();await h.completar(0,[reserva(1)]);h.cargar();
    await h.completar(1,{mensaje:'Sesión vencida'},401);
    assert.equal(h.$('#estadoAgenda').dataset.estado,'sesion_vencida');assert.equal(h.$('#ultimaActualizacionAgenda').textContent,'');
    assert.equal(h.$('#advertenciaActualizacionAgenda').textContent,'');assert.equal(h.$('#claveIngreso').enfocado,true);
    assert.equal(h.$('#panel').hidden,true);assert.equal(h.$('#totalReservas').textContent,'—');
});

test('Marca válida no depende de Temporal ni altera el cálculo de Reservas por cerrar',async()=>{
    const h=await montar({disponible:()=>false});await h.completar(0,[reserva(1)]);
    assert.equal(h.$('#estadoAgenda').dataset.estado,'actualizada');assert.match(h.$('#ultimaActualizacionAgenda').textContent,/Santiago/);
    assert.match(h.$('#estadoAgenda').textContent,/no disponible en este navegador/);assert.equal(h.valor(),'1');
    assert(h.solicitudes.every(r=>r.method==='GET'));assert(!h.solicitudes.some(r=>/abonos|oneclick/i.test(r.url)));
});
