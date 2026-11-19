// Carrusel manual: sin temporizadores, sin movimiento automático ni dependencias.
export function montarPortada(documento) {
    const portada=documento.querySelector('.hero-editorial');
    if(!portada)return;
    const slides=[...portada.querySelectorAll('[data-slide]')];
    let indice=0;
    const mostrar=paso=>{
        indice=(indice+paso+slides.length)%slides.length;
        slides.forEach((slide,i)=>{slide.hidden=i!==indice;});
        portada.querySelector('#heroContador').textContent=String(indice+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');
    };
    portada.querySelector('.hero-controles').hidden=false;
    portada.querySelector('[data-anterior]').onclick=()=>mostrar(-1);
    portada.querySelector('[data-siguiente]').onclick=()=>mostrar(1);
}
if(typeof document!=='undefined')montarPortada(document);
