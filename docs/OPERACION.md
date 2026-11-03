# Operación de confirmaciones y revisión de pagos

Fecha: 3 de noviembre de 2026 (America/Santiago).

## Estado de entrega

Los cambios se integraron en Documents/GitHub/Meraki el 3 de noviembre de 2026. Se aplicaron las migraciones 003, 004 y 005, verificando que reservas y abonos no cambiaron. La entrega Gmail OAuth2 y la apertura del enlace de prueba fueron confirmadas por el usuario. Las 28 verificaciones pasan desde el repositorio original. Falta la revisión específica del equipo de Natalia.

## Instalación

1. Revisar y aplicar los archivos backend/index.js, backend/correo.js, backend/notificaciones.js, backend/package.json, backend/.env.example, backend/test/, frontend/, database/005_revision_notificaciones.sql y docs/. Conservar el package-lock.json y las dependencias previas del usuario; no copiar .env ni node_modules entre equipos.
2. Respaldar la base. Con el backend detenido, ejecutar las migraciones 003, 004 y 005 en ese orden si faltan. La base local consultada aún no tiene fecha_inicio_envio. No ejecutar schema.sql ni seed.sql sobre una base con datos. Verificar también la migración 002 y los índices de abonos existentes.
3. Configurar Gmail con las variables de backend/.env.example. Conservar las variables DB_* y SESSION_SECRET existentes. No colocar credenciales en Git.
4. Ejecutar npm start desde backend. Front Office: /front-office/. Back Office: /back-office/. Consulta privada: /consulta/#TOKEN.
5. Ejecutar npm test. Para incluir PostgreSQL, establecer MERAKI_DB_TEST=1. Las pruebas crean un esquema meraki_test_<timestamp> aislado, cargan datos ficticios, simulan Webpay y SMTP y eliminan exclusivamente ese esquema al finalizar. No son pruebas de entrega Gmail real.

## Gmail y enlace privado

Sirve una cuenta Gmail normal dedicada a pruebas. Habilitar verificación en dos pasos y autorizar OAuth2; colocar GMAIL_USER, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN solo en el .env local. MAIL_PROVIDER=gmail exige PUBLIC_BASE_URL y falla si falta la configuración; nunca cae silenciosamente en Ethereal.

PUBLIC_BASE_URL debe ser la dirección auténtica accesible por la destinataria. localhost solo sirve desde el equipo que ejecuta Meraki. Usar HTTPS fuera de localhost. El token viaja en el fragmento del enlace y la página consulta la API privada; las respuestas usan no-store y no-referrer. No configurar registros de acceso que guarden tokens de las rutas API.

En Ethereal solo se envía un enlace ficticio. No se envía el enlace privado auténtico, ni se registra en consola. El envío Gmail devuelve el identificador del mensaje sin URL de vista previa. La aceptación SMTP no prueba recepción en bandeja de entrada.

Referencia del proveedor: https://nodemailer.com/guides/using-gmail

## Procedimiento de notificaciones

- Cada confirmación guarda una notificación única en la misma transacción que aprueba el abono y confirma la reserva. Esto también se aplica a la ruta de recuperación Webpay.
- El envío ocurre después del COMMIT y libera la conexión transaccional antes de usar SMTP. Un fallo de correo no revierte el pago.
- El reclamo pendiente -> enviando es atómico y aumenta intentos. Máximo tres envíos reclamados por notificación. La reserva debe continuar confirmada.
- El Back Office permite intentar pendientes y reintentar fallidos mediante sesión de la propietaria y cabecera X-Meraki-Action: 1. Cada operación requiere evidencia y deja auditoría. Los pagos no cambian al reintentar un correo.
- Errores con aceptación incierta, incluyendo timeout, conservan enviando. Un fallo al guardar el resultado después del SMTP también conserva enviando. No se reenvían automáticamente.

### Revisión de envíos interrumpidos

1. Esperar al menos diez minutos desde fecha_inicio_envio. No actuar sobre envíos activos. Confirmar que no hay un proceso antiguo de envío en curso; detener un backend bloqueado antes de resolver manualmente.
2. Buscar en el proveedor por destinatario, hora y, cuando exista, id_mensaje. No copiar tokens ni datos personales en la evidencia.
3. Si el proveedor confirma entrega/aceptación, registrar entregado. La notificación pasa a enviado y no se vuelve a mandar.
4. Solo con evidencia fiable de que NO fue aceptado, registrar no_entregado. Pasa a fallido. Esta decisión no envía correo; una operación separada permite el reintento si quedan intentos y la reserva está confirmada.
5. Si el resultado sigue incierto, no resolver ni reintentar. SMTP no permite garantizar exactamente una entrega ante desconexiones. Nunca reiniciar el contador para forzar un cuarto envío.

Rutas: GET /api/notificaciones; POST /api/notificaciones/:id/revisar con decision y evidencia; POST /api/notificaciones/:id/reintentar con evidencia. Las operaciones de revisión se auditan en revision_notificacion.

## Abono 8 y reserva 19

Consulta de solo lectura en la base LOCAL de este equipo:

- Abono 8 corresponde a reserva 19.
- Abono pendiente; reserva pendiente_abono; ambos montos $5.000.
- Existen token de transacción y orden; no se incluyeron sus valores en la evidencia.
- Webpay Integration devolvió INITIALIZED. Monto y orden coinciden. No hay notificación de reserva 19.
- No se confirmó ni recuperó ese pago, no se inició otro cobro y no se modificaron sus registros.

INITIALIZED no es un pago aprobado. No corresponde recuperarlo como AUTHORIZED. El cierre de un intento para habilitar otro pago requiere revisar su evolución en Transbank; no cambiarlo manualmente a aprobado o rechazado por suposición.

Esta consulta NO sustituye la revisión en el equipo de Natalia. Pendiente conocer su ubicación/forma de acceso y verificar que su base y ambiente coincidan.

Referencia: https://transbankdevelopers.com/documentacion/webpay-plus

## Front Office y Back Office

Se agregó una primera interfaz funcional: catálogo por nombre/comuna, selección de servicios/profesionales, disponibilidad y creación de reserva; enlace privado de consulta, cancelación y acceso a Webpay. El Back Office incorpora login, consulta de reservas, consulta/recuperación de abonos y revisión/reintentos de correo. No constituye el cierre de todos los módulos del producto.

Queda pendiente una prueba completa del navegador con datos ficticios, pago en sandbox y entrega Gmail real. No usar reservas de Natalia para pruebas destructivas.

## Actualización posterior: Gmail OAuth2
La conexión de correo OAuth2, el script permanente de prueba y ocho pruebas automatizadas se aplicaron al repositorio original. Esta aplicación es solo del correo; las migraciones, reintentos y pantallas anteriores siguen preparados en la copia. Las instrucciones de contraseña de aplicación de este documento quedan sustituidas por GMAIL-OAUTH.md. Google rechazó la autenticación real con unauthorized_client. No se envió correo.


La batería PostgreSQL ampliada ya pasó: 22 verificaciones. Existe un escenario repetible de recuperación con Webpay simulado y Gmail real: scripts/probar-recuperacion-gmail.js --enviar-confirmacion. Usa una base aislada, impide cobros reales y mantiene consulta local durante 30 minutos. Leer EVIDENCIAS.md antes de repetir; no ejecutar de nuevo para intentar recuperar una prueba incierta, pues genera otro correo.


