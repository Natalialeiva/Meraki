// GENERADO: no editar. Fuente unica: preparacion/dashboard-reservas/presentacion.js. Regenerar copiando la fuente tras esta cabecera; las pruebas exigen igualdad exacta.
(function (raiz) {
    'use strict';
    const estadosReserva = new Set(['pendiente_abono','confirmada','atendida','no_atendida','cancelada']);
    const idValido = valor => Number.isSafeInteger(valor) && valor > 0;
    function congelar(valor) {
        if (valor && typeof valor === 'object') {
            Object.values(valor).forEach(congelar);
            Object.freeze(valor);
        }
        return valor;
    }
    function formatearSantiago(epochMs) {
        if (!Number.isSafeInteger(epochMs) || Math.abs(epochMs) > 8640000000000000) {
            throw new TypeError('Indica un instante válido de aceptación en milisegundos');
        }
        return new Intl.DateTimeFormat('es-CL', {
            timeZone:'America/Santiago', year:'numeric', month:'2-digit', day:'2-digit',
            hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
        }).format(epochMs) + ', hora de Santiago';
    }
    function crearPresentador() {
        let contexto = null, pendiente = null, revision = 0, anuncio = 0;
        let marca = null, ids = null, vista;
        function publicar(estado, total = null, visibles = null, foco = 'conservar') {
            const mensajes = {
                sin_contexto:'Selecciona un emprendimiento para consultar su agenda.',
                cambio_emprendimiento:'Cargando la agenda del emprendimiento seleccionado…',
                cargando:contexto ? `Cargando la agenda de ${contexto.nombre}…` : '',
                agenda_vacia:'Este emprendimiento todavía no tiene reservas.',
                filtros_sin_coincidencias:'No hay reservas para estos filtros.',
                actualizada:contexto ? `Agenda de ${contexto.nombre} actualizada. ${visibles} de ${total} reservas visibles.` : '',
                error_carga:'No pudimos cargar la agenda. Puedes volver a intentarlo.',
                error_actualizacion:'No pudimos actualizar la agenda. Los datos no están disponibles por ahora.',
                sesion_vencida:'Tu sesión venció. Inicia sesión para consultar la agenda.'
            };
            const ocupada = ['cargando','cambio_emprendimiento'].includes(estado);
            const mostrar = ['agenda_vacia','filtros_sin_coincidencias','actualizada'].includes(estado);
            const advertencia = estado === 'error_actualizacion'
                ? 'La actualización más reciente falló.' : ocupada && marca ? 'Actualización en curso.' : '';
            const ultima = !contexto ? {estado:'oculta',epochMs:null,texto:'',advertencia:''}
                : !marca ? {estado:'sin_actualizacion',epochMs:null,texto:'Sin actualización exitosa en esta sesión.',advertencia:''}
                : {estado:estado === 'error_actualizacion' ? 'fallida' : ocupada ? 'en_curso' : 'valida',
                    epochMs:marca.epochMs,
                    texto:`Última carga válida: ${contexto.nombre} — ${marca.texto}`,
                    advertencia};
            vista = congelar({
                estado, emprendimiento:contexto ? {id:contexto.id,nombre:contexto.nombre} : null,
                mensaje:mensajes[estado],
                acciones:estado === 'sesion_vencida' ? [{id:'iniciar_sesion',habilitada:true}]
                    : !contexto ? [{id:'seleccionar_emprendimiento',habilitada:true}]
                    : [...(estado === 'filtros_sin_coincidencias' ? [{id:'limpiar_filtros',habilitada:true}] : []),
                        {id:['error_carga','error_actualizacion'].includes(estado) ? 'reintentar' : 'actualizar',habilitada:!ocupada},
                        {id:'cambiar_emprendimiento',habilitada:true}],
                datos:{tratamiento:mostrar ? 'mostrar' : 'ocultar',total:mostrar ? total : null,
                    visibles:mostrar ? visibles : null,
                    indicadores:mostrar ? 'usar_agenda_completa' : 'no_disponibles'},
                ultimaActualizacion:ultima,
                foco:{accion:foco === 'conservar' ? 'conservar' : 'solicitar',destino:foco},
                accesibilidad:{role:'status',ariaLive:'polite',ariaAtomic:true,ariaBusy:ocupada,
                    anuncioId:++anuncio,texto:mensajes[estado]}
            });
        }
        function vigente(ticket) { return pendiente !== null && ticket === pendiente; }
        function fallar() {
            pendiente = null; ids = null;
            publicar(marca ? 'error_actualizacion' : 'error_carga');
        }
        function seleccionarIds(reservas) {
            if (!Array.isArray(reservas)) return null;
            const resultado = new Set();
            for (const r of reservas) {
                // Validación mínima del contrato actual. Las cadenas temporales
                // no se resuelven aquí: el módulo temporal mantiene sus exclusiones.
                if (!r || typeof r !== 'object' || !idValido(r.id_reserva) || resultado.has(r.id_reserva) ||
                    !estadosReserva.has(r.estado) || typeof r.fecha_hora_inicio !== 'string' ||
                    typeof r.fecha_hora_fin !== 'string' ||
                    (Object.hasOwn(r,'id_emprendimiento') && r.id_emprendimiento !== contexto.id)) return null;
                resultado.add(r.id_reserva);
            }
            return resultado;
        }
        function validarVisibles(visibles, conjunto) {
            if (!Array.isArray(visibles) || new Set(visibles).size !== visibles.length ||
                visibles.some(id => !conjunto.has(id))) throw new TypeError('Los resultados visibles deben pertenecer a la agenda aceptada');
            return visibles.length;
        }
        publicar('sin_contexto');
        return Object.freeze({
            obtenerEstado:() => vista,
            cambiarContexto({sesion,idEmprendimiento,nombre} = {}) {
                if (typeof sesion !== 'string' || !sesion.trim() || !idValido(idEmprendimiento) ||
                    typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 150) {
                    throw new TypeError('Se requiere contexto autorizado de sesión y emprendimiento');
                }
                contexto = {sesion,id:idEmprendimiento,nombre:nombre.trim()};
                revision++; pendiente = null; marca = null; ids = null;
                publicar('cambio_emprendimiento',null,null,'selector_emprendimiento');
                return vista;
            },
            iniciarCarga() {
                if (!contexto) throw new Error('Selecciona un contexto autorizado antes de cargar');
                if (pendiente) return pendiente;
                // Ticket opaco en memoria: conservar la referencia, no reconstruirla.
                pendiente = Object.freeze({revision:++revision});
                ids = null;
                publicar('cargando');
                return pendiente;
            },
            aceptarRespuesta(ticket, datos = {}) {
                if (!vigente(ticket)) return false;
                if (!datos || typeof datos !== 'object') { fallar(); return false; }
                const {reservas,idsVisibles,recibidoEnEpochMs,consultaAutorizada,respuestaExitosa} = datos;
                if (consultaAutorizada !== true || respuestaExitosa !== true) { fallar(); return false; }
                const conjunto = seleccionarIds(reservas);
                if (!conjunto) { fallar(); return false; }
                let texto, visibles;
                try {
                    texto = formatearSantiago(recibidoEnEpochMs);
                    visibles = idsVisibles === undefined ? conjunto.size : validarVisibles(idsVisibles,conjunto);
                } catch { fallar(); return false; }
                marca = {epochMs:recibidoEnEpochMs,texto}; ids = conjunto; pendiente = null;
                publicar(ids.size === 0 ? 'agenda_vacia' : visibles === 0 ? 'filtros_sin_coincidencias' : 'actualizada',ids.size,visibles);
                return true;
            },
            registrarError(ticket, {sesionVencida = false} = {}) {
                if (!vigente(ticket)) return false;
                if (sesionVencida === true) {
                    contexto = null; pendiente = null; marca = null; ids = null; revision++;
                    publicar('sesion_vencida',null,null,'acceso');
                } else fallar();
                return true;
            },
            aplicarFiltro(idsVisibles) {
                if (!ids || pendiente) return false;
                const visibles = validarVisibles(idsVisibles,ids);
                if (vista.datos.visibles === visibles) return true;
                publicar(ids.size === 0 ? 'agenda_vacia' : visibles === 0 ? 'filtros_sin_coincidencias' : 'actualizada',ids.size,visibles);
                return true;
            }
        });
    }
    const api = Object.freeze({crearPresentador,formatearSantiago});
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else raiz.MerakiPresentacionReservas = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
