# Reserva invitada: contrato propuesto y laboratorio aislado

**Diseño pendiente de aprobación compartida; no desplegar este prototipo.**
No cambia las rutas reales, Front Office, módulos financieros ni bases conservadas.
Complementa el README de preparación existente: sus reglas de mensajes, recuperación,
accesibilidad y ausencia de envíos automáticos siguen vigentes.

## 1. Decisión de identidad

La reserva invitada guarda un contacto declarado, no una identidad verificada.
No consulta si el correo existe en `clienta`, no vincula por correo, no actualiza
perfiles y no devuelve `id_clienta`. Un correo conocido y uno nuevo recorren
exactamente la misma operación. Los registros históricos no se reclasifican
como verificados por el hecho de conservar un `id_clienta`.

No basta con envolver el `ON CONFLICT(correo)` actual y la reserva en una transacción:
eso aún atribuiría la cita a una identidad existente sin acreditar su propiedad.
Una futura vinculación a cuenta exigiría un mecanismo separado de verificación.

## 2. API propuesta (no activada)

Inicializar contexto anónimo por una acción explícita:
`POST /api/reservas/invitada/contexto`, respuesta 204 con cookie opaca firmada,
HttpOnly, SameSite=Lax y Secure en HTTPS. No devuelve contactos ni IDs.
El contexto demuestra continuidad del navegador, no propiedad del correo.

Crear o recuperar un intento:
`POST /api/reservas/invitada`, JSON y cabecera `Idempotency-Key: <UUID v4>`.

```json
{
  "contacto": {"nombre": "Invitada ficticia", "correo": "invitada@example.test", "telefono": null},
  "id_servicio": 1,
  "id_trabajadora": 1,
  "fecha": "2030-11-18",
  "hora": "10:00"
}
```

Se rechazan campos adicionales, incluidos `id_clienta`, estado, precio y monto
impuestos. Los importes y la pertenencia del servicio/profesional se leen del servidor.
Validación mínima: nombre 100, correo 150, teléfono opcional 20; trim, correo
en minúsculas, calendario válido y hora HH:MM. No quitar puntos/sufijos del correo.

Primera creación: 201. Recuperación: 200 con el mismo ID y estado actual, que puede
ser pendiente, confirmada o cancelada. La diferencia 200/201 describe el intento,
no la existencia de un correo. Respuesta mínima bajo `reserva`:

- `id_reserva`, `token_consulta`, `estado`, `monto_abono`.
- `fecha_hora_inicio_civil`, `fecha_hora_fin_civil`, `zona_horaria`.
- Sin contacto, `id_clienta`, cookie, huellas ni datos financieros internos.

La interfaz actual solo usa ID/token al confirmar; debe sustituir sus dos POST por
este contrato y ajustar los mensajes. No activar un fallback al contrato antiguo.
El token se presenta mediante `/consulta/#…`, nunca en logs o almacenamiento
persistente del frontend. La API debe responder `Cache-Control: no-store` y aplicar
la política de referencia privada del proyecto.

Errores de negocio propuestos:

| HTTP | Código | Conducta |
| --- | --- | --- |
| 400 | DATOS_INVALIDOS / CLAVE_INVALIDA | Corregir campos; no enviar datos internos. |
| 401 | CONTEXTO_NO_DISPONIBLE | No crear contexto/clave sustitutos automáticamente. |
| 409 | HORARIO_NO_DISPONIBLE | Rechazo terminal guardado; permite otra selección explícita. |
| 409 | CLAVE_CONTENIDO_DISTINTO | No repetir con contenido cambiado. |
| 409 | ENLACE_REQUIERE_REVISION | No entregar un token rotado mediante una clave antigua. |
| 410 | INTENTO_VENCIDO | No implica que la reserva no exista; requiere recuperación acordada. |
| 429 | LIMITE_INTENTOS | Esperar y conservar clave; producción debe definir Retry-After. |
| 503/red | RESULTADO_NO_CONFIRMADO | Resultado incierto: repetir misma clave, contexto y contenido. |

Los nombres y mensajes son propuestas; deben acordarse con Natalia antes del cambio.

## 3. Persistencia propuesta

`propuesta.sql` es exclusivamente de laboratorio, sin número oficial de migración:

