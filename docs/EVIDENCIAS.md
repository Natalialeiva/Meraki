# Evidencias — 3 de noviembre de 2026

## Verificación con PostgreSQL ejecutada

Una versión anterior de la batería completó 16 verificaciones sin fallos (15 casos y un contenedor de integración), con PostgreSQL real, sesión real y proveedores Webpay/SMTP simulados. Cubrió aislamiento por propietaria, acceso anónimo, autorización válida, monto inconsistente, recuperación idempotente, ocho reclamos concurrentes, timeout, revisión de antigüedad, cabecera obligatoria, auditoría, máximo de tres intentos y privacidad de consulta.

La primera ejecución detectó un error de inferencia de tipos SQL en la resolución manual. Se corrigió con casts explícitos a varchar y la segunda ejecución pasó las 16 verificaciones.

## Verificación final ejecutada

npm test: cinco pruebas de correo aprobadas; integración PostgreSQL omitida por falta de MERAKI_DB_TEST=1. Las comprobaciones node --check de backend, frontend y pruebas pasaron.

Después de la ejecución PostgreSQL aprobada se ampliaron las pruebas con INITIALIZED/respuesta incompleta, rollback de pago ante fallo de outbox y flujo API de catálogo-reserva-pago con error SMTP. También se ajustaron el filtro de tipo de notificación y la liberación de conexiones. La ejecución ampliada fue rechazada por el usuario en el diálogo de permisos. NO se presenta esta versión final como validada integralmente en PostgreSQL.

## Revisión del navegador

Servidor local de la copia en puerto 3001. Se verificaron catálogo real, etiquetas de servicio/precio/abono, carga de profesional para Manicure permanente, acceso Back Office sin sesión y consulta sin token. La revisión detectó y corrigió el alias servicio y hora_inicio usado por el frontend.

Capturas: front-office.png y back-office.png. No se creó una reserva ni se realizó un pago desde el navegador. No se comprobó aún el panel autenticado visualmente.

## Diagnóstico local de solo lectura

Abono 8 / reserva 19: estados pendiente / pendiente_abono, monto $5.000; Webpay Integration INITIALIZED, monto y orden coincidentes; ninguna notificación asociada. La columna fecha_inicio_envio no existe aún en esta base. No se consultó el equipo de Natalia.

## Pendientes de aceptación

- Ejecutar la batería PostgreSQL ampliada.
- Aplicar cambios al repositorio original y migraciones con respaldo.
- Configurar cuenta Gmail, contraseña de aplicación y URL auténtica.
- Registrar aceptación SMTP e id de mensaje de una reserva ficticia y verificar recepción e interacción con el enlace en la bandeja real.
- Revisar el equipo de Natalia con acceso autorizado.

## Actualización Gmail OAuth2
Ocho pruebas de correo aprobadas también desde el repositorio original. Verificación real: EAUTH, unauthorized_client. Sin envío. Se preservaron .env y datos de pagos/reservas. Véase GMAIL-OAUTH.md.


Gmail OAuth2: autenticación real correcta y correo de prueba aceptado por SMTP. ID: <6ec32e4b-2067-bf3d-d206-c7326a7dd63f@gmail.com>. Pendiente comprobar recepción. No se modificaron reservas ni abonos.


Recepción del correo técnico Gmail OAuth2 confirmada por el usuario el 3 de noviembre de 2026. Entrega real verificada. Pendiente validar por separado el flujo de reserva recuperada y su enlace privado.


## Recuperación y confirmación real Gmail — 3 de noviembre de 2026

La batería ampliada pasó sus 22 verificaciones en PostgreSQL aislado. La primera ejecución reveló una suposición incorrecta en las pruebas: un INSERT revertido consume igualmente la secuencia del identificador. Se corrigió la prueba para usar el id_notificacion devuelto, sin cambiar los identificadores reales ni la implementación por ese motivo. Registro completo: pruebas-integrales-2026-11-03.txt.

Se ejecutó scripts/probar-recuperacion-gmail.js --enviar-confirmacion en la copia CAPSTONE/Meraki usando las credenciales del .env original. PostgreSQL usa un esquema aislado; el estado AUTHORIZED de Webpay es SIMULADO y no se llama a Transbank ni se genera cobro real. Gmail es REAL y utiliza MAIL_TEST_TO autorizado.

Resultado: recuperación HTTP 200, abono ficticio aprobado, reserva ficticia confirmada, notificación enviada con un intento. Message-ID: <262cb08f-ae78-848c-6967-0e2b698470c3@gmail.com>. La repetición devolvió 409 sin nuevo correo. La consulta privada devolvió 200, estado confirmada, Cache-Control no-store y no incluyó el token en su respuesta. No se imprimió ni registró el enlace privado en las evidencias.

