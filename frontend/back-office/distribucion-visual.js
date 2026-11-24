(function(raiz){
 'use strict';
 const estados=['confirmada','pendiente_abono','atendida','no_atendida','cancelada'];
 function presentar(doc,estadisticas){
  const host=doc.getElementById('distribucionReservas');if(!host)return;
  let controles=host.querySelector('.selector-distribucion');
  if(!controles){
   controles=doc.createElement('div');controles.className='selector-distribucion';controles.setAttribute('role','group');controles.setAttribute('aria-label','Agrupar reservas');
   for(const [nombre,id]of [['Por servicio','distribucionServicios'],['Por profesional','distribucionProfesionales']]){const b=doc.createElement('button');b.type='button';b.textContent=nombre;b.dataset.destino=id;b.onclick=()=>{
    for(const btn of controles.children){const activo=btn===b;btn.setAttribute('aria-pressed',String(activo));doc.getElementById(btn.dataset.destino).parentElement.hidden=!activo;}
   };controles.append(b);}
   host.querySelector('h3').after(controles);controles.children[0].click();
  }
  const dashboard=Boolean(host.closest('[data-vista="dashboard"]'));
  controles.hidden=dashboard;
  if(dashboard)for(const id of ['distribucionServicios','distribucionProfesionales'])doc.getElementById(id).parentElement.hidden=false;
  for(const [id,grupos]of [['distribucionServicios',estadisticas.porServicio],['distribucionProfesionales',estadisticas.porProfesional]]){
   const articulos=doc.getElementById(id).children;
   grupos.forEach((g,i)=>{const articulo=articulos[i];if(!articulo)return;
    const anterior=articulo.querySelector('.barra-estados');anterior?.remove();
    const barra=doc.createElement('div');barra.className='barra-estados';barra.setAttribute('aria-hidden','true');
    for(const estado of estados){const n=g.porEstado[estado];if(!n)continue;const tramo=doc.createElement('span');tramo.dataset.estado=estado;tramo.style.flexGrow=String(n);barra.append(tramo);}
    const meter=articulo.querySelector('meter');meter.after(barra);
    articulo.querySelector('details')?.removeAttribute('open');
   });
  }
 }
 raiz.MerakiDistribucionVisual={presentar};
})(globalThis);