1. Permitir `reserva.id_clienta=NULL` para nuevas invitadas, conservando la FK y
   todos los valores históricos. No eliminar ni recrear `clienta` ni su índice único.
2. Nueva `contacto_reserva_invitada`, PK/FK por `id_reserva`, con nombre, correo y
   teléfono declarados. No tiene unicidad por correo ni implica verificación.
3. Nueva `intento_reserva_invitada`: PK de hash de contexto y hash de clave, huella
   HMAC del contenido normalizado, estado, referencia a reserva, hash del token,
   fechas y código terminal. No guarda el cuerpo completo ni otro token en claro.

Se conservan en la reserva `nombre_clienta` y `correo_confirmacion` como instantánea
compatible. La cardinalidad contacto-reserva del nuevo flujo se garantiza mediante
la transacción y la PK/FK; el SQL propuesto no impone con un trigger la existencia
de contacto para cualquier escritura directa de una reserva con clienta nula.
Revisar todos los escritores y permisos antes de producción; este punto no queda
resuelto únicamente por hacer nullable la columna.

## 4. Transacción e idempotencia

1. Validar contexto firmado, clave y cuerpo; normalizar antes de calcular huella.
2. BEGIN y confirmación durable; tomar candado por contexto+clave.
3. Buscar intento antes de consultar disponibilidad o límites de nuevas creaciones.
4. Si existe, comparar huella, vigencia y hash del token actual. Recuperar la misma
   reserva sin crear contactos, abonos, notificaciones ni otro token.
5. Si es nuevo, crear intento y tomar el candado existente `(117,id_trabajadora)`.
6. Reutilizar la disponibilidad real del repositorio, vigencia, bloqueos, fechas
   futuras de Santiago, pertenencia y valores del servicio.
7. Si no hay horario, confirmar solo el rechazo terminal del intento.
8. Si hay horario, insertar reserva, contacto e intento completado en la misma
   transacción. Un fallo intermedio revierte los tres. Las secuencias pueden tener
   huecos por un rollback; no representan contactos o reservas huérfanos.
9. COMMIT antes de responder. Una respuesta perdida se recupera con el mismo POST.

La PK completa, no el hash reducido del candado, determina identidad de operación.
Dos claves que compiten por un horario se serializan con el mismo candado utilizado
por reservas y bloqueos actuales. No se modifica la lógica financiera.

El laboratorio propone 24 horas de recuperación y 7 días para el contexto. Son
valores por acordar, no una política aprobada. No implementa tareas de borrado.
Para eliminar tombstones en producción hay que conservarlos hasta superar toda
la vida de su contexto (por ejemplo, al menos ocho días desde el intento con estos
plazos), rechazar contextos vencidos y no renovar automáticamente una solicitud
incierta. Una clave antigua no debe volverse nueva después de purgar registros.

Un contexto distinto no recupera tokens, aunque conozca clave y contenido. Cambiar
o perder el contexto deja la recuperación pendiente; no se promete recuperación
entre dispositivos o tras cerrar la pestaña. No persistir contacto/clave/token en
localStorage para resolverlo sin un acuerdo de privacidad y autorización.

El contexto del prototipo usa un secreto aleatorio exclusivo de prueba. Producción
debe acordar derivación por propósito/gestión y rotación de claves, cookie y cuotas.
No se generó ni modificó configuración privada de Meraki.

## 5. Consumidores y compatibilidad

| Consumidor | Resultado y cambio necesario |
| --- | --- |
| Consulta privada y cancelación por token | Rutas originales funcionan sin cambios con reserva invitada. La cancelación con abono sigue bloqueada. |
| Inicio y procesamiento de abonos | Módulos originales funcionan con `id_reserva`, token, estado e importes; no necesitan `id_clienta`. Probado únicamente con proveedor simulado. |
| Agenda autenticada | El INNER JOIN actual con clienta omite invitadas. Cambiar a LEFT JOIN y añadir contacto de reserva, conservando propiedad, IDs de servicio/profesional y campos anteriores. |
| Notificaciones | El JOIN actual con clienta omite invitadas aun con correo_confirmacion. Adaptar a LEFT JOIN/contacto y COALESCE de nombre/correo; mantener el outbox, reclamo y transporte. |
| Dashboard | Consume la agenda adaptada sin nuevo cálculo ni consultas adicionales. |
| Front Office | Cambiar envío, contexto, clave estable y recuperación; sin fallback a rutas antiguas ni pagos automáticos. |
| Históricas | Permanecen vinculadas a sus clientas y conservan sus valores. Los COALESCE mantienen su lectura. |

