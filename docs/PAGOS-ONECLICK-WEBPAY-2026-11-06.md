# Continuidad Natalia — Webpay y Oneclick

Fecha: 6 de noviembre de 2026. Base de código recibida: main en 8ecfe59.

## Problemas corregidos

Webpay podía aceptar una respuesta de aprobación sin código de autorización. Ahora consulta, retorno y recuperación exigen un código de texto no vacío y compatible con la longitud de almacenamiento, además de las verificaciones existentes de estado, importe y orden. El código de respuesta de aprobación debe ser el número 0.

Si falta esa autorización, no se aprueba ni rechaza automáticamente el abono, no se confirma la reserva y no se envía su correo. El intento queda pendiente para revisión. No se modificaron pagos históricos ni se habilitaron reintentos automáticos de pagos inciertos.

La confirmación de inscripción Oneclick esperaba solo cuatro dígitos y el campo credit_card_type. El SDK contempla un número enmascarado y card_type. Se normalizan ambos formatos compatibles, se conservan únicamente los últimos cuatro dígitos y el tipo de tarjeta, y se rechazan números completos o datos incompletos. El identificador reutilizable continúa cifrado con la clave existente; no se cambiaron credenciales ni el cifrado.

## Archivos del bloque

- backend/index.js
- backend/suscripcion-plan.js
- backend/suscripciones.js
- backend/test/integracion.test.js
- backend/test/suscripciones.test.js
- Este documento.

No se requieren migraciones ni nuevas dependencias. No se modificaron Front Office, contratos de reserva ni la base de otro computador.

## Evidencia y alcance

- Se añadieron comprobaciones de retorno GET/POST y recuperación Webpay sin autorización válida. Los casos verifican que abono, reserva y notificaciones no cambien ni se envíen correos.
- Las pruebas de Oneclick usan el formato enmascarado y card_type del SDK, verifican los últimos cuatro y rechazan un número de tarjeta completo.
- Regresión ejecutada al cerrar esta corrección, antes del posterior rediseño: 212 aprobadas, 0 fallidas, 0 omitidas y 0 canceladas, incluidas integraciones PostgreSQL aisladas y pruebas de demo. Los proveedores de esas pruebas fueron simulados.
- Las pruebas se ejecutaron en meraki_pruebas_20261104 con esquemas temporales. La comparación del negocio principal antes/después no encontró cambios por las pruebas.
- En la aplicación original se completó después una inscripción real de tarjeta de prueba en el ambiente de integración de Oneclick. Se verificaron inscripción completada, identificador cifrado y mes calendario gratuito. La suscripción quedó con consentimiento de renovación; no hubo pagos de suscripción registrados en la auditoría posterior.
- No se volvió a confirmar a ciegas el primer intento fallido. La usuaria cerró ese intento desde el panel e inició una nueva inscripción después de la corrección.

## Renovación mensual: PENDIENTE

Una inscripción exitosa NO demuestra que se haya validado el cobro mensual de $9.990, el vencimiento real, un rechazo del proveedor, la recuperación real de una respuesta incierta ni la cancelación/revocación de una tarjeta inscrita. Los escenarios simulados no sustituyen esas pruebas externas.

MERAKI_SUSCRIPCIONES_AUTOMATICAS=0 debe permanecer configurado en .env y en el proceso durante la revisión. Publicar estos cambios no autoriza a activar el planificador ni a ejecutar cargos. La renovación_automatica=true de una suscripción representa el consentimiento de la cuenta; no demuestra que el procesador esté activo ni que se haya probado un ciclo.

Antes de probar un cargo, acordar cuenta, ambiente de integración, monto, escenario, evidencia y autorización explícita. No provocar vencimientos cambiando datos de negocios existentes ni repetir cargos de resultado incierto.

## Bases independientes entre computadores

La auditoría de Natalia consultó meraki_traslado_20261104, restaurada localmente en su equipo. No debe confundirse con meraki_db mencionada en documentos históricos ni con la base principal de Adriana.

GitHub comparte código y documentación, no PostgreSQL, cuentas, reservas, tarjetas inscritas, pagos ni archivos .env. Cada computador conserva su conexión y sus datos propios. No copiar la configuración privada de otra persona ni ejecutar schema.sql o seed.sql sobre una base existente para sincronizar código.

Conservar SESSION_SECRET y las claves de cifrado existentes. No publicar .env, tokens de inscripción, identificadores reutilizables, respuestas completas del proveedor ni respaldos privados.
