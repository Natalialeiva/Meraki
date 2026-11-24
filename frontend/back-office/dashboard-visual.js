(function(raiz){
 'use strict';
 function horas(reservas){
  const filas=Array.from({length:3},()=>Array(7).fill(0)),vistas=new Set();
  for(const r of reservas){if(vistas.has(r.id_reserva))continue;vistas.add(r.id_reserva);const f=r.fecha_hora_inicio;if(typeof f!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:/.test(f))continue;const d=new Date(f.slice(0,10)+'T12:00:00Z');if(Number.isNaN(d.getTime()))continue;const hora=Number(f.slice(11,13)),tramo=hora>=9&&hora<18?Math.floor((hora-9)/3):-1;if(tramo>=0)filas[tramo][(d.getUTCDay()+6)%7]++;}
  return filas;
 }
 function montar(doc,reservas){
  const dash=doc.querySelector('[data-vista="dashboard"]');if(!dash)return;
  const contenido=doc.getElementById('contenidoDashboard');
  let controles=doc.getElementById('modoDashboard');
  if(!controles){controles=doc.createElement('div');controles.id='modoDashboard';controles.className='modo-dashboard';controles.setAttribute('role','group');controles.setAttribute('aria-label','Vista del Dashboard');
   for(const [texto,valor]of [['Ver reservas','reservas'],['Ver dinero','valores']]){const b=doc.createElement('button');b.type='button';b.textContent=texto;b.dataset.modo=valor;b.onclick=()=>{dash.dataset.modo=valor;for(const btn of controles.children)btn.setAttribute('aria-pressed',String(btn===b));};controles.append(b);}
   contenido.querySelector('.metricas-dashboard').after(controles);controles.children[0].click();
  }
  // Las tablas accesibles permanecen disponibles, pero no recargan la vista inicial.
  for(const id of ['evolucionReservas','detalleEconomico','evolucionEconomica']){const host=doc.getElementById(id);const tabla=host.querySelector('table');if(tabla&&tabla.parentElement===host){const d=doc.createElement('details'),s=doc.createElement('summary');s.textContent='Ver datos en tabla';d.className='tabla-dashboard-plegada';d.append(s,tabla);host.append(d);}}
  let panel=doc.getElementById('horasDashboard');if(!panel){panel=doc.createElement('section');panel.id='horasDashboard';panel.className='horas-dashboard';contenido.append(panel);}
  panel.replaceChildren();const h=doc.createElement('h3');h.textContent='Horas más pedidas';const ayuda=doc.createElement('p');ayuda.className='ayuda-agenda';ayuda.textContent='Cada número indica cuántas reservas comienzan en ese día y franja horaria. Sin color rosa = 0 reservas; rosa suave = menos reservas; rosa intenso = más reservas dentro de esta vista. El color indica cantidad, no el estado de la reserva.';panel.append(h,ayuda);
  const contexto=doc.createElement('p');contexto.className='ayuda-agenda';contexto.textContent='De 09:00 a 18:00, hora de Santiago. Se aplican los filtros de esta vista.';panel.append(contexto);
  const matriz=horas(reservas),max=Math.max(1,...matriz.flat()),grid=doc.createElement('div');grid.className='mapa-horas';
  for(const texto of ['', 'L','M','X','J','V','S','D']){const n=doc.createElement('span');n.textContent=texto;grid.append(n);}
  matriz.forEach((fila,i)=>{const l=doc.createElement('span');l.textContent=['9–12','12–15','15–18'][i];grid.append(l);fila.forEach((n,d)=>{const celda=doc.createElement('span');celda.className='celda-horas';celda.dataset.nivel=n===0?'0':String(Math.min(4,Math.ceil(n/max*4)));celda.textContent=String(n);celda.title=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][d]+', '+l.textContent+': '+n+' reservas';grid.append(celda);});});panel.append(grid);
 }
 function limpiar(){if(typeof document!=='undefined'){for(const id of ['horasDashboard','dineroVisual']){const panel=document.getElementById(id);if(panel)panel.replaceChildren();}}}
 const api={horas,montar,limpiar};if(typeof module!=='undefined'&&module.exports)module.exports=api;else raiz.MerakiDashboardVisual=api;
})(globalThis);
