(function(raiz){
    'use strict';
    const CAMPOS=Object.freeze(['id_reserva','id_servicio','servicio','id_trabajadora','trabajadora','estado','fecha_hora_inicio','fecha_hora_fin']);
    const ESTADOS=Object.freeze(['pendiente_abono','confirmada','atendida','no_atendida','cancelada']);
    const campoPermitido=new Set(CAMPOS),estadoPermitido=new Set(ESTADOS);
    const idValido=id=>Number.isSafeInteger(id)&&id>0;
    const compararTexto=(a,b)=>a<b?-1:a>b?1:0;
    function civilValido(valor){
        if(typeof valor!=='string'||valor.length!==19)return false;
        const p=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(valor);
        if(!p)return false;
        const [a,m,d,h,min,s]=p.slice(1).map(Number);
        const bisiesto=a%4===0&&(a%100!==0||a%400===0);
        const dias=[31,bisiesto?29:28,31,30,31,30,31,31,30,31,30,31];
        return a>=1&&m>=1&&m<=12&&d>=1&&d<=dias[m-1]&&h<=23&&min<=59&&s<=59;
    }
    function ordenarIncidencias(incidencias){
        const unicas=new Map(incidencias.map(i=>[JSON.stringify(i),i]));
        return [...unicas.values()].sort((a,b)=>compararTexto(JSON.stringify(a),JSON.stringify(b)));
    }
    function noDisponible(incidencias,inconsistente=false){
        return {estado:inconsistente?'inconsistente':'no_disponible',estadisticas:null,
            incidencias:ordenarIncidencias(incidencias),advertencias:[]};
    }
    function agrupar(reservas,campoId,campoNombre){
        const grupos=new Map();
        for(const r of reservas){
            const id=r[campoId];
            if(!grupos.has(id))grupos.set(id,{nombres:new Set(),reservas:0,
                porEstado:Object.fromEntries(ESTADOS.map(e=>[e,0]))});
            const grupo=grupos.get(id);
            grupo.nombres.add(r[campoNombre]);grupo.reservas++;grupo.porEstado[r.estado]++;
        }
        return [...grupos.entries()].sort(([a],[b])=>a-b).map(([id,g])=>{
            const nombres=[...g.nombres].sort(compararTexto);
            return {[campoId]:id,[campoNombre]:nombres.length===1?nombres[0]:null,nombres,
                reservas:g.reservas,porcentaje:Math.round(g.reservas/reservas.length*10000)/100,
                porEstado:g.porEstado};
        });
    }
    function lideres(grupos,campoId){
        const maximo=grupos.reduce((max,g)=>Math.max(max,g.reservas),0);
        return grupos.filter(g=>g.reservas===maximo).map(g=>g[campoId]);
    }
    function calcularEstadisticasReservas(reservas){
        if(!Array.isArray(reservas))return noDisponible([{codigo:'lista_no_disponible'}]);
        const incidencias=[],unicas=new Map();let conflicto=false;
        for(const fila of reservas){
            if(!fila||typeof fila!=='object'||Array.isArray(fila)){
                incidencias.push({codigo:'registro_invalido'});continue;
            }
            // No conservar referencias al registro original ni campos adicionales.
            const r=Object.fromEntries(CAMPOS.map(c=>[c,fila[c]]));
            const id=idValido(r.id_reserva)?{idReserva:r.id_reserva}:{};
            const errores=[];
            if(Object.keys(fila).some(c=>!campoPermitido.has(c)))errores.push({codigo:'campos_no_admitidos',...id});
            for(const campo of ['id_reserva','id_servicio','id_trabajadora']){
                if(!idValido(r[campo]))errores.push({codigo:'identificador_invalido',campo,...id});
            }
            for(const [campo,limite] of [['servicio',150],['trabajadora',100]]){
                if(typeof r[campo]!=='string'||!r[campo].trim()||r[campo].length>limite)
                    errores.push({codigo:'nombre_invalido',campo,...id});
            }
            if(!estadoPermitido.has(r.estado))errores.push({codigo:'estado_invalido',...id});
            const inicioValido=civilValido(r.fecha_hora_inicio),finValido=civilValido(r.fecha_hora_fin);
            if(!inicioValido||!finValido||r.fecha_hora_fin<=r.fecha_hora_inicio)
                errores.push({codigo:'intervalo_civil_invalido',...id});
            if(errores.length){incidencias.push(...errores);continue;}
            const firma=JSON.stringify(CAMPOS.map(c=>r[c]));
            if(unicas.has(r.id_reserva)){
                if(unicas.get(r.id_reserva).firma!==firma){
                    conflicto=true;incidencias.push({codigo:'reserva_contradictoria',idReserva:r.id_reserva});
                }
            }else unicas.set(r.id_reserva,{firma,registro:r});
        }
        if(incidencias.length)return noDisponible(incidencias,conflicto);
        const registros=[...unicas.values()].map(v=>v.registro);
        const porServicio=agrupar(registros,'id_servicio','servicio');
        const porProfesional=agrupar(registros,'id_trabajadora','trabajadora');
        const advertencias=[];
        for(const [tipo,grupos,campo] of [['servicio',porServicio,'id_servicio'],['profesional',porProfesional,'id_trabajadora']]){
            for(const grupo of grupos)if(grupo.nombres.length>1)advertencias.push({codigo:'nombres_multiples',tipo,id:grupo[campo]});
        }
        return {estado:'disponible',estadisticas:{
            totalReservasUnicas:registros.length,duplicadosOmitidos:reservas.length-registros.length,
            porServicio,porProfesional,
            serviciosMasReservados:lideres(porServicio,'id_servicio'),
            profesionalesMasReservados:lideres(porProfesional,'id_trabajadora')
        },incidencias:[],advertencias};
    }
    const api=Object.freeze({calcularEstadisticasReservas});
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
    else raiz.MerakiEstadisticasReservas=api;
})(typeof globalThis!=='undefined'?globalThis:this);
