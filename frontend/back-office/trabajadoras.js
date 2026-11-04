(function (raiz) {
    function montar({form,lista,estado,selector,actualizar,asignacion,asignados,tituloAsignacion,api,documento=document,confirmar=confirm,puedeConfigurar=()=>true}) {
        const grupo=form.querySelector('fieldset'),titulo=form.querySelector('[data-titulo-trabajadora]');
        const campos=Object.fromEntries(['nombre','apellido','descripcion'].map(k=>[k,form.elements.namedItem(k)]));
        const grupoAsignacion=asignacion.querySelector('fieldset');
        const elegirServicio=asignacion.elements.namedItem('id_servicio');
        let negocio=null,edicion=null,seleccionada=null,version=0,versionAsignacion=0,ocupado=false,listo=false,asignacionLista=false;
        function limpiar(){edicion=null;form.reset();titulo.textContent='Nueva trabajadora';}
        function controles(){
            grupo.disabled=ocupado||!listo||!puedeConfigurar();selector.disabled=ocupado;actualizar.disabled=ocupado||!negocio;
            grupoAsignacion.disabled=ocupado||!asignacionLista||!puedeConfigurar();
            for(const boton of [...lista.querySelectorAll('button'),...asignados.querySelectorAll('button')])boton.disabled=ocupado||!puedeConfigurar();
        }
        // Invalida las consultas anteriores para no mostrar asignaciones de otro negocio.
        function cerrarAsignacion(){versionAsignacion++;seleccionada=null;asignacionLista=false;asignados.replaceChildren();elegirServicio.replaceChildren();tituloAsignacion.textContent='Selecciona una trabajadora para administrar sus servicios.';}
        function editar(t){if(ocupado)return;edicion=t.id_trabajadora;for(const k of Object.keys(campos))campos[k].value=t[k]??'';titulo.textContent='Editar trabajadora: '+t.nombre;campos.nombre.focus();}
        function dibujar(trabajadoras){
            lista.replaceChildren();if(!trabajadoras.length)lista.textContent='Todavía no hay trabajadoras registradas.';
            for(const t of trabajadoras){
                const articulo=documento.createElement('article'),h=documento.createElement('h3'),p=documento.createElement('p');
                h.textContent=[t.nombre,t.apellido].filter(Boolean).join(' ');p.textContent=(t.activa?'Activa':'Desactivada')+(t.descripcion?' · '+t.descripcion:'');articulo.append(h,p);
                for(const [texto,accion] of [['Editar',()=>editar(t)],['Administrar servicios',()=>verServicios(t)]]){
                    const b=documento.createElement('button');b.type='button';b.textContent=texto;b.onclick=accion;articulo.append(b);
                }
                if(t.activa){const b=documento.createElement('button');b.type='button';b.textContent='Desactivar';b.onclick=()=>desactivar(t);articulo.append(b);}
                lista.append(articulo);
            }
        }
        async function cargar(id){
            const solicitud=++version;negocio=id?Number(id):null;listo=false;limpiar();cerrarAsignacion();lista.replaceChildren();controles();
            if(!negocio){estado.textContent='Selecciona un emprendimiento para administrar sus trabajadoras.';return false;}
            estado.textContent='Cargando trabajadoras…';
            try{const datos=await api('/api/mis-trabajadoras');if(solicitud!==version)return false;dibujar(datos.filter(t=>t.id_emprendimiento===negocio));listo=true;estado.textContent='Administra las trabajadoras y los servicios que realizan.';return true;}
            catch(error){if(solicitud===version)estado.textContent=error.message;return false;}
            finally{if(solicitud===version)controles();}
        }
        async function verServicios(t){
            const solicitud=++versionAsignacion;seleccionada=t;asignacionLista=false;asignados.replaceChildren();elegirServicio.replaceChildren();controles();
            tituloAsignacion.textContent='Servicios de '+[t.nombre,t.apellido].filter(Boolean).join(' ');
            estado.textContent='Cargando asignaciones…';
            try{
                const [relaciones,servicios]=await Promise.all([api('/api/trabajadoras/'+t.id_trabajadora+'/servicios'),api('/api/mis-servicios')]);
                if(solicitud!==versionAsignacion)return false;
                if(!relaciones.length)asignados.textContent='Sin servicios asignados.';
                for(const servicio of relaciones){
                    const p=documento.createElement('p'),b=documento.createElement('button');p.textContent=servicio.nombre+(servicio.activo?'':' · Desactivado');
                    b.type='button';b.textContent='Retirar asignación';b.onclick=()=>retirar(t,servicio);p.append(b);asignados.append(p);
                }
                // La lista evita asignaciones inválidas; el backend vuelve a verificar propiedad y estado.
                const disponibles=servicios.filter(s=>s.id_emprendimiento===negocio&&s.activo&&!relaciones.some(r=>r.id_servicio===s.id_servicio));
                for(const s of disponibles){const o=documento.createElement('option');o.value=s.id_servicio;o.textContent=s.servicio;elegirServicio.append(o);}
                asignacionLista=t.activa&&disponibles.length>0;
                estado.textContent=!t.activa?'Trabajadora desactivada: puedes revisar o retirar asignaciones, pero no agregar servicios.':disponibles.length?'Selecciona el servicio que realiza esta trabajadora. Necesita horarios configurados para ofrecer horas.':'No hay servicios activos pendientes de asignar.';
                return true;
            }catch(error){if(solicitud===versionAsignacion)estado.textContent=error.message;return false;}
            finally{if(solicitud===versionAsignacion)controles();}
        }
        async function ejecutar(url,metodo,datos,mensaje,recargar){
            ocupado=true;controles();estado.textContent='Guardando cambios…';
            // El guardado y la recarga tienen resultados distintos: nunca repetir una alta por una recarga fallida.
            try{await api(url,metodo,datos);const recargado=await recargar();estado.textContent=mensaje+(recargado?'':' No se pudo actualizar la vista; vuelve a consultar antes de repetir la operación.');}
            catch(error){estado.textContent=error.message;}
            finally{ocupado=false;controles();}
        }
        async function desactivar(t){
            if(ocupado||!puedeConfigurar()||!confirmar('¿Desactivar a '+t.nombre+'? Dejará de recibir nuevas reservas. Las citas existentes se conservan y debes gestionarlas en la agenda.'))return;
            await ejecutar('/api/trabajadoras/'+t.id_trabajadora+'/desactivar','PATCH',undefined,'Trabajadora desactivada correctamente.',()=>cargar(negocio));
        }
        async function retirar(t,s){
            if(ocupado||!puedeConfigurar()||!confirmar('¿Retirar '+s.nombre+' de '+t.nombre+'? Las reservas existentes se conservan.'))return;
            await ejecutar('/api/trabajadoras/'+t.id_trabajadora+'/servicios/'+s.id_servicio,'DELETE',undefined,'Asignación retirada correctamente.',()=>verServicios(t));
        }
        form.onsubmit=async evento=>{
            evento.preventDefault();if(ocupado||!puedeConfigurar()||!listo||!form.reportValidity())return;
            const datos=Object.fromEntries(Object.entries(campos).map(([k,e])=>[k,e.value.trim()||(k==='nombre'?'':null)]));
            if(!datos.nombre){estado.textContent='Indica el nombre de la trabajadora.';campos.nombre.focus();return;}
            if(edicion)await ejecutar('/api/trabajadoras/'+edicion,'PATCH',datos,'Trabajadora actualizada correctamente.',()=>cargar(negocio));
            else await ejecutar('/api/trabajadoras','POST',{...datos,id_emprendimiento:negocio},'Trabajadora registrada correctamente. Asigna sus servicios y configura sus horarios.',()=>cargar(negocio));
        };
        asignacion.onsubmit=async evento=>{
            evento.preventDefault();if(ocupado||!puedeConfigurar()||!asignacionLista||!asignacion.reportValidity())return;
            const t=seleccionada,id=Number(elegirServicio.value);if(!Number.isSafeInteger(id)||id<=0)return;
            await ejecutar('/api/trabajadoras/'+t.id_trabajadora+'/servicios','POST',{id_servicio:id},'Servicio asignado correctamente.',()=>verServicios(t));
        };
        form.querySelector('[data-nueva-trabajadora]').onclick=()=>{if(!ocupado){limpiar();estado.textContent='Completa los datos de la nueva trabajadora.';}};
        actualizar.onclick=()=>{if(!ocupado)cargar(negocio);};controles();
        return {cargar,actualizarPermisos:controles};
    }
    if(typeof module!=='undefined'&&module.exports)module.exports={montar};else raiz.MerakiTrabajadoras={montar};
})(typeof globalThis!=='undefined'?globalThis:this);
