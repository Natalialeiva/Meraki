(function(raiz){
    'use strict';
    function montar(documento,ventana){
        for(const enlace of documento.querySelectorAll('a[href="#buscar"],a[href="#resultados"]')){
            enlace.addEventListener('click',evento=>{
                if(evento.button>0||evento.ctrlKey||evento.metaKey||evento.shiftKey||evento.altKey)return;
                const hash=enlace.getAttribute('href');
                const destino=documento.querySelector(hash);
                const foco=hash==='#buscar'?documento.getElementById('busquedaEmprendimientos'):destino;
                if(!destino||!foco)return;
                evento.preventDefault();
                ventana.location.hash=hash;
                destino.scrollIntoView({block:'start',behavior:ventana.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
                foco.focus({preventScroll:true});
            });
        }
    }
    if(typeof module!=='undefined'&&module.exports)module.exports={montar};
    else montar(raiz.document,raiz);
})(globalThis);
