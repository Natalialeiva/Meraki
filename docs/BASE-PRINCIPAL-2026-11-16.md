# Preparación de la base principal y entrega académica

## Decisión y alcance

El MVP utiliza exclusivamente `meraki_db` para todos sus módulos. Las bases temporales se usan solo para pruebas/restauraciones verificadas. El laboratorio `meraki_webpay_sandbox`, sus datos y herramientas V3 no se tocaron ni se exportaron a la principal.

## Base principal

PostgreSQL 18.6 local, puerto 5432. Antes de actualizar: 27 reservas, 14 abonos, 6 clientas, 2 negocios, una suscripción, una inscripción, cero pagos de suscripción y ocho notificaciones. Existían tablas de sesiones, corrección de correo y revisión de notificaciones. Extensiones `plpgsql` y `btree_gist`. Faltaban 009–012.

Se obtuvo un respaldo lógico completo en formato custom mediante un snapshot de solo lectura. Se restauró en una base nueva, se compararon cantidades y huellas de todas las filas, columnas, índices, restricciones y extensiones, y se ensayaron 009→012. PostgreSQL reescribió expresiones equivalentes de casts de arrays en algunas restricciones; el comparador normaliza exclusivamente esa representación y nombres automáticos NOT NULL.

Natalia autorizó explícitamente aplicar 009–012. Con backend detenido, otro respaldo y ensayo correctos, se bloquearon las tablas, se comprobó que no hubiera conexiones ajenas ni cambios desde el snapshot y se aplicó el conjunto en una transacción. El resultado coincidió con el ensayo antes del COMMIT. Se conservaron los campos históricos de todas las filas y sus cantidades. No se ejecutaron `schema.sql` ni `seed.sql` en la principal.

Respaldo privado conservado fuera de Git: `%LOCALAPPDATA%/Meraki/respaldos/principal-ssdCjz/meraki_db.dump`; recibo junto al archivo. SHA-256:

`504b144e8133e79c2cbc141cc1436320987c6891be7269a7492e610feb54df97`

Este respaldo completo contiene información privada y sesiones. No distribuirlo al profesor ni a GitHub. Los primeros respaldos de diagnóstico también permanecen privados; no se eliminaron automáticamente.

## Arranque del sistema original

Tras autorización específica de Natalia, se abrió el backend original sobre la principal. Front Office, Back Office, consulta, CSS y logo respondieron HTTP 200. En navegador se comprobó el catálogo, el filtro por nombre, servicios y el formulario de login. Con proveedores bloqueados, los retornos de Webpay y Oneclick respondieron 503 antes de crear operaciones.

Con Luna Estudio se verificaron además disponibilidad de Sofía para el 17/11, creación de la reserva invitada 28, consulta privada pendiente, login real de la nueva cuenta, agenda con esa reserva/abono pendiente y Dashboard con una reserva pendiente. El login, sesión, agenda, solicitudes y suscripción respondieron también HTTP 200 mediante el acceso privado local. No se atribuye esta comprobación a pagos aprobados.

Se incorporó `MERAKI_PROVEEDORES_EXTERNOS=0`: bloqueo temprano de rutas financieras, transporte Gmail/Ethereal y adaptador Oneclick. No es un simulador ni un modo SQL de solo lectura: la aplicación conserva sus funciones locales. En este modo escucha únicamente en loopback. Las renovaciones se desactivan por separado con `MERAKI_SUSCRIPCIONES_AUTOMATICAS=0`.

Camila conserva su suscripción cancelada y sin vigencia; sus servicios se muestran pero no permiten reservar. No se alteró esa situación histórica para facilitar el ensayo.

## Datos nuevos autorizados

Natalia autorizó un negocio inventado de apariencia normal, sin la palabra prueba en sus pantallas: Luna Estudio, comuna Providencia, servicios Manicure permanente y Pedicure spa, profesionales Sofía e Isidora, horarios de lunes a sábado 09:00–18:00, abono $5.000 y mes gratuito sin renovación. Cuenta y acceso generados localmente, fuera de Git. Las coordenadas son de referencia académica; no acreditan la dirección de un comercio real.

La cuenta usa dominio reservado de ejemplo. Su acceso privado está en `%LOCALAPPDATA%/Meraki/acceso-academico/luna-estudio.json`. No publicar ese archivo. Se creó sin reservas, abonos ni correos. Los negocios y suscripciones anteriores quedaron conservados.

## Ensayo externo controlado

Natalia autorizó separadamente una reserva nueva en Luna Estudio, un único abono Integration de $5.000 y correo al destinatario confirmado. Se creó la reserva 28 para el 17/11/2026 a las 10:00, se abrió la consulta privada y se llegó al formulario oficial `webpay3gint.transbank.cl` por el monto correcto. La aprobación fue entregada a Natalia en el navegador. No repetir la transacción si queda incierta.

