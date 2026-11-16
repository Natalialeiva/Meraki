(function(raiz){
 function montar({contenedor,api,puedeConfigurar=()=>true,urls=URL,confirmar=confirm}){
  const campo=contenedor.querySelector('input'),preview=contenedor.querySelector('img'),estado=contenedor.querySelector('[data-estado-foto]'),titulo=contenedor.querySelector('[data-titulo-foto]');
  const guardar=contenedor.querySelector('[data-guardar-foto]'),quitar=contenedor.querySelector('[data-quitar-foto]'),cancelar=contenedor.querySelector('[data-cancelar-foto]');
  let servicio=null,imagen=null,archivo=null,blob=null,ocupado=false,version=0;
  const segura=url=>typeof url==='string'&&/^\/media\/servicios\/[a-f0-9-]{36}\.webp$/.test(url);
  const revocar=()=>{if(blob){urls.revokeObjectURL(blob);blob=null;}};
  function controles(){campo.disabled=ocupado||!puedeConfigurar();guardar.disabled=ocupado||!archivo||!puedeConfigurar();quitar.disabled=ocupado||!imagen||!puedeConfigurar();cancelar.disabled=ocupado;}
  function mostrar(){preview.hidden=!blob&&!imagen;if(blob||imagen)preview.src=blob||imagen.url;else preview.removeAttribute('src');controles();}
  function cerrar(){version++;revocar();archivo=null;imagen=null;servicio=null;ocupado=false;campo.value='';contenedor.hidden=true;}
  async function abrir(s){if(ocupado)return;cerrar();servicio=s.id_servicio;const actual=++version;contenedor.hidden=false;titulo.textContent='Fotografía de '+s.servicio;estado.textContent='Cargando fotografía…';ocupado=true;controles();
   try{const d=await api('/api/servicios/'+servicio+'/imagen');if(actual!==version)return;imagen=segura(d.imagen?.url)?d.imagen:null;estado.textContent=imagen?'Puedes reemplazar o retirar la fotografía.':'Este servicio todavía no tiene fotografía.';}
   catch(e){if(actual===version)estado.textContent=e.message;}
   finally{if(actual===version){ocupado=false;mostrar();if(!puedeConfigurar())estado.textContent+=' Para subir, reemplazar o retirar fotografías, necesitas una suscripción vigente. Puedes revisar su estado en Suscripción.';contenedor.scrollIntoView?.({block:'start',behavior:'smooth'});titulo.setAttribute?.('tabindex','-1');titulo.focus?.({preventScroll:true});}}
  }
  campo.onchange=()=>{revocar();archivo=null;const f=campo.files?.[0];if(!f){mostrar();return;}
   if(!['image/jpeg','image/png','image/webp'].includes(f.type)||! /\.(jpe?g|png|webp)$/i.test(f.name)||f.size>5*1024*1024||!f.size){estado.textContent='Selecciona JPG, PNG o WebP de hasta 5 MB.';campo.value='';mostrar();return;}
   archivo=f;blob=urls.createObjectURL(f);estado.textContent='Vista previa. La fotografía se valida al guardarla.';mostrar();
  };
  preview.onerror=()=>{if(blob){revocar();archivo=null;campo.value='';estado.textContent='No se pudo mostrar el archivo seleccionado. Elige otra imagen.';mostrar();}else{preview.hidden=true;preview.removeAttribute('src');estado.textContent='La fotografía guardada no está disponible. Revisa los archivos del almacenamiento o elige otra imagen.';}};
  async function ejecutar(eliminar){if(ocupado||!servicio||!puedeConfigurar()||(!eliminar&&!archivo))return;if(eliminar&&!confirmar('¿Retirar la fotografía de este servicio?'))return;
   const actual=version,id=servicio;ocupado=true;controles();
   try{const d=await api('/api/servicios/'+id+'/imagen',eliminar?'DELETE':'PUT',eliminar?undefined:archivo);if(actual!==version)return;
    revocar();archivo=null;campo.value='';imagen=segura(d.imagen?.url)?d.imagen:null;estado.textContent=d.mensaje||'Fotografía actualizada.';
   }catch(e){if(actual===version){revocar();archivo=null;campo.value='';estado.textContent=e.message+' Cierra y vuelve a consultar la fotografía antes de reintentar.';}}
   finally{if(actual===version){ocupado=false;mostrar();}}
  }
  guardar.onclick=()=>ejecutar(false);quitar.onclick=()=>ejecutar(true);cancelar.onclick=()=>{if(!ocupado)cerrar();};
  cerrar();return {abrir,cerrar,actualizarPermisos:controles};
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={montar};else raiz.MerakiFotografias={montar};
})(typeof globalThis!=='undefined'?globalThis:this);
