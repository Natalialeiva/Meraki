(function(raiz){
    const vistas={
        reservas:{hash:'tituloReservas',titulo:'Reservas',descripcion:'Tu agenda y tus próximas atenciones, en un solo lugar.'},
        dashboard:{hash:'tituloDashboard',titulo:'Dashboard',descripcion:'Reservas, tendencias y valores históricos del emprendimiento seleccionado.'},
        servicios:{hash:'tituloServicios',titulo:'Servicios',descripcion:'Organiza lo que ofreces, sus precios y sus tiempos de atención.'},
        equipo:{hash:'tituloTrabajadoras',titulo:'Tu equipo',descripcion:'Administra a tus profesionales y los servicios que realiza cada una.'},
        horarios:{hash:'tituloHorarios',titulo:'Horarios y bloqueos',descripcion:'Define cuándo atiende tu equipo y organiza sus días disponibles.'},
        pagos:{hash:'tituloPagos',titulo:'Revisión de pagos',descripcion:'Consulta el estado de los abonos y revisa los que necesitan atención.'},
        notificaciones:{hash:'tituloNotificaciones',titulo:'Notificaciones',descripcion:'Revisa las confirmaciones de reserva y el estado de sus correos.'},
        perfil:{hash:'tituloPerfil',titulo:'Perfil del negocio',descripcion:'Mantén al día la información que ven tus clientas en el catálogo.'},
        suscripcion:{hash:'tituloSuscripcion',titulo:'Tu suscripción',descripcion:'Consulta tu plan, la tarjeta inscrita y el historial de cobros.'}
    };
    function resolver(hash){return Object.keys(vistas).find(id=>vistas[id].hash===String(hash||'').replace(/^#/,''))||'reservas';}
    function montar({contenedor,menu,titulo,descripcion,ventana=window,alCambiar=()=>{}}){
        function dibujar(id,enfocar){
            if(!Object.hasOwn(vistas,id))id='reservas';
            for(const panel of contenedor.querySelectorAll('[data-vista]'))panel.hidden=panel.dataset.vista!==id;
            for(const link of menu.querySelectorAll('[data-destino]')){
                if(link.dataset.destino===id)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
            }
            titulo.textContent=vistas[id].titulo;descripcion.textContent=vistas[id].descripcion;
            alCambiar(id);
            if(enfocar){contenedor.querySelector('[data-vista="'+id+'"] h2')?.focus({preventScroll:true});ventana.scrollTo({top:0,behavior:'auto'});}
        }
        function mostrar(id){
            if(!Object.hasOwn(vistas,id))id='reservas';
            dibujar(id,true);
            const hash='#'+vistas[id].hash;
            if(ventana.location.hash!==hash)ventana.location.hash=hash;
        }
        for(const link of menu.querySelectorAll('[data-destino]'))link.addEventListener('click',e=>{e.preventDefault();mostrar(link.dataset.destino);});
        ventana.addEventListener('hashchange',()=>{
            if(ventana.location.hash==='#tituloVista'){titulo.focus({preventScroll:true});ventana.scrollTo({top:0,behavior:'auto'});return;}
            dibujar(resolver(ventana.location.hash),true);
        });
        return {mostrar,iniciar:()=>dibujar(resolver(ventana.location.hash),false)};
    }
    const modulo={resolver,montar};
    if(typeof module!=='undefined'&&module.exports)module.exports=modulo;else raiz.MerakiNavegacion=modulo;
})(typeof globalThis!=='undefined'?globalThis:this);
