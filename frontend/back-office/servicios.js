(function (raiz) {
    function montar({form, lista, estado, selector, actualizar, api, documento = document, confirmar = confirm, puedeConfigurar = ()=>true}) {
        const grupo = form.querySelector('fieldset');
        const nuevo = form.querySelector('[data-nuevo-servicio]');
        const titulo = form.querySelector('[data-titulo-servicio]');
        const campos = Object.fromEntries(['nombre','descripcion','id_categoria','precio','duracion_min','monto_abono'].map(k=>[k,form.elements.namedItem(k)]));
        let negocio = null, edicion = null, version = 0, ocupado = false, listo = false;
        const moneda = valor => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:2}).format(Number(valor));

        function limpiar() {
            edicion = null;
            form.reset();
            titulo.textContent = 'Nuevo servicio';
        }
        function controles() {
            grupo.disabled = ocupado || !listo || !puedeConfigurar();
            selector.disabled = ocupado;
            actualizar.disabled = ocupado || !negocio;
            for (const boton of lista.querySelectorAll('button')) boton.disabled = ocupado || !puedeConfigurar();
        }
        function editar(servicio) {
            if (ocupado || !puedeConfigurar() || !listo) return;
            edicion = servicio.id_servicio;
            titulo.textContent = 'Editar servicio: ' + servicio.servicio;
            for (const k of Object.keys(campos)) campos[k].value = (k === 'nombre' ? servicio.servicio : servicio[k]) ?? '';
            estado.textContent = 'Edita el servicio y guarda los cambios.';
            campos.nombre.focus();
        }
        function dibujar(servicios) {
            lista.replaceChildren();
            if (!servicios.length) lista.textContent = 'Todavía no hay servicios en este emprendimiento.';
            for (const servicio of servicios) {
                const articulo = documento.createElement('article');
                const encabezado = documento.createElement('h3');encabezado.textContent = servicio.servicio;
                const detalle = documento.createElement('p');
                detalle.textContent = `${servicio.categoria} · ${servicio.duracion_min} minutos · Precio: ${moneda(servicio.precio)} · Abono: ${moneda(servicio.monto_abono)} · ${servicio.activo ? 'Activo' : 'Desactivado'}`;
                const editarBoton = documento.createElement('button');editarBoton.type='button';editarBoton.textContent='Editar';editarBoton.onclick=()=>editar(servicio);
                articulo.append(encabezado,detalle,editarBoton);
                if (servicio.activo) {
                    const boton = documento.createElement('button');boton.type='button';boton.textContent='Desactivar';
                    boton.onclick=()=>desactivar(servicio);articulo.append(boton);
                }
                lista.append(articulo);
            }
        }
        async function cargar(id) {
            const solicitud = ++version;
            negocio = id ? Number(id) : null;
            listo = false;limpiar();lista.replaceChildren();controles();
            if (!negocio) {estado.textContent='Selecciona un emprendimiento para administrar sus servicios.';return false;}
            estado.textContent='Cargando servicios…';
            try {
                const [servicios,categorias] = await Promise.all([api('/api/mis-servicios'),api('/api/categorias')]);
                if (solicitud !== version) return false;
                campos.id_categoria.replaceChildren();
                for (const categoria of categorias) {
                    const opcion = documento.createElement('option');opcion.value=categoria.id_categoria;opcion.textContent=categoria.nombre;campos.id_categoria.append(opcion);
                }
                dibujar(servicios.filter(s=>s.id_emprendimiento===negocio));
                listo = categorias.length > 0;
                estado.textContent = listo ? 'Administra los servicios de tu emprendimiento. Los nuevos requieren asignar una profesional para poder reservarse.' : 'No hay categorías disponibles. No se pueden crear servicios.';
                return true;
            } catch (error) {
                if (solicitud===version) estado.textContent=error.message;
                return false;
            } finally {
                if (solicitud===version) controles();
            }
        }
        async function ejecutar(url, metodo, datos, mensaje) {
            ocupado=true;controles();estado.textContent='Guardando cambios…';
            try {
                await api(url,metodo,datos);
                // Una falla al recargar no significa que haya fallado el guardado.
                const recargado=await cargar(negocio);
                estado.textContent=mensaje+(recargado?'':' No se pudo actualizar la lista; pulsa Actualizar servicios.');
            } catch (error) {estado.textContent=error.message;}
            finally {ocupado=false;controles();}
        }
        async function desactivar(servicio) {
            if (ocupado || !puedeConfigurar() || !confirmar('¿Desactivar '+servicio.servicio+'? Dejará de ofrecerse para nuevas reservas. Las reservas existentes se conservan.')) return;
            await ejecutar('/api/servicios/'+servicio.id_servicio+'/desactivar','PATCH',undefined,'Servicio desactivado correctamente.');
        }
        form.onsubmit=async evento=>{
            evento.preventDefault();
            if (ocupado || !puedeConfigurar() || !listo || !form.reportValidity()) return;
            const datos={nombre:campos.nombre.value.trim(),descripcion:campos.descripcion.value.trim()||null,
                id_categoria:Number(campos.id_categoria.value),precio:Number(campos.precio.value),
                duracion_min:Number(campos.duracion_min.value),monto_abono:Number(campos.monto_abono.value)};
            if (!datos.nombre || !Number.isFinite(datos.precio) || datos.precio<=0 || !Number.isSafeInteger(datos.duracion_min) || datos.duracion_min<=0 ||
                !Number.isFinite(datos.monto_abono) || datos.monto_abono<0 || datos.monto_abono>datos.precio) {
                estado.textContent='Revisa el nombre, precio, duración y abono. El abono no puede superar el precio.';return;
            }
            if (edicion) await ejecutar('/api/servicios/'+edicion,'PATCH',datos,'Servicio actualizado correctamente.');
            else await ejecutar('/api/servicios','POST',{...datos,id_emprendimiento:negocio},'Servicio creado correctamente. Asigna una profesional para habilitar sus reservas.');
        };
        nuevo.onclick=()=>{if(!ocupado){limpiar();estado.textContent='Completa los datos del nuevo servicio.';}};
        actualizar.onclick=()=>{if(!ocupado)cargar(negocio);};
        controles();
        return {cargar,actualizarPermisos:controles};
    }
    if (typeof module!=='undefined' && module.exports) module.exports={montar};
    else raiz.MerakiServicios={montar};
})(typeof globalThis!=='undefined'?globalThis:this);
