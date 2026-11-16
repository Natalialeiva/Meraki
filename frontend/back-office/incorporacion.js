(function(raiz){
 function montar({registro,negocio,login,estado,api,alCrearNegocio,estadoRegistro=estado,estadoNegocio=estado}){
  const leer=(form,nombres)=>Object.fromEntries(nombres.map(k=>[k,form.elements.namedItem(k).value]));
  let registrando=false,creando=false;
  registro.onsubmit=async e=>{
   e.preventDefault();if(registrando||!registro.reportValidity())return;
   const d=leer(registro,['nombre','apellido','rut','correo','password','telefono']);
   if(d.password!==registro.elements.namedItem('confirmacion').value){estadoRegistro.textContent='Las contraseñas deben coincidir.';return;}
   registrando=true;registro.querySelector('fieldset').disabled=true;
   estadoRegistro.textContent='Creando cuenta…';
   try{await api('/api/auth/registro','POST',d);registro.reset();estadoRegistro.textContent='';registro.closest?.('details')?.removeAttribute('open');login.elements.namedItem('correo').value=d.correo.trim();estado.textContent='Cuenta creada. Inicia sesión para registrar tu emprendimiento.';login.elements.namedItem('correo').focus?.();}
   catch(error){estadoRegistro.textContent=error.message;}
   finally{registrando=false;registro.querySelector('fieldset').disabled=false;}
  };
  negocio.onsubmit=async e=>{
   e.preventDefault();if(creando||!negocio.reportValidity())return;
   const d=leer(negocio,['nombre','comuna','direccion','descripcion','telefono','latitud','longitud']);
   if(!d.latitud.trim()&&!d.longitud.trim()){d.latitud=null;d.longitud=null;}
   creando=true;negocio.querySelector('fieldset').disabled=true;
   estadoNegocio.textContent='Guardando emprendimiento…';
   try{await api('/api/emprendimientos','POST',d);negocio.reset();estadoNegocio.textContent='Emprendimiento creado.';try{await alCrearNegocio();estado.textContent='';}catch{estadoNegocio.textContent='El negocio se guardó. Actualiza la página para cargar tu perfil.';}}
   catch(error){estadoNegocio.textContent=error.message;}
   finally{creando=false;negocio.querySelector('fieldset').disabled=false;}
  };
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={montar};else raiz.MerakiIncorporacion={montar};
})(typeof globalThis!=='undefined'?globalThis:this);
