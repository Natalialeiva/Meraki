const mensajes = {
    aprobado:['Abono aprobado','Tu abono fue aprobado y tu reserva está confirmada.'],
    rechazado:['Abono rechazado','El abono no fue aprobado. Consulta tu reserva antes de intentar nuevamente.'],
    pendiente:['Abono pendiente','El pago sigue pendiente. Consulta tu reserva para revisar su estado.'],
    abandonado:['Pago interrumpido','El pago se interrumpió o quedó sin confirmación. Consulta tu reserva antes de intentar nuevamente.'],
    incierto:['Pago en revisión','Aún no podemos confirmar el resultado del abono. Espera la verificación antes de intentar pagar nuevamente.'],
    conexion:['Resultado por verificar','No pudimos comprobar el resultado del abono. Consulta tu reserva antes de intentar pagar nuevamente.'],
    no_disponible:['Resultado no disponible','No se pudo consultar este resultado.']
};

const volver=document.querySelector('#volver');
const ayuda=document.querySelector('#ayuda');
const prefijo='meraki:webpay:';
const enlaceValido=/^\/consulta\/#([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
let version=0;

async function mostrar(){
    const actual=++version;
    volver.hidden=true;
    volver.removeAttribute('href');
    volver.onclick=null;
    ayuda.hidden=false;
    document.querySelector('#titulo').textContent='Resultado del abono';
    document.querySelector('#mensaje').textContent='Consultando el resultado…';
    let datos;
    try{
        const referencia=location.hash.slice(1);
        if(/^[A-Za-z0-9_-]{39,512}$/.test(referencia)){
            const r=await fetch('/api/abonos/resultado',{headers:{'X-Meraki-Resultado':referencia},cache:'no-store'});
            if(r.ok)datos=await r.json();
        }
    }catch{}
    if(actual!==version)return;
    const valido=datos&&Object.hasOwn(mensajes,datos.estado)&&datos.estado!=='no_disponible';
    const [titulo,mensaje]=mensajes[valido?datos.estado:'no_disponible'];
    document.querySelector('#titulo').textContent=titulo;
    document.querySelector('#mensaje').textContent=mensaje;
    ayuda.textContent='Puedes abrir el enlace privado original de tu reserva.';
    if(!valido||!(/^[A-Za-z0-9_-]{43}$/.test(datos.correlacion)))return;
    try{
        const clave=prefijo+datos.correlacion;
        const item=JSON.parse(sessionStorage.getItem(clave));
        if(!(item?.vence>Date.now())){sessionStorage.removeItem(clave);return;}
        if(typeof item.enlace!=='string'||!enlaceValido.test(item.enlace))return;
        volver.href=item.enlace;
        volver.hidden=false;
        ayuda.hidden=true;
        volver.onclick=()=>{try{sessionStorage.removeItem(clave);}catch{}};
    }catch{}
}

globalThis.addEventListener?.('hashchange',mostrar);
mostrar();
