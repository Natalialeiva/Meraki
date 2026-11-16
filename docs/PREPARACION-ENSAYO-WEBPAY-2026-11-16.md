# Cierre del diagnóstico y preparación del siguiente ensayo

## Estado de salida

El código está preparado para un ensayo nuevo, pero NO se inició ni quedó autorizado automáticamente. El recorrido externo completo sigue pendiente de validación. La preparación no resuelve ni reemplaza el intento de reserva 28 / abono 15.

| Elemento | Resultado de esta revisión |
| --- | --- |
| Base principal | `meraki_db`, sin migraciones ni escrituras en este cierre. |
| Reserva 28 y abono 15 | Pendientes; huellas íntegras respecto del diagnóstico previo. |
| Último estado externo conocido | Evidencia histórica INITIALIZED / código -2; no se consultó nuevamente a Transbank. |
| Clasificación del caso | No completado en la evidencia disponible; pendiente de resolución. No es una aprobación ni un rechazo terminal acreditado. |
| Confirmación durable | Sin reclamación de commit ni procesamiento registrado. No prueba por sí solo que no existiera una petición HTTP rechazada antes de procesar. |
| Correo del caso | No se generó; no corresponde enviarlo sin pago aprobado. |
| Alias recomendado | `http://localhost:3000`, igual a PUBLIC_BASE_URL y a la URL configurada de retorno. |
| Arranque actualmente conservado | Proveedores bloqueados y renovaciones desactivadas, mediante variables del proceso. |
| Regresión integral previa | 482 entradas aprobadas, cero fallidas/omitidas; el registro existente incluye limpieza de su base temporal. No se repitió ni creó otra base en este cierre. |
| Verificación focalizada actual | 53 pruebas aprobadas, cero fallidas/omitidas: resultado Webpay, consulta privada y presentación de pagos, con datos simulados. |
| HTTP local | Front Office, Back Office y consulta responden 200 por ambos alias; rutas de proveedores comprobadas responden 503 con el bloqueo activo. |

## Configuración consistente

Usar una sola ventana/pestaña de trabajo y un solo origen durante todo el recorrido:

- Catálogo: `http://localhost:3000/front-office/`
- Back Office: `http://localhost:3000/back-office/`
- Consulta: enlace privado generado por Meraki en ese origen, sin publicarlo.
- Inicio desde clienta: POST `/api/abonos/cliente/iniciar` mediante la interfaz.
- WEBPAY_RETURN_URL configurada: `http://localhost:3000/api/abonos/retorno`.
- Retorno generado para clienta: `http://localhost:3000/api/abonos/retorno/navegador`.
- Destino de pago: el SDK de Webpay Plus Integration proporciona la URL HTTPS oficial; no construirla ni pegar tokens manualmente.

El backend sirve las interfaces originales. No abrir HTML desde el explorador ni mezclar localhost con 127.0.0.1 en pestañas o enlaces. La corrección permite conservar el alias loopback del navegador con protocolo/puerto iguales y rechaza reflejar destinos externos. No es necesario cambiar `.env` para usar localhost en este equipo.

El retorno admite GET y POST URL-encoded, no requiere sesión de emprendedora y utiliza referencia cifrada/correlación para el resultado. Las pruebas integrales anteriores comprobaron ambos métodos sin cookie, unicidad del abono y bloqueo de duplicados. La corrección no deshabilita validaciones de token, monto, orden, identidad o concurrencia.

## Renovaciones y bloqueo actual

El último arranque registrado del proceso del backend estableció:

```powershell
$env:MERAKI_SUSCRIPCIONES_AUTOMATICAS='0'
$env:MERAKI_PROVEEDORES_EXTERNOS='0'
```

El código solo inicia el planificador si la primera variable es distinta de 0. Las respuestas locales 503 y el enlace de escucha loopback concuerdan con el bloqueo del proceso en ejecución. No se añadió un endpoint para exponer variables privadas.

