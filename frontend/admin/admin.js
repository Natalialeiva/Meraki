(function(){
 'use strict';
 const dinero=v=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:2}).format(Number(v));
 const fecha=v=>v?v.slice(0,10).split('-').reverse().join('-')+(v.length>10?' '+v.slice(11):''):'Sin registro';
 const periodo={sin_suscripcion:'Sin suscripción',gratuito:'Período gratuito vigente',activa:'Período pagado vigente',vencida:'Sin período vigente'};
 const paginacion=(pagina,total,tamano=50)=>({oculta:pagina===1&&total<=tamano,anterior:pagina<=1,siguiente:pagina*tamano>=total,texto:'Página '+pagina+' de '+Math.max(pagina,Math.ceil(total/tamano))});
 if(typeof module!=='undefined'&&module.exports){module.exports={dinero,fecha,periodo,paginacion};return;}
 const $=s=>document.querySelector(s),estado=$('#estado');
 async function api(ruta,method='GET',datos){
  const r=await fetch('/api/admin'+ruta,{method,cache:'no-store',headers:{'Content-Type':'application/json','X-Meraki-Action':'1'},body:datos?JSON.stringify(datos):undefined});
  let d;try{d=await r.json();}catch{throw Error('No se pudo leer la respuesta. Intenta nuevamente.');}
  if(r.status===401&&!$('#loginAdmin')){location.assign('/admin/login');throw Error('La sesión venció. Inicia sesión nuevamente.');}
  if(!r.ok)throw Error(d.mensaje||'No se pudo completar la consulta');return d;
 }
 function nodo(tag,texto,clase){const e=document.createElement(tag);if(texto!==undefined)e.textContent=texto;if(clase)e.className=clase;return e;}
 function actualizarPaginas(nav,etiqueta,anterior,siguiente,pagina,total,tamano=50){const p=paginacion(pagina,total,tamano);$(nav).hidden=p.oculta;$(etiqueta).textContent=p.texto;$(anterior).disabled=p.anterior;$(siguiente).disabled=p.siguiente;}
 function campos(n){return [['ID emprendimiento',n.id_emprendimiento],['Negocio',n.nombre],['Publicación del negocio',n.emprendimiento_activo?'Activo':'Inactivo'],['Responsable',[n.responsable_nombre,n.responsable_apellido].join(' ')],['Correo responsable',n.responsable_correo],['Estado de la cuenta',n.estado_cuenta],['Estado registrado de suscripción',n.estado_suscripcion||'Sin suscripción'],['Período de acceso',periodo[n.periodo]],['Acceso vigente',n.acceso_vigente?'Sí':'No'],['Estado inscripción Oneclick',n.estado_inscripcion||'Sin inscripción'],['Renovación automática',n.renovacion_automatica?'Habilitada':'Deshabilitada'],['Inicio',fecha(n.fecha_inicio)],['Fin de prueba gratuita',fecha(n.fecha_fin_prueba)],['Acceso hasta (límite exclusivo)',fecha(n.acceso_hasta)],['Próximo cobro programado',fecha(n.fecha_proximo_cobro)]];}
 function definiciones(filas){const dl=nodo('dl');for(const [k,v]of filas)dl.append(nodo('dt',k),nodo('dd',v));return dl;}
 const login=$('#loginAdmin');
 if(login){login.onsubmit=async e=>{e.preventDefault();const b=login.querySelector('button');if(b.disabled)return;b.disabled=true;estado.textContent='Comprobando acceso…';try{await api('/auth/login','POST',Object.fromEntries(new FormData(login)));login.reset();location.assign('/admin/');}catch(err){estado.textContent=err.message;login.elements.namedItem('password').value='';}finally{b.disabled=false;}};return;}
 let pagina=1,version=0,idDetalle=null,paginaCobros=1,versionDetalle=0;
 async function listar(){const v=++version;const params=new URLSearchParams(new FormData($('#buscar')));params.set('pagina',pagina);$('#anterior').disabled=$('#siguiente').disabled=true;estado.textContent='Consultando emprendimientos…';
  try{const d=await api('/emprendimientos?'+params);if(v!==version)return;$('#negocios').replaceChildren();
   for(const n of d.emprendimientos){const a=nodo('article');a.append(nodo('h3',n.nombre),nodo('p','Responsable: '+n.responsable_nombre+' '+n.responsable_apellido),nodo('p','Cuenta: '+n.estado_cuenta),nodo('p','Suscripción registrada: '+(n.estado_suscripcion||'Sin suscripción')),nodo('p',periodo[n.periodo]+' · Acceso vigente: '+(n.acceso_vigente?'Sí':'No')));const b=nodo('button','Ver detalle');b.setAttribute('aria-label','Ver detalle de '+n.nombre);b.type='button';b.onclick=()=>{idDetalle=n.id_emprendimiento;paginaCobros=1;void detalle();};a.append(b);$('#negocios').append(a);}
   if(!d.emprendimientos.length)$('#negocios').textContent='No hay emprendimientos que coincidan con estos filtros.';
   $('#cantidad').textContent=d.total+(d.total===1?' emprendimiento encontrado.':' emprendimientos encontrados.');actualizarPaginas('#paginasNegocios','#pagina','#anterior','#siguiente',pagina,d.total,d.por_pagina);estado.textContent='Consulta actualizada.';
  }catch(e){if(v===version){$('#negocios').replaceChildren();$('#cantidad').textContent='No disponible';estado.textContent=e.message;}}
 }
 async function resumen(){const b=$('#filtroMes').querySelector('button');b.disabled=true;try{const d=await api('/resumen?mes='+encodeURIComponent($('#mes').value));$('#indicadores').replaceChildren();for(const [t,v]of [['Mensualidades del mes',d.mensual_registrado],['Mensualidades acumuladas',d.total_registrado]]){const a=nodo('article');a.append(nodo('p',t),nodo('strong',dinero(v)));$('#indicadores').append(a);}$('#criterio').textContent=d.criterio+' Aprobados sin fecha: '+d.aprobados_sin_fecha+'. Duplicados excluidos: '+d.duplicados_excluidos+'.';}catch(e){$('#indicadores').replaceChildren();$('#criterio').textContent=e.message;}finally{b.disabled=false;}}
 async function detalle(){const v=++versionDetalle;$('#detalle').hidden=false;$('#datosDetalle').textContent='Cargando detalle…';$('#cobros').replaceChildren();$('#cobrosAnterior').disabled=$('#cobrosSiguiente').disabled=true;
  try{const d=await api('/emprendimientos/'+idDetalle+'?pagina_cobros='+paginaCobros);if(v!==versionDetalle)return;
   $('#tituloDetalle').textContent='Emprendimiento #'+d.emprendimiento.id_emprendimiento;$('#datosDetalle').replaceChildren(definiciones(campos(d.emprendimiento)));
   for(const p of d.cobros){const a=nodo('article');a.append(nodo('h3','Cobro #'+p.id_pago_suscripcion),definiciones([['Monto',dinero(p.monto)],['Estado',p.estado],['Procesamiento',p.proceso],['Intento',p.intento],['Período',fecha(p.periodo_inicio)+' a '+fecha(p.periodo_fin)],['Creación (Santiago)',fecha(p.fecha_creacion)],['Pago (Santiago)',fecha(p.fecha_pago)]]));$('#cobros').append(a);}
   if(!d.cobros.length)$('#cobros').textContent='Sin cobros registrados en esta página.';actualizarPaginas('#paginasCobros','#paginaCobros','#cobrosAnterior','#cobrosSiguiente',paginaCobros,d.total_cobros);
   $('#detalle').scrollIntoView({block:'start'});$('#tituloDetalle').focus({preventScroll:true});
  }catch(e){if(v===versionDetalle)$('#datosDetalle').textContent=e.message;}
 }
 $('#buscar').onsubmit=e=>{e.preventDefault();pagina=1;void listar();};$('#anterior').onclick=()=>{if(pagina>1){pagina--;void listar();}};$('#siguiente').onclick=()=>{pagina++;void listar();};
 $('#filtroMes').onsubmit=e=>{e.preventDefault();void resumen();};$('#cobrosAnterior').onclick=()=>{if(paginaCobros>1){paginaCobros--;void detalle();}};$('#cobrosSiguiente').onclick=()=>{paginaCobros++;void detalle();};
 $('#salir').onclick=async()=>{try{await api('/auth/logout','POST');location.assign('/admin/login');}catch(e){estado.textContent=e.message;}};
 const partes=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit'}).formatToParts(new Date());$('#mes').value=partes.find(p=>p.type==='year').value+'-'+partes.find(p=>p.type==='month').value;
 void api('/auth/yo').then(()=>Promise.all([listar(),resumen()])).catch(e=>{estado.textContent=e.message;});
})();
