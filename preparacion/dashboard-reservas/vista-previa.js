(function(raiz){
    'use strict';
    const modulo = typeof module !== 'undefined' && module.exports ? require('./presentacion.js') : raiz.MerakiPresentacionReservas;
    const escenarios = Object.freeze([
        ['cargando','Cargando agenda'],['agenda_vacia','Agenda sin reservas'],
        ['filtros_sin_coincidencias','Filtros sin coincidencias'],['error_carga','Error de carga'],
        ['sesion_vencida','Sesión vencida'],['actualizada','Actualización exitosa'],
        ['error_actualizacion','Actualización fallida'],['cambio_emprendimiento','Cambio de emprendimiento']
    ].map(([id,nombre])=>Object.freeze({id,nombre})));
    const nombres = Object.freeze({1:'Negocio ficticio A',2:'Negocio ficticio B'});
    function crearEscenario(estado, id = 1) {
        if (!escenarios.some(e=>e.id===estado) || !Object.hasOwn(nombres,id)) throw new TypeError('Escenario ficticio no permitido');
        const panel = modulo.crearPresentador();
        panel.cambiarContexto({sesion:'simulacion-local',idEmprendimiento:Number(id),nombre:nombres[id]});
        const filas = [1,2].map(n=>Object.freeze({id_reserva:n,id_emprendimiento:Number(id),estado:'confirmada',
            fecha_hora_inicio:'2026-11-18T15:00:00',fecha_hora_fin:'2026-11-18T16:00:00',
            titulo:'Atención ficticia '+n,servicio:'Servicio ficticio '+(id===1?'A':'B')}));
        const aceptar = reservas => panel.aceptarRespuesta(panel.iniciarCarga(),{
            reservas,consultaAutorizada:true,respuestaExitosa:true,recibidoEnEpochMs:Date.UTC(2026,10,18,18,4,12)
        });
        switch(estado){
            case 'cargando':panel.iniciarCarga();break;
            case 'agenda_vacia':aceptar([]);break;
            case 'filtros_sin_coincidencias':aceptar(filas);panel.aplicarFiltro([]);break;
            case 'error_carga':panel.registrarError(panel.iniciarCarga());break;
            case 'sesion_vencida':aceptar(filas);panel.registrarError(panel.iniciarCarga(),{sesionVencida:true});break;
            case 'actualizada':aceptar(filas);break;
            case 'error_actualizacion':aceptar(filas);panel.registrarError(panel.iniciarCarga());break;
            case 'cambio_emprendimiento':break;
        }
        return Object.freeze({vista:panel.obtenerEstado(),filas:Object.freeze(estado==='actualizada'?filas:[])});
    }
    function montar(documento) {
        const $ = id=>documento.querySelector('#'+id);
        const etiquetas = {actualizar:'Simular actualización',reintentar:'Simular reintento',
            cambiar_emprendimiento:'Elegir otro negocio ficticio',iniciar_sesion:'Mostrar acceso simulado',
            limpiar_filtros:'Simular limpiar filtros',seleccionar_emprendimiento:'Elegir negocio ficticio'};
        let actual = 'actualizada';
        function mostrar(id, enfocar = false) {
            const {vista,filas} = crearEscenario(id,Number($('negocio').value));actual=id;
            $('titulo').textContent = vista.emprendimiento ? 'Reservas · '+vista.emprendimiento.nombre : 'Reservas no disponibles';
            $('estadoTipo').textContent = escenarios.find(e=>e.id===vista.estado).nombre;
            $('mensaje').textContent = vista.mensaje;
            $('mensaje').setAttribute('data-estado',vista.estado);
            $('mensaje').setAttribute('role',vista.accesibilidad.role);
            $('mensaje').setAttribute('aria-live',vista.accesibilidad.ariaLive);
            $('mensaje').setAttribute('aria-atomic',String(vista.accesibilidad.ariaAtomic));
            $('agenda').setAttribute('aria-busy',String(vista.accesibilidad.ariaBusy));
            $('total').textContent = vista.datos.total === null ? '—' : String(vista.datos.total);
            $('visibles').textContent = vista.datos.visibles === null ? 'Lista no disponible' : vista.datos.visibles+' de '+vista.datos.total+' reservas';
            $('lista').replaceChildren();
            if(filas.length && vista.datos.tratamiento==='mostrar'){
                for(const fila of filas){
                    const a=documento.createElement('article'),h=documento.createElement('h3'),p=documento.createElement('p');
                    h.textContent=fila.titulo;p.textContent=fila.servicio+' · Ejemplo sin datos personales';
                    a.append(h,p);$('lista').append(a);
                }
            }else{
                const p=documento.createElement('p');p.textContent=vista.datos.tratamiento==='mostrar'
                    ? 'Sin tarjetas visibles para esta vista.' : 'Las tarjetas permanecen ocultas en este estado.';
                $('lista').append(p);
            }
            $('ultima').textContent=vista.ultimaActualizacion.texto || 'Sin marca anterior visible';
            $('advertencia').textContent=vista.ultimaActualizacion.advertencia;
            $('acciones').replaceChildren();$('acceso').hidden=true;
            for(const accion of vista.acciones){
                const b=documento.createElement('button');b.type='button';b.textContent=etiquetas[accion.id];b.disabled=!accion.habilitada;
                b.onclick=()=>{
                    if(b.disabled)return;
                    if(accion.id==='cambiar_emprendimiento'||accion.id==='seleccionar_emprendimiento'){$('negocio').focus();return;}
                    if(accion.id==='iniciar_sesion'){$('acceso').hidden=false;$('acceso').focus();return;}
                    // Solo cambia el escenario ficticio. No hay transporte ni acciones reales.
                    mostrar('actualizada');$('titulo').focus();
                };
                $('acciones').append(b);
            }
            for(const b of $('escenarios').children)b.setAttribute('aria-pressed',String(b.dataset.escenario===id));
            if(enfocar && vista.foco.accion==='solicitar'){
                if(vista.foco.destino==='selector_emprendimiento')$('negocio').focus();
                if(vista.foco.destino==='acceso'){$('acceso').hidden=false;$('acceso').focus();}
            }
            return vista;
        }
        for(const e of escenarios){
            const b=documento.createElement('button');b.type='button';b.textContent=e.nombre;b.dataset.escenario=e.id;
            b.setAttribute('aria-controls','mensaje agenda');b.onclick=()=>mostrar(e.id,true);$('escenarios').append(b);
        }
        $('negocio').onchange=()=>mostrar('cambio_emprendimiento');
        mostrar(actual);
        return Object.freeze({mostrar});
    }
    const api=Object.freeze({escenarios,crearEscenario,montar});
    if(typeof module!=='undefined' && module.exports)module.exports=api;
    else {raiz.MerakiVistaPreviaReservas=api;montar(raiz.document);}
})(typeof globalThis!=='undefined'?globalThis:this);
