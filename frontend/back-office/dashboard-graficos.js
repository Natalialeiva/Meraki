(function(raiz){
    'use strict';
    const estados=['pendiente_abono','confirmada','atendida','no_atendida','cancelada'];
    const etiquetas={pendiente_abono:'Pendiente de abono',confirmada:'Confirmada',atendida:'Atendida',no_atendida:'No atendida',cancelada:'Cancelada'};
    const colores=['#846086','#456b63','#416b88','#8a6540','#9a4f65'];
    const clp=centavos=>new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:2}).format(centavos/100);
    function mesActualSantiago(ahora=Date.now()){
        const partes=new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',year:'numeric',month:'2-digit'}).formatToParts(new Date(ahora));
        return partes.find(p=>p.type==='year').value.padStart(4,'0')+'-'+partes.find(p=>p.type==='month').value.padStart(2,'0');
    }
    function centavos(valor){
        if(typeof valor!=='string'&&typeof valor!=='number')return null;
        const m=/^(\d+)(?:\.(\d{1,2}))?$/.exec(String(valor));
        if(!m)return null;
        const n=Number(m[1])*100+Number((m[2]||'').padEnd(2,'0'));
        return Number.isSafeInteger(n)&&n<=9999999999?n:null;
    }
    // La agenda y sus fechas/estados ya fueron validados por el cálculo existente.
    // Solo se añaden agrupación mensual y importes históricos, sin HTTP ni pagos.
    function calcularComplementos(reservas,estadisticas){
        const unicas=new Map(),meses=new Map();let fiable=true;
        for(const r of reservas){
            const importe=centavos(r.precio_servicio),abono=centavos(r.monto_abono);
            if(unicas.has(r.id_reserva)){
                const previa=unicas.get(r.id_reserva);
                if(previa.importe!==importe||previa.abono!==abono)fiable=false;
                continue;
            }
            unicas.set(r.id_reserva,{...r,importe,abono});
            const mes=r.fecha_hora_inicio.slice(0,7);meses.set(mes,(meses.get(mes)||0)+1);
            if(importe===null||abono===null||abono>importe)fiable=false;
        }
        if(unicas.size!==estadisticas.totalReservasUnicas)fiable=false;
        const porEstado=Object.fromEntries(estados.map(e=>[e,{reservas:0,servicios:0,abonos:0}]));
        let sinCanceladas=0,activas=0,abonosActivas=0;
        for(const r of unicas.values()){
            if(!porEstado[r.estado]){fiable=false;continue;}
            const g=porEstado[r.estado];g.reservas++;
            if(r.importe===null||r.abono===null)continue;
            g.servicios+=r.importe;g.abonos+=r.abono;
            if(r.estado!=='cancelada')sinCanceladas+=r.importe;
            if(['confirmada','pendiente_abono'].includes(r.estado)){activas+=r.importe;abonosActivas+=r.abono;}
        }
        if(![sinCanceladas,activas,abonosActivas,...Object.values(porEstado).flatMap(g=>[g.servicios,g.abonos])].every(Number.isSafeInteger))fiable=false;
        return {serieMensual:[...meses].sort(([a],[b])=>a.localeCompare(b)).map(([periodo,cantidad])=>({periodo,cantidad})),
            economia:fiable?{estado:'disponible',sinCanceladas,activas,abonosActivas,porEstado}:{estado:'no_disponible'}};
    }
    function limpiar({seleccionar:$}){
        for(const id of ['graficoEstados','evolucionReservas','detalleEconomico','comparacionEconomica','evolucionEconomica'])$('#'+id).replaceChildren();
        $('#estadoEconomico').textContent='Resumen económico no disponible hasta recibir una agenda válida.';
        $('#datosEconomicos').hidden=true;
        for(const id of ['valorServicios','valorReservasActivas','abonosActivos'])$('#'+id).textContent='—';
    }
    function periodosMensuales(periodo){
        if(typeof periodo!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo))return null;
        const indice=Number(periodo.slice(0,4))*12+Number(periodo.slice(5))-1;
        if(indice<17)return null;
        const meses=[];
        for(let i=indice-5;i<=indice;i++){
            meses.push(String(Math.floor(i/12)).padStart(4,'0')+'-'+String(i%12+1).padStart(2,'0'));
        }
        return meses;
    }
    function calcularSerieReservas(reservas,periodo){
        const meses=periodosMensuales(periodo);if(!meses)return null;
        const cantidades=new Map(meses.map(m=>[m,0])),vistas=new Set();
        for(const r of reservas){
            if(vistas.has(r.id_reserva))continue;vistas.add(r.id_reserva);
            const mes=r.fecha_hora_inicio.slice(0,7);
            if(cantidades.has(mes))cantidades.set(mes,cantidades.get(mes)+1);
        }
        return meses.map(periodo=>({periodo,cantidad:cantidades.get(periodo)}));
    }
    function calcularMensual(reservas,periodo){
        const meses=periodosMensuales(periodo);if(!meses)return {estado:'no_disponible'};
        const serie=[];
        for(const mes of meses){
            const filas=reservas.filter(r=>r.fecha_hora_inicio.slice(0,7)===mes);
            const economia=calcularComplementos(filas,{totalReservasUnicas:new Set(filas.map(r=>r.id_reserva)).size}).economia;
            serie.push({periodo:mes,...economia});
        }
        return {estado:'disponible',periodo,serie,economia:serie.at(-1)};
    }
    function dibujar({reservas,estadisticas:s,reservasEconomicas=reservas,periodo=mesActualSantiago(),seleccionar:$,documento:doc}){
        limpiar({seleccionar:$});
        const crear=(tag,texto)=>{const el=doc.createElement(tag);if(texto!==undefined)el.textContent=texto;return el;};
        const cantidades=Object.fromEntries(estados.map(e=>[e,s.porServicio.reduce((n,g)=>n+g.porEstado[e],0)]));
        const lista=crear('ul');lista.className='leyenda-grafico';
        let desde=0;const segmentos=[];
        for(const [i,e] of estados.entries()){
            const n=cantidades[e],p=s.totalReservasUnicas?n/s.totalReservasUnicas*100:0;
            const li=crear('li',etiquetas[e]+': '+n+' · '+new Intl.NumberFormat('es-CL',{maximumFractionDigits:1}).format(p)+' %');
            li.setAttribute('style','--color-estado:'+colores[i]);lista.append(li);
            segmentos.push(colores[i]+' '+desde+'% '+(desde+p)+'%');desde+=p;
        }
        if(s.totalReservasUnicas){
            const dona=crear('div');dona.className='dona-reservas';dona.setAttribute('aria-hidden','true');
            dona.setAttribute('style','background:conic-gradient('+segmentos.join(',')+')');$('#graficoEstados').append(dona);
        }else $('#graficoEstados').append(crear('p','Sin reservas para representar.'));
        $('#graficoEstados').append(lista);
        const serie=calcularSerieReservas(reservasEconomicas,periodo)||[];
        const tabla=crear('table'),titulo=crear('caption','Cantidad de reservas por mes de atención — seis meses hasta '+periodo+' (Santiago)');
        tabla.append(titulo);const cabecera=crear('tr');
        for(const texto of ['Mes de atención','Cantidad de reservas']){const th=crear('th',texto);th.setAttribute('scope','col');cabecera.append(th);}tabla.append(cabecera);
        for(const punto of serie){const fila=crear('tr'),mes=crear('th',punto.periodo);mes.setAttribute('scope','row');fila.append(mes,crear('td',String(punto.cantidad)));tabla.append(fila);}
        if(serie.some(p=>p.cantidad>0)){
            const svg=tag=>doc.createElementNS?doc.createElementNS('http://www.w3.org/2000/svg',tag):doc.createElement(tag);
            const grafico=svg('svg');grafico.setAttribute('viewBox','0 0 600 180');grafico.setAttribute('aria-hidden','true');grafico.classList?.add('linea-reservas');
            grafico.setAttribute('class','linea-reservas');
            const indice=p=>Number(p.slice(0,4))*12+Number(p.slice(5,7));
            const primero=indice(serie[0].periodo),rango=indice(serie.at(-1).periodo)-primero,max=Math.max(...serie.map(p=>p.cantidad));
            const eje=svg('line');eje.setAttribute('x1','30');eje.setAttribute('y1','150');eje.setAttribute('x2','570');eje.setAttribute('y2','150');eje.setAttribute('stroke','#b6a6bd');grafico.append(eje);
            for(const [texto,x,y,ancla] of [[String(max),6,30,'start'],['0',6,153,'start'],[serie[0].periodo,30,175,'start'],...(serie.length>1?[[serie.at(-1).periodo,570,175,'end']]:[])]){
                const etiqueta=svg('text');etiqueta.textContent=texto;etiqueta.setAttribute('x',String(x));etiqueta.setAttribute('y',String(y));etiqueta.setAttribute('text-anchor',ancla);etiqueta.setAttribute('font-size','14');etiqueta.setAttribute('fill','#503957');grafico.append(etiqueta);
            }
            const puntos=serie.map(p=>({x:rango?30+(indice(p.periodo)-primero)/rango*540:300,y:150-p.cantidad/max*120}));
            const linea=svg('polyline');linea.setAttribute('points',puntos.map(p=>p.x+','+p.y).join(' '));linea.setAttribute('fill','none');linea.setAttribute('stroke','#775269');linea.setAttribute('stroke-width','3');grafico.append(linea);
            for(const p of puntos){const circulo=svg('circle');circulo.setAttribute('cx',String(p.x));circulo.setAttribute('cy',String(p.y));circulo.setAttribute('r','5');circulo.setAttribute('fill','#775269');grafico.append(circulo);}
            $('#evolucionReservas').append(grafico);
        }else $('#evolucionReservas').append(crear('p',serie.length?'Sin reservas en estos seis meses para el estado seleccionado. La tabla muestra los seis valores cero.':'Selecciona un mes y año válidos en el Resumen económico.'));
        if(serie.length)$('#evolucionReservas').append(tabla);
        const mensual=calcularMensual(reservasEconomicas,periodo),eco=mensual.economia;
        if(mensual.estado!=='disponible'){
            $('#estadoEconomico').textContent='Selecciona un mes y año válidos para consultar el resumen mensual.';return;
        }
        if(eco.estado!=='disponible'){
            $('#estadoEconomico').textContent='Los importes históricos están incompletos o son inconsistentes. No se muestran sumas parciales.';return;
        }
        const cantidad=Object.values(eco.porEstado).reduce((n,g)=>n+g.reservas,0);
        $('#estadoEconomico').textContent='Mes de atención '+periodo+': '+cantidad+' reserva(s). '+(cantidad?'Importes históricos válidos.':'Sin reservas; valores iguales a cero.');
        $('#datosEconomicos').hidden=false;
        for(const [id,cantidad] of [['valorServicios',eco.sinCanceladas],['valorReservasActivas',eco.activas],['abonosActivos',eco.abonosActivas]])$('#'+id).textContent=clp(cantidad);
        const desglose=crear('table');desglose.append(crear('caption','Valores históricos por estado, incluidas canceladas cuando el filtro las muestra'));
        const h=crear('tr');for(const texto of ['Estado','Servicios (CLP)','Abonos requeridos (CLP)']){const th=crear('th',texto);th.setAttribute('scope','col');h.append(th);}desglose.append(h);
        for(const e of estados){const fila=crear('tr'),nombre=crear('th',etiquetas[e]);nombre.setAttribute('scope','row');fila.append(nombre,crear('td',clp(eco.porEstado[e].servicios)),crear('td',clp(eco.porEstado[e].abonos)));desglose.append(fila);}
        $('#detalleEconomico').append(desglose);
        const maximo=Math.max(eco.activas,eco.abonosActivas,1);
        for(const [nombre,valor] of [['Servicios de reservas activas',eco.activas],['Abonos contractuales de reservas activas',eco.abonosActivas]]){
            const fila=crear('div'),barra=crear('meter');fila.className='comparacion-monto';
            barra.setAttribute('min','0');barra.setAttribute('max',String(maximo));barra.setAttribute('value',String(valor));barra.setAttribute('aria-hidden','true');
            fila.append(crear('p',nombre+': '+clp(valor)),barra);$('#comparacionEconomica').append(fila);
        }
        const tablaMeses=crear('table');tablaMeses.append(crear('caption','Seis meses hasta '+periodo+' — proyecciones contractuales, no ingresos'));
        const encabezado=crear('tr');
        for(const texto of ['Mes de atención','Reservas activas (CLP)','Abonos esperados contractuales (CLP)']){const th=crear('th',texto);th.setAttribute('scope','col');encabezado.append(th);}tablaMeses.append(encabezado);
        for(const mes of mensual.serie){const fila=crear('tr'),th=crear('th',mes.periodo);th.setAttribute('scope','row');fila.append(th,crear('td',mes.estado==='disponible'?clp(mes.activas):'No disponible'),crear('td',mes.estado==='disponible'?clp(mes.abonosActivas):'No disponible'));tablaMeses.append(fila);}
        if(mensual.serie.every(m=>m.estado==='disponible')){
            const svg=tag=>doc.createElementNS?doc.createElementNS('http://www.w3.org/2000/svg',tag):doc.createElement(tag);
            const grafico=svg('svg');grafico.setAttribute('viewBox','0 0 640 220');grafico.setAttribute('class','linea-reservas');grafico.setAttribute('aria-hidden','true');
            const pico=Math.max(...mensual.serie.flatMap(m=>[m.activas,m.abonosActivas])),escala=Math.max(pico,1);
            for(const [campo,color] of [['activas','#775269'],['abonosActivas','#aa617e']]){
                const puntos=mensual.serie.map((m,i)=>({x:90+i*100,y:170-m[campo]/escala*130}));
                const linea=svg('polyline');linea.setAttribute('points',puntos.map(p=>p.x+','+p.y).join(' '));linea.setAttribute('fill','none');linea.setAttribute('stroke',color);linea.setAttribute('stroke-width','3');if(campo==='abonosActivas')linea.setAttribute('stroke-dasharray','7 4');grafico.append(linea);
                for(const p of puntos){const punto=svg('circle');punto.setAttribute('cx',String(p.x));punto.setAttribute('cy',String(p.y));punto.setAttribute('r','4');punto.setAttribute('fill',color);grafico.append(punto);}
            }
            for(const [texto,x,y] of [[clp(pico),2,30],[clp(0),2,175],[mensual.serie[0].periodo,70,205],[periodo,550,205]]){const etiqueta=svg('text');etiqueta.textContent=texto;etiqueta.setAttribute('x',String(x));etiqueta.setAttribute('y',String(y));etiqueta.setAttribute('font-size','14');etiqueta.setAttribute('fill','#503957');grafico.append(etiqueta);}
            $('#evolucionEconomica').append(crear('p','Línea continua: valor de reservas activas. Línea discontinua: abonos contractuales esperados. Meses sin reservas: cero.'),grafico);
        }else $('#evolucionEconomica').append(crear('p','No se traza la evolución: hay meses con importes no disponibles; no se sustituyen por cero.'));
        $('#evolucionEconomica').append(tablaMeses);
    }
    const api={calcularComplementos,calcularMensual,calcularSerieReservas,periodosMensuales,mesActualSantiago,centavos,clp,dibujar,limpiar};
    if(typeof module!=='undefined'&&module.exports)module.exports=api;else raiz.MerakiDashboardGraficos=api;
})(typeof globalThis!=='undefined'?globalThis:this);