La página de consulta de esta prueba está disponible en localhost:3000 durante 30 minutos (cierre previsto 02:38 del 3 de noviembre de 2026, America/Santiago). El servidor local solo admite GET; no permite pagos ni cancelaciones desde la prueba. Al cerrarse elimina exclusivamente el esquema de prueba que creó. No se modificaron el abono 8 ni la reserva 19 reales.

Pendiente confirmación humana de recepción de ESTE nuevo correo y apertura del enlace en el mismo equipo. Las modificaciones de recuperación/reintentos/pantallas siguen en la copia preparada, aún no aplicadas al repositorio original. La prueba no equivale a un pago autorizado real de Webpay Integration.

## Recepción y apertura confirmadas por el usuario

El usuario confirmó recepción del correo de reserva y apertura de su enlace. La página mostró reserva ficticia 1 confirmada, Manicure permanente y [PRUEBA SIN COBRO] Meraki. Esto completa la verificación humana de entrega y apertura del enlace de consulta local.

El usuario pulsó Cancelar. El servidor aislado rechazó PATCH con 405 y texto plano porque solo admite consultas; el frontend intentó interpretar ese texto como JSON y mostró Unexpected token. La reserva NO fue cancelada. Fue una incoherencia de la interfaz de prueba: ofrecía una acción que el servidor de prueba bloqueaba.

Corrección en la copia: manejo seguro de respuestas no JSON, explicación para 405 y ocultación de acciones tras ese rechazo. Las nuevas ejecuciones del servidor de prueba devuelven capacidades.soloConsulta=true y JSON en los rechazos, para que el frontend oculte las acciones desde la carga. El proceso de prueba ya abierto conserva su configuración inicial hasta cerrarse; no se reinició para evitar invalidar el enlace o enviar otro correo. Tres pruebas de regresión del frontend pasaron. La cancelación funcional del sistema queda pendiente de una prueba separada; no se considera validada por este escenario de lectura.

## Integración y cancelaciones completadas

Se integraron 19 archivos de implementación en Documents/GitHub/Meraki y se conservaron las dependencias previas y .env. Respaldo de archivos anteriores disponible en CAPSTONE/Meraki/docs/respaldo-integracion-1793683255505. Se aplicaron 003/004/005 dentro de una transacción; las huellas de todas las filas de reservas y abonos permanecieron iguales.

Las 28 verificaciones pasan desde el repositorio original: cancelación pendiente/confirmada sin abonos; token inválido/inexistente; cancelación repetida; bloqueo con abono pendiente, rechazado o aprobado; estado terminal; carrera entre cancelar e iniciar pago; frontend sin acciones incompatibles y manejo de respuestas no JSON. Se confirmó también rollback si falla el registro de notificación en el retorno normal de Webpay.

El cambio de cancelaciones aplica la regla existente: cualquier intento de pago asociado bloquea la cancelación pública y orienta al emprendimiento. No implementa devolución de dinero ni modifica pagos. Los cambios quedaron sin commit para revisión. El equipo de Natalia continúa pendiente de acceso.

## Agenda operativa del Back Office

32 verificaciones aprobadas. Se incorporaron filtros por fecha/estado, contador de resultados, estado y número del último abono, selección del abono desde la reserva, cancelación permitida y cierre como atendida/no atendida. El servidor calcula puede_cancelar y puede_cerrar; las acciones no aparecen si no corresponden. Cerrar una atención exige reserva confirmada y hora de fin pasada, según las reglas existentes. No se agrega una confirmación manual que omita Webpay.

Pruebas aisladas: acciones de la propietaria, bloqueo para otra propietaria, atención futura rechazada, atención pasada válida y estados terminales sin acciones repetidas. La API de agenda no expone tokens privados. La prueba visual usó una vista sin DB, Gmail ni Webpay, con datos marcados DEMO: se verificó selección de abono 801 desde reserva 901 y filtro pendiente de abono con resultado 1 de 3. Captura agenda-back-office.png. Ninguna reserva real fue cancelada o marcada atendida.

Acceso local: con autorización del usuario se restableció la contraseña de la cuenta de prueba camila@meraki.test y se cerraron sus sesiones anteriores. No se modificaron reservas ni pagos. La contraseña no se registra en estas evidencias.


## Revisión de pagos comprensible y recuperación condicionada

38 verificaciones aprobadas en esquema aislado. El formulario explica que consultar no cobra ni modifica la reserva y que registrar exige un pago autorizado previo. Los resultados muestran abono, reserva, monto y estados en lenguaje claro, sin JSON crudo. La consulta API devuelve puede_recuperar únicamente para AUTHORIZED, response_code exactamente 0, monto/orden coincidentes y estados locales pendientes.

