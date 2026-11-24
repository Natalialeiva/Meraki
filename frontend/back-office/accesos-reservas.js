(function(){
 const boton=document.getElementById('bajarDashboard'),destino=document.getElementById('resumenDashboardIntegrado');
 if(boton&&destino)boton.onclick=()=>{destino.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});const titulo=destino.querySelector('.titulo-resumen-integrado');if(titulo){titulo.setAttribute('tabindex','-1');titulo.focus({preventScroll:true});}};
})();
