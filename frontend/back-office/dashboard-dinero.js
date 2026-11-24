(function(raiz){
 'use strict';
 const estados=['confirmada','pendiente_abono','atendida','no_atendida','cancelada'];
 const etiquetas={confirmada:'Confirmadas',pendiente_abono:'Pendientes de abono',atendida:'Atendidas',no_atendida:'No atendidas',cancelada:'Canceladas'};
 const colores={confirmada:'var(--chart-atendida)',pendiente_abono:'var(--chart-pendiente)',atendida:'var(--chart-confirmada)',no_atendida:'var(--chart-no-atendida)',cancelada:'var(--chart-cancelada)'};
 function dibujar(doc,mensual,reservas,api){
  const padre=doc.getElementById('contenidoDashboard');if(!padre)return;
  let host=doc.getElementById('dineroVisual');if(!host){host=doc.createElement('section');host.id='dineroVisual';padre.append(host);}host.replaceChildren();
  const crear=(tag,texto,clase)=>{const n=doc.createElement(tag);if(texto!==undefined)n.textContent=texto;if(clase)n.className=clase;return n;};
  const titulo=crear('h3','Dinero'),info=crear('details',undefined,'ayuda-dinero');info.append(crear('summary','Cómo leer los importes'),crear('p','Valores históricos de reservas del mes de atención. No representan cobros ni liquidaciones bancarias.'));host.append(titulo,info);
  const eco=mensual.economia;if(mensual.estado!=='disponible'||eco?.estado!=='disponible'){host.append(crear('p','Importes no disponibles para este período.'));return;}
  const kpis=crear('div',undefined,'dinero-indicadores');
  const atendidas=eco.porEstado.atendida;
  for(const [titulo,valor,nota]of [
   ['Valor atendido',atendidas.servicios,'Reservas atendidas'],
   ['Confirmado',eco.porEstado.confirmada.servicios,'Valor de reservas confirmadas'],
   ['Pendiente de abono',eco.porEstado.pendiente_abono.servicios,'Valor de reservas pendientes'],
   ['Ticket promedio',atendidas.reservas?Math.round(atendidas.servicios/atendidas.reservas):0,'Por reserva atendida'],
   ['Cancelado',eco.porEstado.cancelada.servicios,'Valor de reservas canceladas']
  ]){const card=crear('article');const estado={'Valor atendido':'atendida','Confirmado':'confirmada','Pendiente de abono':'pendiente_abono','Cancelado':'cancelada'}[titulo];card.style.background=estado?colores[estado]:'var(--sky)';card.append(crear('strong',api.clp(valor)),crear('span',titulo),crear('small',nota));kpis.append(card);}host.append(kpis);
  const grid=crear('div',undefined,'dinero-graficos');host.append(grid);
  const panel=t=>{const n=crear('section',undefined,'dinero-panel');n.append(crear('h3',t));grid.append(n);return n;};
  const total=estados.reduce((a,e)=>a+eco.porEstado[e].servicios,0),porcentaje=n=>total?n/total*100:0;
  const donaPanel=panel('Dinero por estado'),dona=crear('div',undefined,'dona-reservas');let inicio=0;const tramos=[];
  for(const e of estados){const fin=inicio+porcentaje(eco.porEstado[e].servicios);tramos.push(colores[e]+' '+inicio+'% '+fin+'%');inicio=fin;}
  dona.style.background=total?'conic-gradient('+tramos.join(',')+')':'var(--line)';dona.setAttribute('aria-hidden','true');const centro=crear('strong',api.clp(total),'total-dona-dinero');dona.append(centro);donaPanel.append(dona);
  for(const e of estados)if(eco.porEstado[e].servicios){const fila=crear('p',undefined,'leyenda-dinero'),punto=crear('span',undefined,'punto-leyenda-dinero');punto.style.background=colores[e];punto.setAttribute('aria-hidden','true');fila.append(punto,crear('span',etiquetas[e]+': '+api.clp(eco.porEstado[e].servicios)+' · '+new Intl.NumberFormat('es-CL',{maximumFractionDigits:1}).format(porcentaje(eco.porEstado[e].servicios))+' %'));donaPanel.append(fila);}
  const mensualPanel=panel('Dinero por mes'),barras=crear('div',undefined,'meses-dinero');mensualPanel.append(barras);
  const max=Math.max(1,...mensual.serie.map(m=>m.estado==='disponible'?estados.reduce((a,e)=>a+m.porEstado[e].servicios,0):0));
  for(const m of mensual.serie){const col=crear('div',undefined,'mes-dinero');if(m.estado!=='disponible'){col.append(crear('span','No disponible'));}else{const valor=estados.reduce((a,e)=>a+m.porEstado[e].servicios,0);col.append(crear('small',api.clp(valor)));const bar=crear('div',undefined,'mes-dinero-barra');bar.style.height=String(150*valor/max)+'px';for(const e of estados){const segmento=crear('span');segmento.style.flexGrow=String(m.porEstado[e].servicios);segmento.style.background=colores[e];bar.append(segmento);}col.append(bar);}col.append(crear('small',m.periodo));barras.append(col);}
  const filas=reservas.filter(r=>r.fecha_hora_inicio.slice(0,7)===mensual.periodo),unicas=[...new Map(filas.map(r=>[r.id_reserva,r])).values()];
  for(const [campo,nombre,titulo]of [['id_servicio','servicio','Por servicio'],['id_trabajadora','trabajadora','Por profesional']]){
   const p=panel(titulo),grupos=new Map();for(const r of unicas){if(!grupos.has(r[campo]))grupos.set(r[campo],{nombre:r[nombre],total:0,estados:Object.fromEntries(estados.map(e=>[e,0]))});const g=grupos.get(r[campo]),n=api.centavos(r.precio_servicio);if(n!==null){g.total+=n;g.estados[r.estado]+=n;}}
   for(const g of [...grupos.values()].sort((a,b)=>b.total-a.total)){const fila=crear('article',undefined,'fila-dinero');fila.append(crear('h4',g.nombre),crear('p',api.clp(g.total)+' · '+new Intl.NumberFormat('es-CL',{maximumFractionDigits:1}).format(porcentaje(g.total))+' %'));const bar=crear('div',undefined,'barra-estados');for(const e of estados){const seg=crear('span');seg.style.flexGrow=String(g.estados[e]);seg.style.background=colores[e];bar.append(seg);}fila.append(bar);p.append(fila);}if(!grupos.size)p.append(crear('p','Sin reservas en este período.'));
  }
 }
 raiz.MerakiDineroVisual={dibujar};
})(globalThis);