Estas dos variables NO están definidas en el `.env` privado actual: son del proceso, no configuración persistente verificada. Un `npm start` desde otra terminal sin establecerlas no garantiza esos bloqueos. Repetir explícitamente ambas asignaciones antes de iniciar una revisión local. No se modificó `.env` en este trabajo.

Para un ensayo externo expresamente autorizado, deberá habilitarse únicamente el alcance acordado y reiniciarse el backend; `MERAKI_SUSCRIPCIONES_AUTOMATICAS` debe continuar en 0. No entrar a inscripción, renovación, cancelación de tarjeta ni reintentos Oneclick. No ejecutar esos comandos de habilitación ahora.

## Bloqueos y evidencia faltante del intento anterior

La pantalla de Webpay indicó operación no completada y ausencia de cargo, mientras la última consulta autorizada conservada devolvió INITIALIZED/-2. No hay evidencia suficiente para convertirlo manualmente en rechazado, cancelarlo financieramente o reutilizar el token. Se mantiene la prevención de reintentos.

Para descartar un resultado incierto se necesita un resultado final del proveedor correlacionado con el intento, o diagnóstico oficial que cierre su situación. Si se autoriza luego una consulta de estado, debe acordarse por separado; no ejecutar commit, recuperación ni un nuevo pago como forma de averiguar qué ocurrió.

También faltan tiempos precisos del error, respuesta técnica del formulario/autenticador y método/ruta/estado de un posible retorno HTTP. La ventana documentada de cinco minutos hace plausible la expiración, pero no la demuestra. El problema de alias corregido afecta el regreso a Meraki y no acredita la causa del error dentro de Transbank.

Gmail tuvo previamente `EAUTH / invalid_grant`; NO se volvió a contactar en este cierre. Renovar la autorización OAuth privadamente y autorizar su verificación antes de dar por preparado el tramo de correo. No enviar una confirmación de reserva pagada para el caso 28 mientras siga pendiente.

## Procedimiento futuro, condicionado a autorización

1. Revisar y reconocer el estado pendiente del caso 28/15. Una nueva reserva no lo resuelve. No recomendar un reintento automático ni habilitar otro pago para esa reserva.
2. Obtener autorización específica para un caso académico independiente y su contacto externo. Si se decide que primero debe cerrarse el anterior, mantener detenido el ensayo hasta obtener evidencia final. No interpretar esta guía como permiso para saltar ese criterio.
3. Confirmar código, conexión a meraki_db, alias localhost, Gmail OAuth válido si se incluye correo, destinatario autorizado, SDK Integration y renovaciones en 0. Preparar los datos oficiales de tarjeta antes de iniciar; nunca usar tarjeta o dinero real.
4. Desde Front Office buscar Luna Estudio; escoger un servicio de abono $5.000, profesional y una fecha/hora futura disponible diferente de la reservada por el caso anterior. No liberar ni modificar su horario para facilitar el ensayo.
5. Completar una clienta de ensayo con el destinatario acordado. Crear UNA reserva nueva desde la interfaz. Anotar el ID asignado; no asumir que será 29. Guardar su enlace privadamente fuera del repositorio.
6. Iniciar el abono UNA vez. Anotar el nuevo ID, monto y hora. Comprobar que Webpay esté en el ambiente oficial Integration, por $5.000; no recargar, retroceder ni abrir copias del formulario. Completar el tramo de forma continua y dentro de su vigencia.
7. La usuaria completa la aprobación de prueba y regresa al mismo navegador/origen. No disparar manualmente el retorno ni pegar tokens en la barra de direcciones.
8. Verificar el resultado y las condiciones de abajo antes de cualquier otra gestión. Tras terminar, volver a dejar proveedores bloqueados y renovaciones en 0.

## Evidencia mínima de la operación

Registrar en una ficha sanitizada:

