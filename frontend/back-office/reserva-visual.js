(function(raiz){
 'use strict';
 let seleccion=null;
 function montar(doc,reservas){
  const host=doc.getElementById('reservas');if(!host||!reservas.length)return;
  const articulos=[...host.children];if(articulos.length!==reservas.length)return;
  const lista=doc.createElement('div');lista.className='lista-reservas-compacta';lista.setAttribute('aria-label','Selecciona una reserva');
  const ficha=doc.createElement('section');ficha.className='ficha-reserva-seleccionada';ficha.setAttribute('aria-label','Detalle de la reserva seleccionada');
  const botones=[];
  const elegir=i=>{seleccion=reservas[i].id_reserva;ficha.replaceChildren(articulos[i]);const detalle=articulos[i].querySelector('details');if(detalle)detalle.open=true;
   botones.forEach((b,j)=>{b.setAttribute('aria-pressed',String(i===j));});
  };
  reservas.forEach((r,i)=>{const b=doc.createElement('button');b.type='button';b.className='reserva-opcion';
   const nombre=doc.createElement('strong');nombre.textContent=r.clienta;
   const fecha=doc.createElement('span');fecha.textContent=r.fecha_hora_inicio.slice(0,10)+' · '+r.fecha_hora_inicio.slice(11,16)+' · '+r.servicio;
   const estado=doc.createElement('span');estado.className='reserva-estado';estado.dataset.estado=r.estado;estado.textContent=raiz.MerakiAgenda.estado(r.estado);
   b.append(nombre,fecha,estado);
   if(r.puede_cerrar===true){const cerrar=doc.createElement('small');cerrar.className='reserva-por-cerrar';cerrar.textContent='Por cerrar';b.append(cerrar);}
   b.onclick=()=>elegir(i);botones.push(b);lista.append(b);
  });
  host.replaceChildren(lista,ficha);host.classList.add('reservas-maestro-detalle');
  const anterior=reservas.findIndex(r=>r.id_reserva===seleccion),pendiente=reservas.findIndex(r=>r.puede_cerrar===true);
  elegir(anterior>=0?anterior:pendiente>=0?pendiente:0);
 }
 raiz.MerakiReservaVisual={montar};
})(globalThis);