El botón Registrar pago ya aprobado comienza deshabilitado y requiere una consulta válida del abono seleccionado. Cambiar la selección invalida la consulta; las respuestas antiguas no habilitan acciones sobre otro abono. La recuperación vuelve a validar todo en el servidor. Los fallos al recargar agenda/notificaciones no sustituyen el resultado exitoso del pago por un error genérico.

Prueba visual con respuestas ficticias: abono 9 / reserva 20, estado INITIALIZED, texto El pago todavía no se ha completado y registro deshabilitado. Esto NO es una consulta al abono 9 real. Captura revision-pagos.png. No se realizaron cobros ni modificaciones de pagos reales.

La revisión de pagos se aplicó al repositorio original con respaldo. Las 38 verificaciones volvieron a pasar desde ese repositorio; git diff --check sin errores. Meraki reiniciado en puerto 3000. No se modificaron credenciales ni registros de pagos/reservas reales.


## Webpay Integration sin simulación: retorno aprobado de reserva 21

El usuario completó Webpay y compartió el retorno Abono aprobado y reserva confirmada para reserva 21. Se verificó en modo solo lectura: reserva 21 confirmada, abono 10 aprobado por $5.000, fecha_pago registrada, notificación enviada con un intento e identificador de mensaje presente. No se repitió commit, consulta a Transbank ni envío de correo.

El backend está configurado para Transbank Environment.Integration. Este caso valida un pago en el sandbox real de Webpay, con retorno normal, a diferencia de la prueba anterior con respuesta Webpay simulada. No es un cobro de producción y no valida por sí solo una recuperación después de interrupción. Pendiente confirmación del usuario de recepción del correo correspondiente a la reserva 21 y apertura de su enlace.

## Corrección autorizada del destinatario de reserva 21

El usuario proporcionó un correo corregido para reserva 21. Se aplicó migración aditiva 006 con comprobación de que las reservas y abonos previos no cambiaron durante la migración. El comando permanente corregir-correo-reserva.js configuró correo_confirmacion solo en reserva 21 y renovó su token. No modifica el perfil compartido de clienta ni el abono aprobado.

La notificación anterior se conserva archivada; se registró correccion_correo_reserva y nueva notificación 4. Gmail aceptó el nuevo mensaje en un intento: <d7c399f7-7b8c-34e7-e6f0-c0c5c81d6780@gmail.com>. El enlace anterior quedó invalidado. El usuario debe abrir el enlace del nuevo correo. No se volvió a cobrar ni se llamó al commit Webpay.

La batería aislada completó 39 resultados aprobados (38 casos y un contenedor). El caso nuevo valida conservación de pago, destinatario por reserva, token anterior 404, token nuevo 200, historial anterior preservado e idempotencia si se solicita otra vez el mismo correo. Pendiente recepción del nuevo mensaje por el usuario.

Segunda corrección de destinatario de reserva 21 solicitada explícitamente por el usuario: notificación nueva 5 aceptada por Gmail en un intento. ID <3685d6bb-09fc-45c5-46e9-22966066c341@gmail.com>. Se renovó el enlace y se invalidó el anterior. Pago y estado de reserva conservados. Pendiente confirmación de recepción del último mensaje.


## Front Office guiado

45 resultados aprobados (44 casos y un contenedor). Se aclararon los filtros por nombre de emprendimiento/comuna y se agregó Ver todos. El catálogo marca servicios sin profesionales activos como no reservables y selecciona primero un servicio disponible. El formulario muestra un resumen de emprendimiento, servicio, precio, abono, profesional, fecha/hora y correo, con revisión obligatoria antes de crear. La fecha mínima usa America/Santiago. Crear no realiza un cobro.

Se invalidan horas y revisión al cambiar criterios. Respuestas antiguas no reemplazan la selección nueva. Se impiden dobles envíos de creación y el formulario queda bloqueado tras crear; Comenzar otra reserva habilita un flujo nuevo. El servidor permite reutilizar un correo registrado sin sobrescribir nombre/teléfono ni duplicar clientas.

Pruebas de frontend ejecutan el script real con DOM y fetch simulados; cubren selección reservable, limpiar filtros, fecha obligatoria, invalidación de horas, revisión y doble envío, y respuestas de profesionales fuera de orden. PostgreSQL aislado comprueba la disponibilidad según profesionales activos y la reutilización no destructiva de clienta. Ninguna reserva o pago real se modificó durante estas pruebas.
