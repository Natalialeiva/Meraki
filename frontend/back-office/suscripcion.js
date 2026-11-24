(function(raiz){
    function montar({contenedor,api,documento=document,confirmar=confirm,alActualizar=()=>{}}){
        const $=s=>contenedor.querySelector(s),estado=$('#estadoSuscripcion'),detalle=$('#detalleSuscripcion'),pagos=$('#pagosSuscripcion');
        const acepta=$('#consentimientoSuscripcion'),inscribir=$('#inscribirSuscripcion'),cancelar=$('#cancelarSuscripcion'),reintentar=$('#reintentarSuscripcion'),actualizar=$('#actualizarSuscripcion'),cobrar=$('#cobrarSuscripcion');
        let datos=null,ocupado=false;
        function controles(){
            const s=datos?.suscripcion,pendiente=['iniciando','pendiente','confirmando','revision'].includes(s?.inscripcion);
            const tarjeta=Boolean(s?.tarjeta_ultimos4||s?.renovacion_automatica);
            inscribir.disabled=ocupado||!datos||!acepta.checked||tarjeta||pendiente;
            inscribir.textContent=tarjeta?'Tarjeta inscrita':'Inscribir tarjeta';
            inscribir.hidden=tarjeta&&!pendiente;
            cancelar.hidden=!s||(!tarjeta&&!pendiente);cancelar.disabled=ocupado;
            if(cobrar){cobrar.hidden=!tarjeta||Boolean(s?.acceso_vigente)||s?.estado==='cancelada'||pendiente;cobrar.disabled=ocupado;}
            const ultimo=datos?.pagos?.[0];
            if(cobrar)cobrar.textContent=ultimo?.estado==='pendiente'?'Consultar resultado del cobro':'Renovar período vencido · $9.990';
            reintentar.hidden=datos?.planificador_habilitado===false||!s?.renovacion_automatica||ultimo?.estado!=='rechazado'||ultimo?.proceso!=='finalizado';
            reintentar.disabled=ocupado||!acepta.checked;actualizar.disabled=ocupado;acepta.disabled=ocupado;
            const consentimientoPlan=$('#consentimientoPlan');
            if(consentimientoPlan)consentimientoPlan.hidden=tarjeta&&reintentar.hidden;
        }
        function parrafo(elemento,texto){const p=documento.createElement('p');p.textContent=texto;elemento.append(p);}
        function dibujar(){
            detalle.replaceChildren();pagos.replaceChildren();const s=datos.suscripcion;
            parrafo(detalle,'Plan Meraki: $9.990 CLP al mes · Un mes calendario gratuito por cuenta · Ambiente de integración.');
            if(!s)parrafo(detalle,'Aún no has inscrito una tarjeta. No hay cobros programados.');
            else{
                const nombres={prueba:'Mes gratuito',activa:'Activa',vencida:'Sin período vigente',cancelada:'Renovación cancelada'};
                parrafo(detalle,'Estado: '+(nombres[s.estado]||s.estado));
                if(s.fecha_fin_prueba)parrafo(detalle,'Fin del mes gratuito: '+s.fecha_fin_prueba);
                if(s.acceso_hasta)parrafo(detalle,'Período vigente hasta: '+s.acceso_hasta+' (hora de Chile).');
                parrafo(detalle,s.renovacion_automatica?'Renovación autorizada en esta suscripción. Fecha del próximo período: '+s.fecha_proximo_cobro+' · $9.990.':'La renovación automática está deshabilitada.');
                if(datos.planificador_habilitado===false)parrafo(detalle,'El planificador de renovaciones automáticas está detenido en este servidor.');
                if(s.tarjeta_ultimos4)parrafo(detalle,'Tarjeta: '+s.tarjeta_tipo+' · Terminada en '+s.tarjeta_ultimos4);
                if(['pendiente','iniciando'].includes(s.inscripcion))parrafo(detalle,'Hay una inscripción en curso. Puedes cancelarla si abandonaste la pantalla de Transbank.');
                if(['revision','confirmando'].includes(s.inscripcion))parrafo(detalle,'La inscripción requiere revisión. No inicies otra hasta revisar o cancelar este proceso.');
            }
            for(const p of datos.pagos){
                const estadoPago=p.estado==='pendiente'?'Resultado en revisión; no se repetirá el cargo automáticamente':p.estado==='aprobado'?'Aprobado':p.estado==='rechazado'?'Rechazado; otro intento requiere tu autorización':p.estado;
                parrafo(pagos,`Período ${p.periodo_inicio||'anterior'} a ${p.periodo_fin||'—'} · $${Number(p.monto).toLocaleString('es-CL')} · ${estadoPago}`);
            }
            if(!datos.pagos.length)parrafo(pagos,'Sin cobros registrados.');
            raiz.MerakiSuscripcionVisual?.dibujar(documento,datos);controles();
        }
        async function cargar(){
            try{datos=await api('/api/suscripcion');dibujar();alActualizar(datos);return true;}
            catch(e){datos=null;estado.textContent=e.message;controles();alActualizar(null);return false;}
        }
        async function ejecutar(accion){
            if(ocupado)return;ocupado=true;controles();estado.textContent='Procesando solicitud…';
            try{await accion();}catch(e){estado.textContent=e.message;}
            finally{ocupado=false;controles();}
        }
        const consentimiento=()=>({acepta_renovacion:acepta.checked,version_plan:datos.plan.version});
        inscribir.onclick=()=>{
            if(inscribir.disabled)return;
            return ejecutar(async()=>{
                const r=await api('/api/suscripcion/inscribir','POST',{acepta_inscripcion:acepta.checked,version_plan:datos.plan.version});
                const url=new URL(r.url);
                if(url.protocol!=='https:'||url.hostname!=='webpay3gint.transbank.cl'||url.username||url.password)throw Error('No se pudo validar la pantalla de inscripción');
                // La tarjeta se ingresa directamente en Transbank. Meraki nunca recibe número completo ni CVV.
                const form=documento.createElement('form'),token=documento.createElement('input');form.method='POST';form.action=r.url;
                token.type='hidden';token.name='TBK_TOKEN';token.value=r.token;form.append(token);documento.body.append(form);
                estado.textContent='Abriendo inscripción de tarjeta en Transbank…';form.submit();
            });
        };
        cancelar.onclick=()=>{
            if(ocupado||!confirmar('¿Cancelar la inscripción de tarjeta y las renovaciones? Se conserva el período vigente. Una operación ya iniciada puede quedar pendiente de verificación.'))return;
            return ejecutar(async()=>{const r=await api('/api/suscripcion/cancelar','POST',{});const bien=await cargar();estado.textContent=r.mensaje+(bien?'':' Actualiza el panel para consultar su estado.');acepta.checked=false;});
        };
        reintentar.onclick=()=>{
            if(reintentar.disabled||ocupado||!confirmar('¿Autorizar otro intento de $9.990 a la tarjeta inscrita? El procesador lo ejecutará cuando revise el vencimiento.'))return;
            return ejecutar(async()=>{const r=await api('/api/suscripcion/reintentar','POST',consentimiento());await cargar();estado.textContent=r.mensaje;acepta.checked=false;});
        };
        if(cobrar)cobrar.onclick=()=>{
            const pregunta=datos?.pagos?.[0]?.estado==='pendiente'?'¿Consultar el resultado del cobro pendiente? Esta operación no inicia otro cargo.':'¿Autorizar un único cobro de $9.990 CLP al medio de pago inscrito para renovar el período vencido? No activa renovaciones automáticas.';
            if(cobrar.disabled||ocupado||!confirmar(pregunta))return;
            return ejecutar(async()=>{const r=await api('/api/suscripcion/cobrar','POST',{acepta_cobro:true,version_plan:datos.plan.version,ultimo_pago:datos.pagos[0]?.id_pago_suscripcion??null});await cargar();estado.textContent=r.mensaje+' Resultado: '+r.resultado;});
        };
        acepta.onchange=controles;actualizar.onclick=()=>ejecutar(async()=>{if(await cargar())estado.textContent='Estado de suscripción actualizado.';});controles();return{cargar};
    }
    if(typeof module!=='undefined'&&module.exports)module.exports={montar};else raiz.MerakiSuscripcion={montar};
})(typeof globalThis!=='undefined'?globalThis:this);
