(function(raiz) {
    'use strict';
    const DIA=86400000;
    const ZONA='America/Santiago';
    const commonJS=typeof module!=='undefined' && module.exports;

    function disponible() {
        const t=raiz.Temporal;
        return typeof t?.Instant?.fromEpochMilliseconds==='function' &&
            typeof t?.PlainDateTime?.from==='function' &&
            typeof t?.ZonedDateTime?.prototype?.getTimeZoneTransition==='function';
    }

    function resolverHorasCiviles(grupos) {
        if (!disponible()) throw Error('Temporal no disponible');
        const {Instant,PlainDateTime}=raiz.Temporal;
        const zonal=ms=>Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(ZONA);
        for (const [dia,horarios] of grupos) {
            // Misma ventana semiabierta que el resolvedor exhaustivo.
            const fin=dia+2*DIA;
            const segmentos=[];
            for (let inicio=dia-DIA;inicio<fin;) {
                const zonificada=zonal(inicio);
                const siguiente=zonificada.getTimeZoneTransition('next');
                const hasta=Math.min(fin,siguiente?.epochMilliseconds??fin);
                if (hasta<=inicio) throw Error('Transición no progresiva');
                segmentos.push({inicio,hasta,offset:zonificada.offsetNanoseconds/1e6});
                inicio=hasta;
            }
            for (const horario of horarios.values()) {
                const civil=PlainDateTime.from(new Date(horario.civilMs).toISOString().slice(0,-1));
                for (const {inicio,hasta,offset} of segmentos) {
                    const candidato=horario.civilMs-offset;
                    if (Number.isInteger(candidato) && candidato>=inicio && candidato<hasta &&
                        zonal(candidato).toPlainDateTime().equals(civil)) {
                        horario.instantes.push(candidato);
                    }
                }
            }
        }
    }

    function calcularResumenOperativo(entrada) {
        const resumen=commonJS?require('./resumen.js'):raiz.MerakiResumen;
        return resumen.calcularResumenOperativo(entrada,resolverHorasCiviles);
    }

    const api={disponible,resolverHorasCiviles,calcularResumenOperativo};
    if (commonJS) module.exports=api;
    else raiz.MerakiResumenTemporal=api;
})(globalThis);
