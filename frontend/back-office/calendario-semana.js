(function(raiz){
 'use strict';
 const fechaSantiago=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function semana(reservas,referencia=fechaSantiago()){
  const inicio=new Date(referencia+'T12:00:00Z');if(Number.isNaN(inicio.getTime()))return [];
  inicio.setUTCDate(inicio.getUTCDate()-(inicio.getUTCDay()+6)%7);
  const unicas=new Map();for(const r of reservas||[])if(r?.id_reserva&&!unicas.has(r.id_reserva))unicas.set(r.id_reserva,r);
  return Array.from({length:7},(_,i)=>{const d=new Date(inicio);d.setUTCDate(d.getUTCDate()+i);const fecha=d.toISOString().slice(0,10);return {fecha,etiqueta:new Intl.DateTimeFormat('es-CL',{weekday:'short',day:'numeric',timeZone:'UTC'}).format(d),reservas:[...unicas.values()].filter(r=>typeof r.fecha_hora_inicio==='string'&&r.fecha_hora_inicio.slice(0,10)===fecha).sort((a,b)=>a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio))};});
 }
 function montar(doc,reservas,referencia,estado=''){
  const lista=doc.getElementById('diasSemana');if(!lista)return;
  const hoy=fechaSantiago(),dias=semana((reservas||[]).filter(r=>!estado||r.estado===estado),referencia||hoy);lista.replaceChildren();
  doc.getElementById('rangoSemana').textContent=dias.length?'Del '+dias[0].fecha+' al '+dias[6].fecha+' · Hora de Santiago.':'';
  for(const dia of dias){const col=doc.createElement('section');col.className='dia-semana';if(dia.fecha===hoy){col.classList.add('dia-hoy');col.setAttribute('aria-label',dia.etiqueta+', hoy');}
   const titulo=doc.createElement('h4');titulo.textContent=dia.etiqueta;col.append(titulo);
   if(!dia.reservas.length){const p=doc.createElement('p');p.textContent='Sin reservas';col.append(p);}
   for(const r of dia.reservas){const cita=doc.createElement('article');cita.className='cita-semana';cita.dataset.estado=r.estado;const hora=doc.createElement('strong');hora.textContent=r.fecha_hora_inicio.slice(11,16);const servicio=doc.createElement('span');servicio.textContent=r.servicio;const estado=doc.createElement('small');estado.textContent=raiz.MerakiAgenda?.estado(r.estado)||r.estado;cita.append(hora,servicio,estado);col.append(cita);}lista.append(col);
  }
 }
 const api={semana,montar};if(typeof module!=='undefined'&&module.exports)module.exports=api;else raiz.MerakiCalendario=api;
})(typeof globalThis!=='undefined'?globalThis:this);
