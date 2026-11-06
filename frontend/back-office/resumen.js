(function(raiz) {
    'use strict';
    const DIA=86400000;
    const objeto=valor=>valor!==null && typeof valor==='object' && !Array.isArray(valor);
    const idValido=valor=>Number.isSafeInteger(valor) && valor>0;
    const proxima=(estado,motivo=null,reserva=null,inicioEpochMs=null)=>({estado,motivo,reserva,inicioEpochMs});
    function noDisponible(motivo) {
        return {idEmprendimiento:null,reservasPorCerrar:{estado:'no_disponible',cantidad:null},
            proximaAtencion:proxima('no_disponible',motivo),exclusiones:null};
    }
    // Solo sintaxis civil del backend, con segundos opcionales; nunca Date(texto).
    function fechaCivil(texto) {
        if (typeof texto!=='string') return null;
        const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(texto);
        if (!m) return null;
        const [ano,mes,dia,hora,minuto,segundo]=m.slice(1).map((v,i)=>i===5 && v===undefined?0:Number(v));
        if (ano<1 || mes<1 || mes>12 || dia<1 || dia>31 || hora>23 || minuto>59 || segundo>59) return null;
        const fecha=new Date(0);
        fecha.setUTCFullYear(ano,mes-1,dia);fecha.setUTCHours(hora,minuto,segundo,0);
        if (fecha.getUTCFullYear()!==ano || fecha.getUTCMonth()!==mes-1 || fecha.getUTCDate()!==dia) return null;
        const civilMs=fecha.getTime();fecha.setUTCHours(0,0,0,0);
        return {civilMs,diaMs:fecha.getTime()};
    }
    function formateadores() {
        const opciones={calendar:'gregory',numberingSystem:'latn',year:'numeric',month:'2-digit',day:'2-digit',
            hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',era:'short'};
        const chile=new Intl.DateTimeFormat('en-GB',{...opciones,timeZone:'America/Santiago'});
        const utc=new Intl.DateTimeFormat('en-GB',{...opciones,timeZone:'UTC'});
        if (chile.resolvedOptions().timeZone!=='America/Santiago') throw Error('Zona no disponible');
        return {chile,utc};
    }
    // Búsqueda exhaustiva a resolución de SEGUNDO (la resolución de la API).
    // ±24 h no es un offset supuesto: encierra los offsets IANA de Santiago.
    // Une las ventanas de 3 días UTC, recorriendo una sola vez cada segundo:
    // cero coincidencias = inexistente; más de una = ambiguo. Incluye offsets
    // históricos con segundos, sin muestrear transiciones ni fijar UTC-3/UTC-4.
    function resolver(grupos,relojes) {
        const objetivos=new Map(), ventanas=[];
        for (const [diaMs,horarios] of grupos) {
            const inicio=diaMs-DIA, fin=diaMs+2*DIA;
            ventanas.push({inicio,fin});
            for (const horario of horarios.values()) {
                const llave=relojes.utc.format(horario.civilMs);
                objetivos.set(llave,{instantes:horario.instantes,inicio,fin});
            }
        }
        ventanas.sort((a,b)=>a.inicio-b.inicio);
        const unidas=[];
        for (const ventana of ventanas) {
            const anterior=unidas[unidas.length-1];
            if (anterior && ventana.inicio<=anterior.fin) anterior.fin=Math.max(anterior.fin,ventana.fin);
            else unidas.push({...ventana});
        }
        for (const {inicio,fin} of unidas) {
            for (let instante=inicio;instante<fin;instante+=1000) {
                const destino=objetivos.get(relojes.chile.format(instante));
                // Mantiene exactamente el intervalo semiabierto original de
                // cada objetivo, incluso al unir ventanas de otros días.
                if (destino && instante>=destino.inicio && instante<destino.fin) destino.instantes.push(instante);
            }
        }
    }
    function calcularResumenOperativo(entrada) {
        const {reservas,contexto,ahoraEpochMs}=objeto(entrada)?entrada:{};
        if (!objeto(contexto) || !idValido(contexto.idEmprendimientoConsultado) ||
            !idValido(contexto.idEmprendimientoSeleccionado) || contexto.consultaAutorizada!==true ||
            contexto.idEmprendimientoConsultado!==contexto.idEmprendimientoSeleccionado) return noDisponible('contexto_no_valido');
        if (contexto.respuestaExitosa!==true || !Array.isArray(reservas)) return noDisponible('respuesta_no_disponible');
        const resultado={idEmprendimiento:contexto.idEmprendimientoConsultado,
            reservasPorCerrar:{estado:'disponible',cantidad:reservas.filter(r=>objeto(r) && r.puede_cerrar===true).length},
            proximaAtencion:proxima('sin_proximas'),exclusiones:null};
        if (!Number.isSafeInteger(ahoraEpochMs) || !Number.isFinite(new Date(ahoraEpochMs).getTime())) {
            resultado.proximaAtencion=proxima('no_disponible','referencia_temporal_no_valida');return resultado;
        }
        let relojes;
        try {relojes=formateadores();} catch {
            resultado.proximaAtencion=proxima('no_disponible','zona_horaria_no_disponible');return resultado;
        }
        const exclusiones={registrosInvalidos:0,fechasInvalidas:0,horariosInexistentes:0,horariosAmbiguos:0};
        resultado.exclusiones=exclusiones;
        const grupos=new Map(), confirmadas=[];
        for (const [indice,r] of reservas.entries()) {
            if (!objeto(r)) {exclusiones.registrosInvalidos++;continue;}
            if (r.estado!=='confirmada') continue;
            const civil=fechaCivil(r.fecha_hora_inicio);
            if (!civil) {exclusiones.fechasInvalidas++;continue;}
            if (!grupos.has(civil.diaMs)) grupos.set(civil.diaMs,new Map());
            const grupo=grupos.get(civil.diaMs);
            if (!grupo.has(civil.civilMs)) grupo.set(civil.civilMs,{...civil,instantes:[]});
            confirmadas.push({reserva:r,indice,horario:grupo.get(civil.civilMs)});
        }
        try {resolver(grupos,relojes);} catch {
            resultado.proximaAtencion=proxima('no_disponible','zona_horaria_no_disponible');
            resultado.exclusiones=null;return resultado;
        }
        const futuras=[], indeterminadas=[];
        for (const dato of confirmadas) {
            const instantes=dato.horario.instantes;
            if (instantes.length===1) {
                if (instantes[0]>ahoraEpochMs) futuras.push({...dato,inicio:instantes[0]});
            } else if (instantes.length===0) {
                exclusiones.horariosInexistentes++;indeterminadas.push(dato);
            } else {
                exclusiones.horariosAmbiguos++;indeterminadas.push(dato);
            }
        }
        futuras.sort((a,b)=>a.inicio-b.inicio ||
            (idValido(a.reserva.id_reserva)?a.reserva.id_reserva:Infinity)-(idValido(b.reserva.id_reserva)?b.reserva.id_reserva:Infinity) || a.indice-b.indice);
        const mejor=futuras[0];
        const datosDesconocidos=exclusiones.fechasInvalidas>0 || exclusiones.registrosInvalidos>0;
        const puedeAdelantarse=indeterminadas.some(({horario})=>{
            if (horario.instantes.length) return horario.instantes.some(t=>t>ahoraEpochMs && (!mejor || t<=mejor.inicio));
            // No se "corrige" un horario inexistente. Sus límites solo permiten
            // demostrar que no puede preceder a otra atención inequívoca.
            return horario.civilMs+DIA>ahoraEpochMs && (!mejor || horario.civilMs-DIA<=mejor.inicio);
        });
        if (datosDesconocidos || puedeAdelantarse || (!mejor && indeterminadas.length>0)) {
            resultado.proximaAtencion=proxima('pendiente_revision','registros_temporalmente_indeterminados');
        } else if (mejor) {
            const r=mejor.reserva, copia={fecha_hora_inicio:r.fecha_hora_inicio};
            // Proyección independiente: no conserva referencias ni devuelve datos de clientas.
            if (idValido(r.id_reserva)) copia.id_reserva=r.id_reserva;
            for (const campo of ['servicio','trabajadora']) if (typeof r[campo]==='string') copia[campo]=r[campo];
            resultado.proximaAtencion=proxima('disponible',null,copia,mejor.inicio);
        }
        return resultado;
    }
    const api={calcularResumenOperativo};
    if (typeof module!=='undefined' && module.exports) module.exports=api;
    else raiz.MerakiResumen=api;
})(typeof globalThis!=='undefined'?globalThis:this);
