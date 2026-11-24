(function(raiz){
 'use strict';
 function dibujar(doc,datos){
  const host=doc.getElementById('suscripcionVisual');if(!host)return;host.replaceChildren();
  const crear=(t,texto,c)=>{const n=doc.createElement(t);if(texto!==undefined)n.textContent=texto;if(c)n.className=c;return n;};
  const s=datos.suscripcion;
  const fecha=v=>{if(!v)return '';const m=/^\d{4}-\d{2}-\d{2}/.exec(v);if(!m)return '';return new Intl.DateTimeFormat('es-CL',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m[0]+'T12:00:00Z'));};
  const nombres={prueba:'Mes gratuito',activa:'Plan activo',vencida:'Período vencido',cancelada:'Renovación cancelada'};
  const resumen=crear('section',undefined,'suscripcion-vigencia');resumen.append(crear('span',s?(nombres[s.estado]||'Estado por revisar'):'Sin tarjeta inscrita','suscripcion-insignia'));
  resumen.append(crear('h3',s?.acceso_vigente&&fecha(s.acceso_hasta)?'Tu plan sigue activo hasta el '+fecha(s.acceso_hasta):s?.acceso_vigente?'Tu plan está vigente':s?'Tu período no está vigente':'Revisa tu plan Meraki'));
  if(s?.fecha_fin_prueba)resumen.append(crear('p','Fin del mes gratuito: '+fecha(s.fecha_fin_prueba)));
  resumen.append(crear('p',s?.renovacion_automatica?'Esta suscripción tiene renovación autorizada. Revisa las condiciones antes de continuar.':'No hay renovaciones automáticas autorizadas. Inscribir una tarjeta no inicia un cobro.'));
  const pasos=crear('div',undefined,'suscripcion-pasos');for(const [t,d]of [['Tu acceso',s?.acceso_vigente?'Vigente':'Sin período vigente'],['Vencimiento',fecha(s?.acceso_hasta)||'Sin fecha registrada'],['Renovación',s?.renovacion_automatica?'Autorizada':'Requiere tu autorización']]){const p=crear('div');p.append(crear('strong',t),crear('span',d));pasos.append(p);}resumen.append(pasos);host.append(resumen);
  const grid=crear('div',undefined,'suscripcion-tarjetas');
  const plan=crear('section');plan.append(crear('h3','Plan Meraki'),crear('p','$9.990 CLP al mes','suscripcion-precio'));
  const lista=crear('ul');for(const texto of ['Agenda y reservas','Catálogo público de tu emprendimiento','Notificaciones a tus clientas','Dashboard de reservas y valores'])lista.append(crear('li',texto));plan.append(lista);
  const tarjeta=crear('section');tarjeta.append(crear('h3','Tu tarjeta'));const imagen=crear('div',undefined,'suscripcion-tarjeta');
  if(s?.tarjeta_ultimos4){imagen.append(crear('span',s.tarjeta_tipo||'Tarjeta inscrita'),crear('strong','•••• •••• •••• '+s.tarjeta_ultimos4));}else imagen.append(crear('strong','Sin tarjeta inscrita'));
  tarjeta.append(imagen,crear('p','Inscribir una tarjeta no activa renovaciones automáticas.','ayuda-agenda'));grid.append(plan,tarjeta);host.append(grid);
 }
 raiz.MerakiSuscripcionVisual={dibujar};
})(globalThis);
