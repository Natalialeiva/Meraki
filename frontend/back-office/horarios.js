(function(raiz){
    function montar({contenedor,selectorNegocio,api,documento=document,confirmar=confirm,puedeConfigurar=()=>true}){
        const $=s=>contenedor.querySelector(s);
        const trabajador=$('#trabajadoraHorario'),actualizar=$('#actualizarHorarios'),estado=$('#estadoHorarios');
        const form=$('#horarioGestion'),bloqueo=$('#bloqueoGestion'),lista=$('#listaHorarios'),bloqueos=$('#listaBloqueos');
        const titulo=$('#tituloEdicionHorario'),grupo=form.querySelector('fieldset'),grupoBloqueo=bloqueo.querySelector('fieldset');
        const campo=k=>form.elements.namedItem(k),campoBloqueo=k=>bloqueo.elements.namedItem(k);
        const dias={lunes:'Lunes',martes:'Martes',miercoles:'Miércoles',jueves:'Jueves',viernes:'Viernes',sabado:'Sábado',domingo:'Domingo'};
        let negocio=null,personas=[],horarios=[],excepciones=[],edicion=null,version=0,ocupado=false,listo=false;
        const seleccionada=()=>personas.find(t=>String(t.id_trabajadora)===trabajador.value);
        function limpiar(){edicion=null;form.reset();titulo.textContent='Nuevo horario semanal';}
        function controles(){
            const activa=Boolean(seleccionada()?.activa);
            grupo.disabled=ocupado||!listo||!activa||!puedeConfigurar();grupoBloqueo.disabled=ocupado||!listo||!activa||!puedeConfigurar();
            trabajador.disabled=ocupado||!listo||!personas.length;selectorNegocio.disabled=ocupado;actualizar.disabled=ocupado||!negocio;
            for(const b of [...lista.querySelectorAll('button'),...bloqueos.querySelectorAll('button')])b.disabled=ocupado||!puedeConfigurar();
        }
        function boton(texto,accion){const b=documento.createElement('button');b.type='button';b.textContent=texto;b.onclick=accion;return b;}
        function render(){
            limpiar();bloqueo.reset();lista.replaceChildren();bloqueos.replaceChildren();const t=seleccionada();
            if(!t){estado.textContent='No hay trabajadoras disponibles en este emprendimiento.';controles();return;}
            const propios=horarios.filter(h=>h.id_trabajadora===t.id_trabajadora);
            if(!propios.length)lista.textContent='Sin horarios semanales registrados.';
            for(const h of propios){
                const p=documento.createElement('p');p.textContent=`${dias[h.dia_semana]||h.dia_semana} · ${h.hora_inicio} a ${h.hora_fin} · ${h.activo?'Activo':'Desactivado'}`;
                if(h.activo){
                    if(t.activa)p.append(boton('Editar horario',()=>{
                        if(ocupado)return;edicion=h.id_horario;campo('dia_semana').value=h.dia_semana;campo('hora_inicio').value=h.hora_inicio;campo('hora_fin').value=h.hora_fin;
                        titulo.textContent='Editar horario semanal';campo('hora_inicio').focus();
                    }));
                    p.append(boton('Desactivar horario',()=>desactivar(h)));
                }
                lista.append(p);
            }
            const periodos=excepciones.filter(b=>b.id_trabajadora===t.id_trabajadora);
            if(!periodos.length)bloqueos.textContent='Sin bloqueos registrados.';
            for(const b of periodos){
                const p=documento.createElement('p');p.textContent=b.fecha_inicio.replace('T',' ')+' a '+b.fecha_fin.replace('T',' ')+(b.motivo?' · '+b.motivo:'');
                p.append(boton('Retirar bloqueo',()=>retirar(b)));bloqueos.append(p);
            }
            estado.textContent=t.activa?'Horarios y fechas expresados en hora local de Chile.':'Trabajadora desactivada: solo puedes consultar, desactivar horarios o retirar bloqueos.';controles();
        }
        async function cargar(id){
            const solicitud=++version,anterior=negocio===Number(id)?trabajador.value:'';
            negocio=id?Number(id):null;listo=false;personas=[];horarios=[];excepciones=[];trabajador.replaceChildren();lista.replaceChildren();bloqueos.replaceChildren();limpiar();bloqueo.reset();controles();
            if(!negocio){estado.textContent='Selecciona un emprendimiento para configurar su atención.';return false;}
            estado.textContent='Cargando horarios y bloqueos…';
            try{
                const [t,h,b]=await Promise.all([api('/api/mis-trabajadoras'),api('/api/mis-horarios'),api('/api/mis-bloqueos')]);
                // Una respuesta anterior nunca debe sustituir los datos del negocio actual.
                if(solicitud!==version)return false;
                personas=t.filter(x=>x.id_emprendimiento===negocio);horarios=h.filter(x=>x.id_emprendimiento===negocio);excepciones=b.filter(x=>x.id_emprendimiento===negocio);
                for(const p of personas){const o=documento.createElement('option');o.value=p.id_trabajadora;o.textContent=[p.nombre,p.apellido].filter(Boolean).join(' ')+(p.activa?'':' · Desactivada');trabajador.append(o);}
                trabajador.value=personas.some(p=>String(p.id_trabajadora)===anterior)?anterior:String((personas.find(p=>p.activa)||personas[0])?.id_trabajadora||'');
                listo=true;render();return true;
            }catch(error){if(solicitud===version)estado.textContent=error.message;return false;}
            finally{if(solicitud===version)controles();}
        }
        async function ejecutar(url,metodo,datos,mensaje){
            ocupado=true;controles();estado.textContent='Guardando cambios…';
            try{await api(url,metodo,datos);const recargado=await cargar(negocio);estado.textContent=mensaje+(recargado?'':' No se pudo actualizar la vista; pulsa Actualizar horarios antes de repetir la operación.');}
            catch(error){estado.textContent=error.message;}
            finally{ocupado=false;controles();}
        }
        async function desactivar(h){
            if(ocupado||!puedeConfigurar()||!confirmar('¿Desactivar este horario semanal? Dejará de ofrecer nuevas horas en ese tramo. Las reservas existentes se conservan y debes gestionarlas en la agenda.'))return;
            await ejecutar('/api/horarios/'+h.id_horario+'/desactivar','PATCH',undefined,'Horario desactivado correctamente.');
        }
        async function retirar(b){
            if(ocupado||!puedeConfigurar()||!confirmar('¿Retirar este bloqueo? El período volverá a ofrecerse si tiene horario y no hay una reserva que lo ocupe.'))return;
            await ejecutar('/api/bloqueos/'+b.id_bloqueo,'DELETE',undefined,'Bloqueo retirado correctamente.');
        }
        form.onsubmit=async evento=>{
            evento.preventDefault();const t=seleccionada();if(ocupado||!puedeConfigurar()||!listo||!t?.activa||!form.reportValidity())return;
            const datos={dia_semana:campo('dia_semana').value,hora_inicio:campo('hora_inicio').value,hora_fin:campo('hora_fin').value};
            // Se comparan horas normalizadas sin convertirlas a la zona horaria del navegador.
            const normalizar=v=>v.length===5?v+':00':v;
            if(!dias[datos.dia_semana]||!datos.hora_inicio||normalizar(datos.hora_fin)<=normalizar(datos.hora_inicio)){estado.textContent='La hora de término debe ser posterior al inicio, dentro del mismo día.';return;}
            if(edicion)await ejecutar('/api/horarios/'+edicion,'PATCH',datos,'Horario actualizado correctamente. Las reservas existentes se conservan.');
            else await ejecutar('/api/horarios','POST',{...datos,id_trabajadora:t.id_trabajadora},'Horario registrado correctamente.');
        };
        bloqueo.onsubmit=async evento=>{
            evento.preventDefault();const t=seleccionada();if(ocupado||!puedeConfigurar()||!listo||!t?.activa||!bloqueo.reportValidity())return;
            // datetime-local se envía literalmente: el contrato usa fechas de Chile sin sufijo UTC.
            const datos={id_trabajadora:t.id_trabajadora,fecha_inicio:campoBloqueo('fecha_inicio').value,fecha_fin:campoBloqueo('fecha_fin').value,motivo:campoBloqueo('motivo').value.trim()||null};
            if(!datos.fecha_inicio||!datos.fecha_fin||datos.fecha_fin<=datos.fecha_inicio){estado.textContent='El término del bloqueo debe ser posterior al inicio.';return;}
            await ejecutar('/api/bloqueos','POST',datos,'Bloqueo registrado correctamente.');
        };
        trabajador.onchange=()=>{if(!ocupado)render();};actualizar.onclick=()=>{if(!ocupado)cargar(negocio);};
        $('#nuevoHorario').onclick=()=>{if(!ocupado)limpiar();};controles();return{cargar,actualizarPermisos:controles};
    }
    if(typeof module!=='undefined'&&module.exports)module.exports={montar};else raiz.MerakiHorarios={montar};
})(typeof globalThis!=='undefined'?globalThis:this);
