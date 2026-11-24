(function(){
 'use strict';
 const dinero=v=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:2}).format(Number(v));
 const fecha=v=>v?v.slice(0,10).split('-').reverse().join('-')+(v.length>10?' '+v.slice(11):''):'Sin registro';
 const periodo={sin_suscripcion:'Sin suscripción',gratuito:'Período gratuito vigente',activa:'Período pagado vigente',vencida:'Sin período vigente'};
 const paginacion=(pagina,total,tamano=50)=>({oculta:pagina===1&&total<=tamano,anterior:pagina<=1,siguiente:pagina*tamano>=total,texto:'Página '+pagina+' de '+Math.max(pagina,Math.ceil(total/tamano))});
 if(typeof module!=='undefined'&&module.exports){module.exports={dinero,fecha,periodo,paginacion};return;}
 const $=s=>document.querySelector(s),estado=$('#estado');
 let csrf='',sesion=0,conectada=true;
 const versiones={lista:0,detalle:0,resumen:0,historial:0};
 function limpiarPrivados(){for(const s of ['#negocios','#datosDetalle','#cobros','#accionesAdmin','#indicadores','#indicadoresGenerales'])$(s)?.replaceChildren();}
 async function api(ruta,method='GET',datos,vigente=()=>true){
  const s=sesion;
  const r=await fetch('/api/admin'+ruta,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Meraki-Action':'1',...(csrf?{'X-Meraki-CSRF':csrf}:{})},body:datos?JSON.stringify(datos):undefined});
  if(!vigente()||s!==sesion)throw Object.assign(Error('Respuesta anterior descartada'),{obsoleta:true});
  let d;try{d=await r.json();}catch{throw Error('No se pudo leer la respuesta. Actualiza antes de intentar nuevamente.');}
  if(r.status===401&&!$('#loginAdmin')){conectada=false;sesion++;limpiarPrivados();location.assign('/admin/login');throw Error('La sesión venció. Inicia sesión nuevamente.');}
  if(!r.ok)throw Object.assign(Error(d.mensaje||'No se pudo completar la consulta'),{status:r.status});return d;
 }
 function nodo(tag,texto,clase){const e=document.createElement(tag);if(texto!==undefined)e.textContent=texto;if(clase)e.className=clase;return e;}
 function definiciones(filas){const dl=nodo('dl');for(const [k,v]of filas)dl.append(nodo('dt',k),nodo('dd',v??'Sin registro'));return dl;}
 function actualizarPaginas(nav,etiqueta,anterior,siguiente,p,total,tamano=50){const d=paginacion(p,total,tamano);$(nav).hidden=d.oculta;$(etiqueta).textContent=d.texto;$(anterior).disabled=d.anterior;$(siguiente).disabled=d.siguiente;}
 const login=$('#loginAdmin');
 if(login){login.onsubmit=async e=>{e.preventDefault();const b=login.querySelector('button');if(b.disabled)return;b.disabled=true;estado.textContent='Comprobando acceso…';try{await api('/auth/login','POST',Object.fromEntries(new FormData(login)));login.reset();location.assign('/admin/');}catch(err){estado.textContent=err.message;login.elements.namedItem('password').value='';}finally{b.disabled=false;}};return;}
 let pagina=1,idDetalle=null,paginaCobros=1,paginaHistorial=1,actual=null,intento=null;
 const titulos={resumen:'Resumen general',emprendedoras:'Emprendedoras',suscripciones:'Suscripciones y pagos',historial:'Historial administrativo'};
 function vista(nombre,enfocar=true){if(!titulos[nombre])nombre='resumen';for(const e of document.querySelectorAll('[data-panel]'))e.hidden=e.dataset.panel!==nombre;for(const a of document.querySelectorAll('[data-vista]')){if(a.dataset.vista===nombre)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}$('#tituloVistaAdmin').textContent=titulos[nombre];if(enfocar)$('#tituloVistaAdmin').focus();if(nombre==='historial')void historial();}
 function errorVisible(e){if(!e.obsoleta&&conectada)estado.textContent=e.message;}
 async function listar(){const v=++versiones.lista,vigente=()=>v===versiones.lista&&conectada;const params=new URLSearchParams(new FormData($('#buscar')));params.set('pagina',pagina);$('#negocios').replaceChildren();$('#cantidad').textContent='Cargando emprendedoras…';$('#anterior').disabled=$('#siguiente').disabled=true;
  try{const d=await api('/emprendedoras?'+params,'GET',undefined,vigente);if(!vigente())return;
   const etiquetas=['Emprendedora','Emprendimiento','Correo','Estado','Período y fechas','Acción'];
   for(const n of d.emprendedoras){const tr=nodo('tr');const valores=[n.responsable_nombre+' '+n.responsable_apellido,n.nombre||'Sin emprendimiento',n.responsable_correo,'Cuenta: '+n.estado_cuenta+' · Suscripción: '+(n.estado_suscripcion||'Sin suscripción'),(periodo[n.periodo]||'Sin registro')+' · Inicio: '+fecha(n.fecha_inicio)+' · Próximo cobro: '+(n.renovacion_automatica?fecha(n.fecha_proximo_cobro):'Renovación desactivada')];for(let i=0;i<valores.length;i++){const td=nodo('td',valores[i]);td.setAttribute('data-label',etiquetas[i]);tr.append(td);}const td=nodo('td');td.setAttribute('data-label','Acción');const b=nodo('button','Ver detalle');b.type='button';b.setAttribute('aria-label','Ver detalle de '+n.responsable_nombre);b.onclick=()=>{idDetalle=n.id_emprendedora;paginaCobros=1;location.hash='suscripciones';vista('suscripciones');void detalle();};td.append(b);tr.append(td);$('#negocios').append(tr);}
   if(!d.emprendedoras.length){const tr=nodo('tr'),td=nodo('td','No hay emprendedoras para estos filtros.');td.colSpan=6;tr.append(td);$('#negocios').append(tr);}
   $('#cantidad').textContent=d.total+' emprendedora(s) encontrada(s).';actualizarPaginas('#paginasNegocios','#pagina','#anterior','#siguiente',pagina,d.total);
  }catch(e){if(vigente()){$('#negocios').replaceChildren();$('#cantidad').textContent='No disponible';errorVisible(e);}}
 }
 async function resumen(){const v=++versiones.resumen,vigente=()=>v===versiones.resumen&&conectada;const b=$('#filtroMes').querySelector('button');b.disabled=true;$('#indicadores').replaceChildren();$('#indicadoresGenerales').replaceChildren();$('#criterio').textContent='Cargando resumen…';
  try{const [d,n]=await Promise.all([api('/resumen?mes='+encodeURIComponent($('#mes').value),'GET',undefined,vigente),api('/indicadores','GET',undefined,vigente)]);if(!vigente())return;
   for(const [t,v]of [['Emprendedoras registradas',n.emprendedoras],['Suscripciones activas vigentes',n.activas],['Períodos gratuitos vigentes',n.gratuitas],['Suscripciones canceladas',n.canceladas],['Problemas de pago',n.problemas_pago],['Pagos aprobados registrados',n.pagos_aprobados]]){const a=nodo('article');a.append(nodo('small',t),nodo('strong',String(v)));$('#indicadoresGenerales').append(a);}
   for(const [t,v]of [['Importe aprobado del mes (Integration)',d.mensual_registrado],['Importe aprobado acumulado (Integration)',d.total_registrado]]){const a=nodo('article');a.append(nodo('p',t),nodo('strong',dinero(v)));$('#indicadores').append(a);}$('#criterio').textContent=d.criterio+' Aprobados sin fecha: '+d.aprobados_sin_fecha+'. Duplicados excluidos del importe: '+d.duplicados_excluidos+'.';
  }catch(e){if(vigente()){$('#criterio').textContent='Resumen no disponible. Actualiza para reintentar.';errorVisible(e);}}finally{if(vigente())b.disabled=false;}
 }
 async function detalle(){const v=++versiones.detalle,vigente=()=>v===versiones.detalle&&conectada;actual=null;$('#detalle').hidden=false;$('#datosDetalle').textContent='Cargando detalle…';$('#cobros').replaceChildren();$('#abrirCancelacion').hidden=true;$('#avisoCancelacion').textContent='';$('#cobrosAnterior').disabled=$('#cobrosSiguiente').disabled=true;
  try{const d=await api('/emprendedoras/'+idDetalle+'?pagina_cobros='+paginaCobros,'GET',undefined,vigente);if(!vigente())return;actual=d.emprendimiento;
   $('#tituloDetalle').textContent=actual.nombre||actual.responsable_nombre+' '+actual.responsable_apellido;
   $('#datosDetalle').replaceChildren(definiciones([['Emprendedora',actual.responsable_nombre+' '+actual.responsable_apellido],['Correo',actual.responsable_correo],['Plan','Meraki mensual'],['Precio mensual registrado',actual.monto_mensual===null?'Sin suscripción':dinero(actual.monto_mensual)],['Estado',actual.estado_suscripcion||'Sin suscripción'],['Período',periodo[actual.periodo]],['Inicio',fecha(actual.fecha_inicio)],['Fin del período gratuito',fecha(actual.fecha_fin_prueba)],['Acceso hasta (límite exclusivo)',fecha(actual.acceso_hasta)],['Próximo cobro programado',actual.renovacion_automatica?fecha(actual.fecha_proximo_cobro):'Renovación desactivada'],['Renovación automática',actual.renovacion_automatica?'Habilitada':'Deshabilitada'],['Inscripción Oneclick',actual.estado_inscripcion||'Sin inscripción']]));
   $('#abrirCancelacion').hidden=!actual.id_suscripcion||actual.estado_suscripcion==='cancelada';$('#abrirCancelacion').disabled=actual.pago_pendiente;
   $('#avisoCancelacion').textContent=actual.pago_pendiente?'Hay un cobro pendiente: debe resolverse antes de cancelar. No se consulta automáticamente a Transbank.':actual.estado_suscripcion==='cancelada'?'Renovaciones canceladas localmente. La inscripción Oneclick no se elimina desde este panel.':'';
   for(const p of d.cobros){const a=nodo('article');a.append(nodo('h3','Pago de suscripción'),definiciones([['Monto',dinero(p.monto)],['Estado',p.estado],['Procesamiento',p.proceso],['Intento',p.intento],['Período',fecha(p.periodo_inicio)+' a '+fecha(p.periodo_fin)],['Pago (Santiago)',fecha(p.fecha_pago)],['Resultado',p.estado==='rechazado'?'El cobro fue rechazado; no acredita pago aprobado.':p.estado==='pendiente'?'Resultado pendiente de resolución.':p.proceso==='finalizado'?'Aprobación registrada en integración.':'Requiere revisión']]));$('#cobros').append(a);}
   if(!d.cobros.length)$('#cobros').textContent='Sin pagos registrados en esta página.';actualizarPaginas('#paginasCobros','#paginaCobros','#cobrosAnterior','#cobrosSiguiente',paginaCobros,d.total_cobros);$('#tituloDetalle').focus({preventScroll:true});
  }catch(e){if(vigente()){$('#datosDetalle').textContent='No se pudo cargar el detalle. Selecciona nuevamente la emprendedora.';errorVisible(e);}}
 }
 async function historial(){const v=++versiones.historial,vigente=()=>v===versiones.historial&&conectada;$('#accionesAdmin').textContent='Cargando historial…';
  try{const d=await api('/historial?pagina='+paginaHistorial,'GET',undefined,vigente);if(!vigente())return;$('#accionesAdmin').replaceChildren();for(const h of d.acciones){const a=nodo('article');a.append(nodo('h3',h.emprendimiento||'Suscripción administrada'),definiciones([['Administradora',h.administradora],['Operación','Cancelación de renovaciones en Meraki'],['Fecha (Santiago)',fecha(h.fecha)],['Motivo',h.motivo],['Resultado','Cancelada localmente; Oneclick sin modificar']]));$('#accionesAdmin').append(a);}if(!d.acciones.length)$('#accionesAdmin').textContent='Todavía no hay acciones administrativas registradas.';actualizarPaginas('#paginasHistorial','#paginaHistorial','#historialAnterior','#historialSiguiente',paginaHistorial,d.total);
  }catch(e){if(vigente()){$('#accionesAdmin').textContent='Historial no disponible. Comprueba que la migración 015 esté aplicada y actualiza.';errorVisible(e);}}
 }
 const dialogo=$('#confirmacionCancelacion');
 $('#abrirCancelacion').onclick=()=>{if(!actual?.id_suscripcion)return;if(intento&&intento.suscripcion!==actual.id_suscripcion){estado.textContent='Verifica primero la cancelación anterior antes de iniciar otra.';return;}$('#destinoCancelacion').textContent=actual.nombre||actual.responsable_nombre;if(!intento){$('#motivoCancelacion').value='';$('#motivoCancelacion').readOnly=false;$('#estadoCancelacion').textContent='';$('#confirmarCancelacion').textContent='Confirmar cancelación local';}dialogo.showModal();$('#motivoCancelacion').focus();};
 $('#volverCancelacion').onclick=()=>dialogo.close();
 let enviando=false;
 $('#cancelarSuscripcion').onsubmit=async e=>{e.preventDefault();if(enviando||!actual)return;const motivo=$('#motivoCancelacion').value.trim();if(!intento){if(motivo.length<10||motivo.length>500){$('#estadoCancelacion').textContent='Escribe entre 10 y 500 caracteres.';return;}intento={suscripcion:actual.id_suscripcion,motivo,clave:crypto.randomUUID()};}enviando=true;$('#confirmarCancelacion').disabled=true;$('#volverCancelacion').disabled=true;$('#motivoCancelacion').readOnly=true;$('#estadoCancelacion').textContent='Registrando la cancelación local…';
  try{const d=await api('/suscripciones/'+intento.suscripcion+'/cancelar','POST',{motivo:intento.motivo,clave:intento.clave});estado.textContent=d.mensaje;intento=null;dialogo.close();await Promise.all([detalle(),listar(),resumen()]);}
  catch(error){if(!error.status||error.status>=500){$('#estadoCancelacion').textContent='No se pudo confirmar el resultado. Verifica la misma cancelación antes de iniciar otra; no se generará una clave nueva.';$('#confirmarCancelacion').textContent='Verificar cancelación';}else{intento=null;$('#motivoCancelacion').readOnly=false;$('#estadoCancelacion').textContent=error.message;}}
  finally{enviando=false;$('#confirmarCancelacion').disabled=false;$('#volverCancelacion').disabled=false;}
 };
 dialogo.addEventListener('cancel',e=>{if(enviando)e.preventDefault();});
 $('#buscar').onsubmit=e=>{e.preventDefault();pagina=1;void listar();};$('#anterior').onclick=()=>{if(pagina>1){pagina--;void listar();}};$('#siguiente').onclick=()=>{pagina++;void listar();};
 $('#filtroMes').onsubmit=e=>{e.preventDefault();void resumen();};$('#actualizarResumen').onclick=()=>void resumen();
 $('#cobrosAnterior').onclick=()=>{if(paginaCobros>1){paginaCobros--;void detalle();}};$('#cobrosSiguiente').onclick=()=>{paginaCobros++;void detalle();};
 $('#actualizarHistorial').onclick=()=>void historial();$('#historialAnterior').onclick=()=>{if(paginaHistorial>1){paginaHistorial--;void historial();}};$('#historialSiguiente').onclick=()=>{paginaHistorial++;void historial();};
 $('#irEmprendedoras').onclick=()=>{location.hash='emprendedoras';vista('emprendedoras');};
 $('#salir').onclick=async()=>{try{await api('/auth/logout','POST');conectada=false;sesion++;limpiarPrivados();location.assign('/admin/login');}catch(e){errorVisible(e);}};
 addEventListener('hashchange',()=>vista(location.hash.slice(1)));
 const partes=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit'}).formatToParts(new Date());$('#mes').value=partes.find(p=>p.type==='year').value+'-'+partes.find(p=>p.type==='month').value;
 void api('/auth/yo').then(d=>{csrf=d.csrf;$('#identidadAdmin').textContent=d.correo;vista(location.hash.slice(1),false);return Promise.all([listar(),resumen()]);}).catch(errorVisible);
})();
