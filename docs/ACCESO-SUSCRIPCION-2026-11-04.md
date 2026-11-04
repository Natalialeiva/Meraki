# Restricciones por suscripción — 4 de noviembre de 2026

## Política aprobada por Natalia

- Durante el mes gratuito o un período pagado vigente: nuevas reservas y configuración habilitadas.
- Al vencer sin un pago aprobado: no se crean reservas nuevas ni se modifican servicios, trabajadoras, asignaciones, horarios o bloqueos.
- Se conserva la consulta de agenda e historial y la gestión de citas existentes según sus reglas habituales.
- Pagos de reservas ya creadas, retornos Webpay, recuperación de pagos y notificaciones existentes no se bloquean por la suscripción.
- Se conserva el acceso a facturación, inscripción de tarjeta, cancelación de renovación y reintento consentido.
- Cancelar la renovación no recorta el período ya vigente.
- Un pago mensual aprobado actualiza la vigencia y restablece el acceso sin una intervención administrativa.
- Sin una suscripción registrada no se conceden permisos de configuración ni nuevas reservas. La cuenta debe iniciar su mes gratuito mediante la inscripción correspondiente; no se asignaron pruebas gratuitas a cuentas locales manualmente.

## Implementación

`backend/acceso-suscripcion.js` consulta la fecha `acceso_hasta` usando el día actual de Chile. No depende únicamente de la etiqueta `estado` ni de `renovacion_automatica`: una renovación cancelada con período vigente sigue permitiendo operar.

Las mutaciones de `/api/servicios`, `/api/trabajadoras`, `/api/horarios` y `/api/bloqueos` requieren sesión y vigencia. Una suscripción no habilitada devuelve 402 con código `SUSCRIPCION_REQUERIDA`. Los controles de propiedad de cada ruta siguen vigentes.

`POST /api/reservas` comprueba la vigencia del negocio dueño del servicio, independientemente de la sesión de quien reserva. Si no admite reservas devuelve 409 con un mensaje público genérico: no revela su estado de facturación. La consulta de disponibilidad devuelve lista vacía. La disponibilidad transaccional vuelve a verificar la vigencia antes de crear la cita. El catálogo mantiene su estructura y marca `reservable:false` cuando no hay vigencia.

`GET /api/suscripcion` devuelve `capacidades.crear_reservas` y `capacidades.configurar`. El Back Office informa el acceso restringido y deja servicios, trabajadoras y horarios de consulta. La agenda conserva sus acciones habituales. El estado de suscripción se actualiza cada 60 segundos mientras la página esté visible; una respuesta 402 vuelve a consultar la vigencia.

El perfil de contacto del negocio no está incluido en el bloqueo de configuración acordado. No se modificaron los archivos de Front Office asignados a Adriana; ese frontend puede consumir las respuestas y errores existentes. Su etiqueta actual para un servicio no reservable es genérica respecto a profesionales disponibles; la presentación de motivos de indisponibilidad puede coordinarse con Adriana sin exponer facturación a las clientas.

## Pruebas

Resultado completo: **128 casos aprobados y 2 grupos de integración**. Node informa **130 pass, 0 fail, 0 skipped**. Registro: `pruebas-acceso-suscripcion-2026-11-04.txt`.

Casos nuevos:

1. Suscripción vencida: trece operaciones de configuración rechazadas; nueva reserva rechazada y disponibilidad vacía. Agenda, consulta privada, configuración en lectura, notificaciones y consulta de pagos siguen disponibles. No se modifican abonos existentes; una cita anterior puede marcarse atendida.
2. Renovación cancelada con vigencia futura: configuración y reservas habilitadas. Restablecer vigencia permite operar nuevamente.
3. Interfaz de servicios: consulta sin vigencia, mutaciones bloqueadas y habilitación al restaurar acceso.
4. Interfaz de trabajadoras/asignaciones: consulta permitida, cambios bloqueados.
5. Interfaz de horarios/bloqueos: consulta permitida, cambios bloqueados.

Los casos de suscripciones también verifican capacidades habilitadas tras pago aprobado, deshabilitadas tras rechazo al vencer y conservadas tras cancelar un período vigente.

Las pruebas usan esquemas temporales; los planes vigentes necesarios para los escenarios operativos se preparan solo en esos esquemas. Oneclick, Webpay y SMTP están simulados. No se modificaron suscripciones ni pagos del esquema principal.

No requiere una migración adicional: utiliza las columnas de la migración 008 ya aplicada. Sintaxis JavaScript y `git diff --check` correctos.

## Activación local verificada

La primera solicitud de reinicio fue rechazada. Después de la instrucción explícita de Natalia «hazlo», se reinició el servidor y se verificó Back Office HTTP 200 y bloqueo de nueva reserva HTTP 409 con código `RESERVAS_NO_DISPONIBLES` para un negocio sin vigencia. La solicitud de comprobación era incompleta y no creó ninguna reserva. Las restricciones están activas.

Sin commit, push, pull ni reset. Revisar junto con los bloques pendientes de trabajadoras, horarios y suscripciones en GitHub Desktop.