| Momento | Datos a registrar |
| --- | --- |
| Antes | Fecha/hora con zona, versión de código, origen local, Integration, renovaciones desactivadas y alcance autorizado. |
| Reserva nueva | ID, servicio, profesional, horario y estado pendiente; omitir contacto y enlace privado en evidencia pública. |
| Inicio | ID del abono, monto, hora y destino HTTPS oficial sin query ni token. |
| Formulario | Hora de entrada, de aprobación/error y texto/código técnico; capturas sin tarjeta, CVV o autenticación. |
| Retorno | Hora, método GET/POST, host, ruta SIN query y estado HTTP; presencia de nombres de parámetros sin valores. No exportar un HAR bruto. |
| Resultado local | Estado de reserva/abono y proceso, número de abonos del nuevo caso, coincidencia de monto e identidad mediante comprobaciones que no expongan sus valores secretos. |
| Notificación | ID y estado/intentos sin destinatario, identificador completo del mensaje ni enlace privado. |
| Interfaces | Consulta, agenda y Dashboard del negocio seleccionado con el mismo nuevo ID/estado; distinguir proyecciones contractuales de dinero cobrado. |

Los logs actuales no contienen un access log HTTP correlacionado del fallo anterior. En el nuevo ensayo habrá que observar y anotar esas columnas en el momento; no asumir que la consola las registrará automáticamente.

## Verificación posterior esperada

- Un único abono para el nuevo caso; monto $5.000 y procesamiento resuelto, sin resultados incompatibles.
- Solo considerar éxito con resultado autorizado válido y reserva confirmada; una pantalla del proveedor o un texto genérico no sustituyen el registro local.
- Notificación única; recepción real confirmada por la destinataria y enlace privado correcto. «Enviado» o aceptación SMTP no certifican recepción en bandeja.
- Consulta muestra reserva y pago coherentes; probar asistencia y solicitud solo con acciones explícitas acordadas.
- Back Office con la nueva emprendedora/negocio: agenda y Dashboard actualizados. No buscar la reserva de Luna Estudio en Camila o Daniela.
- Si Gmail falla después de aprobarse el pago, conservar el pago aprobado y revisar solo la notificación por su procedimiento; NUNCA repetir el abono para obtener otro correo.

## Criterios de detención

| Situación | Acción |
| --- | --- |
| Rechazo final coherente | Registrar el resultado y detener. No iniciar otro pago por cuenta propia. |
| INITIALIZED, falta de retorno, timeout, desconexión o error genérico | Detener; conservar registros y token privadamente. No repetir, recuperar ni cambiar estados manualmente. |
| Resultado contradictorio, monto/identidad diferente o datos que cambian durante la revisión | Detener y clasificar para revisión; no confirmar ni liberar horario automáticamente. |
| El proveedor parece aprobar pero Meraki sigue pendiente | Detener; no llamar al retorno ni recuperar automáticamente. Solicitar alcance para revisar el mismo intento. |
| URL, ambiente o monto inesperados | No continuar ni introducir datos. |
| OAuth inválido antes de empezar | No iniciar el recorrido completo pago+correo hasta regularizarlo, o acordar expresamente una prueba de pago que deje correo pendiente. |

## Autorización requerida

Antes de cualquier contacto externo solicitar: «Autorizo una sola reserva académica nueva e independiente en Luna Estudio, un abono de $5.000 exclusivamente en Webpay Plus Integration con datos oficiales de prueba y el correo de confirmación a [destinatario confirmado]. Reconozco que el caso 28/15 permanece pendiente y no autorizo reutilizarlo, recuperarlo ni modificarlo. Ante resultado incierto, detenerse sin repetir. Mantener Oneclick y renovaciones desactivados».

Una autorización para consultar el caso anterior es distinta de una autorización para crear y pagar otro. Ninguna se obtuvo ni ejecutó como parte de este cierre. No hubo llamadas a Transbank/Gmail, nuevas reservas/abonos, bases nuevas, cambios financieros manuales, commit o push.

Referencias locales: [diagnóstico](DIAGNOSTICO-WEBPAY-28-15-2026-11-16.md), [evidencia histórica de consultas](REVISION-INTENTO-15-2026-11-16.json) y [regresión de 482 entradas](PRUEBAS-DIAGNOSTICO-WEBPAY-2026-11-16.txt).