Las adaptaciones de agenda/notificaciones se evaluaron SOLO en memoria del laboratorio.
No se editaron sus archivos originales. No se certifica un pago externo por haber
simulado inicio, commit, outbox y entrega.

## 6. Cierre de rutas antiguas y despliegue

Cerrar el acceso público a `POST /api/clientas` y al POST antiguo de reservas que
acepta `id_clienta`; proponer 410 con mensaje uniforme sin IDs. Sus consumidores
actuales son el Front Office y las pruebas de integración. Si se necesita una ruta
interna, debe ser separada, autenticada y con autorización explícita; no mantener
el hueco público como compatibilidad silenciosa.

No deshabilitar GET de agenda, consulta privada, cancelación ni rutas de abonos.
Preparar un corte coordinado: nuevo esquema, lectores compatibles, nueva operación
y frontend, cierre de rutas antiguas, pruebas y habilitación. Hasta completar el
cierre no puede declararse corregida la vulnerabilidad en producción.

Archivos funcionales futuros: `backend/index.js`, nuevo módulo de reserva invitada,
`backend/notificaciones.js`, una migración nueva aprobada, `frontend/front-office/front.js`
y, si los mensajes lo requieren, su HTML. Pruebas de Front Office, consulta, agenda,
notificaciones e integración. No cambiar Webpay/Oneclick/suscripciones ni sus contratos.

## 7. Laboratorio y resultados

Desde la raíz:

```powershell
$env:MERAKI_INVITADA_LAB='1'
$env:MERAKI_SUSCRIPCIONES_AUTOMATICAS='0'
node --test --test-reporter=spec preparacion/reserva-invitada/laboratorio/prototipo.test.cjs
```

**19 pruebas aprobadas, 0 fallidas y 0 omitidas** (18 escenarios y contenedora).
Incluyen los casos solicitados: correo nuevo/existente, ID manipulado, concurrencia
de una clave y de varias, contenido distinto, rollback, respuesta perdida, reinicio,
otro contexto, consulta, cancelación, agenda, abono/commit y correo simulados,
revocación del token, vencimiento e integridad histórica.

La autenticación del laboratorio de agenda es un stub explícito de propietaria;
no sustituye las pruebas de sesión real ya realizadas en la prueba integral MVP.
La disponibilidad usa el SQL actual extraído del backend, no una aproximación.
La prueba de abono llama a los módulos financieros originales con callbacks falsos;
no carga ni contacta Transbank, Oneclick o Gmail.

Base exclusiva `meraki_invitada_lab_1794537843875_2b051d69`: creada desde template0,
identidad comprobada, esquema/SQL propuesto solo allí, eliminada y ausencia
verificada. Los siete archivos pendientes conservaron sus SHA-256.
Express avisó de promesas de VM; no provocó fallos. No hubo validación visual manual.

## 8. Riesgos y acuerdos pendientes

- Aplicar límites también por origen/red y capacidad global; la cuota por contexto
  del laboratorio se evade creando contextos nuevos y NO es protección suficiente.
- Validar Origin/CSRF, JSON, tamaño de cuerpo, cookie HTTPS y política de proxies.
- Acordar retención, expiración, recuperación autorizada y rotación; no borrar
  intentos pendientes/recientes ni divulgar enlaces rotados desde un replay.
- Acordar latencia/lock_timeout y recuperación ante COMMIT incierto; no repetir con
  otra clave ni liberar el horario basándose solo en un timeout del cliente.
- La ausencia de verificación de correo conserva riesgo de abuso o dirección
  equivocada. No acredita identidad; definir mensajes, minimización y antiabuso.
- Revisar consumidores externos al repositorio antes de retirar el contrato antiguo.
- Repetir permisos, sesiones reales, concurrencia y regresiones financieras con
  proveedores simulados durante la implementación compartida.

Adriana puede preparar el controlador frontend aislado y sus estados. Natalia debe
acordar esquema, lectores de contacto, endpoint, idempotencia y cierre del contrato.
No se autoriza desplegar este laboratorio ni aplicar su SQL a bases conservadas.
