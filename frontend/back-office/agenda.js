(function (raiz) {
    const nombres = {pendiente_abono:'Pendiente de abono',confirmada:'Confirmada',atendida:'Atendida',no_atendida:'No atendida',cancelada:'Cancelada',pendiente:'Pendiente',aprobado:'Aprobado',rechazado:'Rechazado',anulado:'Anulado'};
    function estado(valor) { return nombres[valor] || valor || 'Sin abono'; }
    function filtrar(reservas, fecha, estadoElegido) {
        return reservas.filter(r => (!fecha || r.fecha_hora_inicio.slice(0,10) === fecha) && (!estadoElegido || r.estado === estadoElegido));
    }
    function acciones(reserva) {
        const lista = [];
        if (reserva.puede_cancelar === true) lista.push({accion:'cancelar',texto:'Cancelar reserva'});
        if (reserva.puede_cerrar === true) lista.push({accion:'atender',texto:'Marcar atendida'},{accion:'no-atendida',texto:'Marcar no atendida'});
        return lista;
    }
    const api = {estado,filtrar,acciones};
    if (typeof module !== 'undefined' && module.exports) module.exports=api;
    else raiz.MerakiAgenda=api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
