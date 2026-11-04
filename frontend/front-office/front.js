const $=selector=>document.querySelector(selector);
const estado=$('#estado');
let negocio=null,servicios=[],creada=false,enviando=false;
let versionBusqueda=0,versionSeleccion=0,versionProfesional=0,versionHoras=0;
const dinero=valor=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(Number(valor));
async function api(url,method='GET',datos){
    const respuesta=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:datos?JSON.stringify(datos):undefined});
    let d;try{d=JSON.parse(await respuesta.text());}catch{throw Error('No se pudo leer la respuesta del servidor. Intenta nuevamente.');}
    if(!respuesta.ok)throw Error(d.mensaje||'No se pudo completar la operación');
    return d;
}
function opciones(elemento,datos,clave,etiqueta=v=>v.nombre){
    elemento.replaceChildren();
    if(!datos.length){const o=document.createElement('option');o.value='';o.textContent='Sin opciones disponibles';elemento.append(o);}
    for(const dato of datos){const o=document.createElement('option');o.value=dato[clave];o.textContent=etiqueta(dato);o.disabled=dato.reservable===false;elemento.append(o);}
}
function limpiarHoras(){versionHoras++;opciones($('#hora'),[],'hora');$('#confirmarDatos').checked=false;resumen();}
function resumen(){
    const servicio=servicios.find(s=>String(s.id_servicio)===$('#servicio').value);
    const nombreProfesional=$('#profesional').selectedOptions[0]?.textContent;
    const correo=$('#formReserva input[name="correo"]').value.trim();
    const panel=$('#resumen');panel.replaceChildren();
    const lineas=[negocio?.nombre||'Selecciona un emprendimiento',servicio?servicio.servicio+' · Servicio '+dinero(servicio.precio)+' · Abono '+dinero(servicio.monto_abono):'Selecciona un servicio disponible',
        $('#profesional').value?'Profesional: '+nombreProfesional:'Selecciona un profesional',
        $('#fecha').value&&$('#hora').value?'Fecha: '+$('#fecha').value+' · Hora: '+$('#hora').value.slice(0,5):'Consulta y selecciona una hora',
        correo?'Confirmación para: '+correo:'Escribe y revisa tu correo'];
    for(const texto of lineas){const p=document.createElement('p');p.textContent=texto;panel.append(p);}
    $('#crearReserva').disabled=creada||enviando||!servicio||servicio.reservable===false||!$('#profesional').value||!$('#hora').value||!$('#confirmarDatos').checked;
}
async function profesionales(){
    const version=++versionProfesional;
    opciones($('#profesional'),[],'id_trabajadora');limpiarHoras();
    $('#disponibilidad').disabled=true;
    const servicio=servicios.find(s=>String(s.id_servicio)===$('#servicio').value);
    if(!servicio||servicio.reservable===false){$('#avisoServicio').textContent='Este servicio no tiene profesionales disponibles. Elige otro servicio.';return;}
    $('#avisoServicio').textContent='Buscando profesionales…';
    const datos=await api('/api/servicios/'+servicio.id_servicio+'/trabajadoras');
    if(version!==versionProfesional)return;
    opciones($('#profesional'),datos,'id_trabajadora');
    $('#disponibilidad').disabled=!datos.length;
    $('#avisoServicio').textContent=datos.length?'Selecciona una fecha para consultar horas.':'Este servicio no tiene profesionales disponibles.';
    resumen();
}
async function seleccionar(dato){
    if(enviando)return;
    const version=++versionSeleccion;versionProfesional++;limpiarHoras();
    negocio=dato;creada=false;servicios=[];
    $('#camposReserva').disabled=false;$('#consulta').hidden=true;$('#nuevaReserva').hidden=true;$('#reserva').hidden=true;
    estado.textContent='Cargando servicios de '+dato.nombre+'…';
    const datos=await api('/api/emprendimientos/'+dato.id_emprendimiento+'/servicios');
    if(version!==versionSeleccion)return;
    servicios=datos;opciones($('#servicio'),datos,'id_servicio',s=>s.servicio+' · '+dinero(s.precio)+' · Abono '+dinero(s.monto_abono)+(s.reservable===false?' · Sin profesionales disponibles':''));
    const primera=datos.find(s=>s.reservable!==false);$('#servicio').value=primera?String(primera.id_servicio):'';
    $('#tituloReserva').textContent='Reserva en '+dato.nombre;$('#reserva').hidden=false;
    estado.textContent=primera?'Elige servicio, fecha y hora.':'Este emprendimiento todavía no tiene servicios con profesionales disponibles.';
    await profesionales();
}
$('#buscar').onsubmit=async evento=>{
    evento.preventDefault();if(enviando)return;
    const version=++versionBusqueda;versionSeleccion++;versionProfesional++;limpiarHoras();
    $('#reserva').hidden=true;$('#resultados').replaceChildren();estado.textContent='Buscando emprendimientos…';
    try{
        const filtros=new URLSearchParams(new FormData(evento.target));
        const datos=await api('/api/emprendimientos?'+filtros);
        if(version!==versionBusqueda)return;
        for(const d of datos){const a=document.createElement('article'),h=document.createElement('h2'),p=document.createElement('p'),b=document.createElement('button');h.textContent=d.nombre;p.textContent=[d.descripcion,d.comuna,d.direccion].filter(Boolean).join(' · ');b.type='button';b.textContent='Ver servicios y reservar';b.onclick=()=>seleccionar(d).catch(error=>estado.textContent=error.message);a.append(h,p,b);$('#resultados').append(a);}
        estado.textContent=datos.length?datos.length+' emprendimiento(s). Selecciona uno para ver sus servicios.':'No encontramos emprendimientos con esos filtros. Prueba solo con el nombre o pulsa Ver todos.';
    }catch(error){if(version===versionBusqueda)estado.textContent=error.message;}
};
$('#limpiarBusqueda').onclick=()=>{if(enviando)return;$('#buscar').reset();$('#buscar').requestSubmit();};
$('#servicio').onchange=()=>profesionales().catch(error=>estado.textContent=error.message);
$('#profesional').onchange=$('#fecha').onchange=limpiarHoras;
$('#hora').onchange=()=>{$('#confirmarDatos').checked=false;resumen();};
$('#confirmarDatos').onchange=resumen;
for(const campo of $('#formReserva').querySelectorAll('input[name]'))campo.oninput=()=>{$('#confirmarDatos').checked=false;resumen();};
$('#disponibilidad').onclick=async()=>{
    const version=++versionHoras;
    opciones($('#hora'),[],'hora');$('#confirmarDatos').checked=false;resumen();
    if(!$('#fecha').value){estado.textContent='Selecciona una fecha antes de consultar horas.';return;}
    const parametros=new URLSearchParams({id_servicio:$('#servicio').value,id_trabajadora:$('#profesional').value,fecha:$('#fecha').value});
    estado.textContent='Consultando horas disponibles…';
    try{const datos=await api('/api/disponibilidad?'+parametros);if(version!==versionHoras)return;opciones($('#hora'),datos.map(d=>({hora:d.hora_inicio})),'hora',d=>d.hora.slice(0,5));estado.textContent=datos.length?'Revisa tu selección y completa tus datos.':'No hay horas disponibles. Prueba otra fecha o profesional.';resumen();}
    catch(error){if(version===versionHoras)estado.textContent=error.message;}
};
$('#formReserva').onsubmit=async evento=>{
    evento.preventDefault();if(enviando||creada||$('#crearReserva').disabled)return;
    const datos=Object.fromEntries(new FormData(evento.target));
    const reserva={id_servicio:Number($('#servicio').value),id_trabajadora:Number($('#profesional').value),fecha:$('#fecha').value,hora:$('#hora').value.slice(0,5)};
    enviando=true;$('#camposReserva').disabled=true;
    try{
        const cliente=await api('/api/clientas','POST',datos);
        const d=await api('/api/reservas','POST',{...reserva,id_clienta:cliente.id_clienta,nombre_clienta:datos.nombre});
        creada=true;$('#consulta').href='/consulta/#'+encodeURIComponent(d.reserva.token_consulta);$('#consulta').hidden=false;$('#nuevaReserva').hidden=false;
        estado.textContent='Reserva '+d.reserva.id_reserva+' creada y pendiente de abono. Guarda el enlace privado y continúa con Webpay. Todavía no se ha realizado un cobro.';
    }catch(error){estado.textContent=error.message;$('#camposReserva').disabled=false;}
    finally{enviando=false;resumen();}
};
$('#nuevaReserva').onclick=()=>{if(enviando)return;$('#formReserva').reset();seleccionar(negocio).catch(error=>estado.textContent=error.message);};
$('#fecha').min=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
$('#buscar').requestSubmit();
