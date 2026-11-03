# Gmail OAuth2 — 3 de noviembre de 2026

Se adaptó el transporte Gmail para usar GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN, sin contraseña de aplicación. La verificación no envía correos. El envío de prueba es independiente de reservas/pagos y exige MAIL_TEST_TO.

Prueba real contra Google: falló con EAUTH / unauthorized_client. No se envió correo. Suele requerir corregir la asociación entre cliente OAuth y refresh token; no se puede concluir que la conexión esté lista.

Para corregir: abrir OAuth Playground, activar Use your own OAuth credentials, introducir el mismo ID y secreto del .env, seleccionar Server-side, Google y Offline, autorizar https://mail.google.com/ con la cuenta GMAIL_USER, intercambiar el código y reemplazar GOOGLE_REFRESH_TOKEN en el .env. El cliente web debe tener autorizado https://developers.google.com/oauthplayground como URI de retorno. Si Google muestra un bloqueo de organización, debe resolverlo su administrador.

Comandos desde backend:
- node scripts/probar-gmail.js: verifica conexión y autenticación sin enviar.
- node scripts/probar-gmail.js --enviar: envía un mensaje de prueba a MAIL_TEST_TO.

Los códigos de error se muestran sin imprimir credenciales, respuestas OAuth completas ni tokens. La aceptación SMTP no acredita llegada a la bandeja de entrada. En Testing el refresh token con permisos Gmail caduca a siete días.

Verificación automatizada: ocho pruebas de correo pasaron. No se repitió aquí la batería completa PostgreSQL.

Nueva verificación tras aviso del usuario: Google mantiene EAUTH / unauthorized_client. Formato de client ID válido; variables OAuth presentes, sin duplicados ni espacios externos. MAIL_TEST_TO sigue sin configurar. No se envió correo. Esto no valida que el refresh token corresponda al cliente guardado.


Última verificación: persiste unauthorized_client; MAIL_TEST_TO ahora está configurado. Variables OAuth sin valores heredados del proceso que sobrescriban .env. Sin envío. Pendiente comprobar renovación del token directamente en OAuth Playground para aislar configuración Google de backend.


## Conexión y envío correctos — 3 de noviembre de 2026
Tras corregir las credenciales, verificarConexionGmail devolvió conectado=true, proveedor=gmail, autenticacion=OAuth2. El comando de prueba --enviar completó el envío a MAIL_TEST_TO con aceptado=true. ID del mensaje: <6ec32e4b-2067-bf3d-d206-c7326a7dd63f@gmail.com>. El mensaje no contiene tokens ni confirma pagos o reservas. Pendiente confirmación de recepción en bandeja de entrada/spam por la destinataria. La autorización de prueba informada por Google caduca aproximadamente a los siete días.


Recepción confirmada por el usuario el 3 de noviembre de 2026. Prueba real de correo Gmail OAuth2 completada: autenticación correcta, aceptación SMTP y recepción confirmada. Esta prueba corresponde al mensaje técnico; no valida aún el envío de confirmación de una reserva recuperada ni su enlace privado.