Hasta observar el retorno y comprobar recepción, no dar este ensayo como aprobado ni Gmail como entregado. No se reutilizó la operación histórica del laboratorio. No se ejecutó inscripción ni renovación Oneclick.

Resultado observado posteriormente: Webpay mostró «Tu transacción no se pudo llevar a cabo» y que no hubo cargo. La consulta SQL local conservó reserva 28 pendiente de abono, abono 15 pendiente, fase pendiente de respuesta y sin procesamiento de retorno ni notificación. El error genérico no permite determinar por sí solo su causa ni certificar el estado externo. No se repitió el pago ni se llamó a status/recovery. Gmail no se probó con este caso porque no hubo confirmación de pago.

Revisión posterior autorizada: Natalia autorizó expresamente una única consulta `status` del intento 15. Webpay Integration respondió `INITIALIZED`, monto 5000, sin código de respuesta; orden y sesión coincidieron con el registro local. No se ejecutó commit ni recuperación, no hubo escrituras SQL y no se creó otro intento. La respuesta acredita una transacción iniciada, no una aprobación ni un rechazo terminal. La documentación oficial indica un plazo reducido de cinco minutos para el token/formulario; el vencimiento es una explicación posible del error, pero no quedó acreditado como causa exacta por esa respuesta. Se conserva la reserva pendiente y la prevención de reintentos.

Referencia: https://transbankdevelopers.com/documentacion/webpay-plus . No almacenar en esta evidencia tokens, orden, sesión, enlace privado, datos de tarjeta ni destinatarios personales.

Nueva continuación solicitada por Natalia: se hizo una segunda consulta status, sin escrituras ni otras operaciones; devolvió INITIALIZED y response_code -2, conservando coincidencia de monto, orden y sesión. No se trató el código aislado como estado terminal. La verificación de conexión Gmail OAuth2 (sin enviar correos) falló con EAUTH / invalid_grant. Se requiere nueva autorización de Google y actualización privada del refresh token por la usuaria antes de continuar la entrega real. No se editaron credenciales ni se enviaron mensajes.

## Entrega reproducible

`database/academica/meraki_db.sql` se generó desde cero en una base efímera con estructura hasta 012 y datos inventados de Luna Estudio. Se restauró íntegramente en una segunda base efímera y se verificaron dos servicios, dos trabajadoras, doce horarios y ausencia de transacciones/clientas invitadas/correos/inscripciones. Ambos recursos se eliminaron por nombre e identidad comprobados. La cuenta del SQL está bloqueada, sin contraseña reutilizable; la activación genera un acceso nuevo privado en cada computador.

Consultar `INSTALACION-ACADEMICA.md` y `database/academica/verificacion.json`. No restaurar este SQL encima de una base existente. Adriana conserva su propia base y debe revisar sus migraciones; no necesita los mismos IDs ni sesiones de Natalia.

## Pruebas y límites

- Regresión aislada posterior al bloqueo financiero: 479 entradas aprobadas, cero fallidas y cero omitidas; base efímera eliminada. Incluye rechazo de rutas de inicio/retorno/recuperación/estado e inscripción, antes de crear abonos, y bloqueo de transportes de correo.
- La batería incluye Webpay Plus y Oneclick Mall simulados, reservas invitadas, asistencia, solicitudes, agenda, Dashboard, mapas, geolocalización, seguridad y notificaciones. No equivale a pruebas externas de producción.
- Batería normal: 363 entradas, 359 aprobadas y cuatro grupos SQL omitidos intencionalmente, sin fallidas. La primera ejecución restringida falló por permisos EACCES en sockets locales; se repitió con acceso loopback autorizado. La ejecución aislada sí incluyó los grupos SQL.
- Google Maps continúa preparado pero deshabilitado. El mapa local y filtros tienen cobertura automatizada. No se activaron facturación, claves ni permisos de ubicación. El enlace de indicaciones exige destino confirmado; guardar coordenadas no lo habilita automáticamente.
- Las fotografías de servicios no se verificaron: los negocios históricos tenían cero imágenes registradas y no se inventaron fotografías comerciales.
- La evidencia Gmail original sigue intacta con el SHA-256 histórico documentado; el resumen anonimizado no la retira del historial de Git.
- No hubo commit, push, cambios de `.env` privado ni cambios en el computador de Adriana.

## Secuencia de presentación

Antes del día de presentación: completar retorno de Integration, comprobar recepción Gmail, validar acceso al Back Office y preparar el mismo catálogo/estructura en Adriana. Durante la exposición: abrir Meraki, buscar Luna Estudio, elegir servicio/profesional/hora, reservar, usar Integration con tarjeta oficial de prueba, mostrar confirmación y correo, asistencia, solicitud, agenda y Dashboard. Oneclick se explica separadamente sin activarlo.

La contingencia simulada permanece identificada como tal y no reemplaza la demostración principal. Si una operación queda incierta, consultar los registros locales y no repetir el pago. Para operaciones externas adicionales se requiere otra autorización específica.
