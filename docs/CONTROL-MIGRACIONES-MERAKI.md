# Control de migraciones de Meraki

Actualizado el 9 de noviembre de 2026. Este inventario coordina el trabajo en `Natalialeiva/Meraki`. Cada estado debe comprobarse en el catálogo de la base de destino. Una migración publicada en GitHub no acredita que se haya aplicado a una base local.

## Computadores y evidencia

Los respaldos se guardan fuera de Git. GitHub comparte el código y los archivos de migración, pero no sincroniza las bases PostgreSQL. Cada computador verifica y aplica las mismas migraciones faltantes para mantener el esquema compatible con el código, conservando sus datos locales.

- **Natalia, PC actual.** Base `meraki_traslado_20261104`. El 9 de noviembre de 2026 se confirmó la 009 y se aplicó la 010 del commit `5c87d341e1e4cc1e1fa0d3510a289cd8e976472f` con el backend detenido. Se creó un respaldo privado previo a la 010 que incluye la 009 y se verificaron su índice y sus conteos sin restaurarlo. La comprobación posterior en solo lectura confirmó las cinco columnas nuevas, la restricción de proceso y el índice único de operación. Las huellas anteriores y posteriores coincidieron para clientas, reservas, abonos históricos, suscripciones, inscripciones y pagos de suscripción. Los 14 abonos históricos conservaron sus valores y las cinco columnas nuevas quedaron en `NULL`. El backend quedó detenido.
- **Adriana.** Base reportada `meraki_db`. Falta verificar directamente su esquema y las migraciones aplicadas.
- **Natalia, segundo PC.** Base y migraciones pendientes de identificación y verificación directa.

En la tabla, **Por verificar** significa que no se ha confirmado en el computador el conjunto de objetos o cambios de esa migración. Los commits indican la última versión del archivo comprobada en Git al 9 de noviembre, no una fecha de aplicación.

| Archivo exacto | Finalidad y dependencias | Commit conocido | Natalia, PC actual | Adriana | Natalia, segundo PC | Precaución y evidencia específica |
| --- | --- | --- | --- | --- | --- | --- |
| `migracion_abonos_reintentos.sql` | Permitir historial de intentos con unicidad por orden y límites de pendientes y aprobados por reserva. Requiere `abono`, su estado financiero y `buy_order`. | `7986cc2` | Por verificar | Por verificar | Por verificar | Los índices equivalentes se observaron en el PC actual en la revisión de la 009. La existencia de los índices no confirma la ejecución de todo el archivo. Comprobar duplicados y la restricción antigua antes de aplicarlo. |
| `002_agregar_token_consulta.sql` | Añadir identificador privado de consulta e índice único en `reserva`. Requiere la tabla `reserva`. | `a2dc649` | Por verificar | Por verificar | Por verificar | Confirmar columna e índice. No divulgar valores de consulta. |
| `003_notificaciones_correo.sql` | Crear el registro de notificaciones y su unicidad por reserva y tipo. Requiere `reserva`. | `72e8336` | Por verificar | Por verificar | Por verificar | Inspeccionar tabla, estados y unicidad. La verificación del esquema no necesita enviar correos. |
| `004_fecha_inicio_envio.sql` | Registrar el inicio de un envío para distinguir interrupciones. Requiere `notificacion_correo` de la 003. | `5b90e5d` | Por verificar | Por verificar | Por verificar | Confirmar la columna y conservar los estados de envíos anteriores. |
| `005_revision_notificaciones.sql` | Añadir identificador de mensaje y auditoría de revisión. Requiere la 003 y `emprendedora`. | `9284ce6` | Por verificar | Por verificar | Por verificar | Confirmar columna, tabla y claves foráneas. Conservar la evidencia existente. |
| `006_correccion_correo_reserva.sql` | Permitir correo de confirmación por reserva y registrar sus correcciones. Requiere `reserva` y notificaciones de la 003. | `272c8d6` | Por verificar | Por verificar | Por verificar | Comprobar columna, tabla y relaciones. No corregir direcciones ni reenviar como parte del chequeo. |
| `007_nombre_reserva.sql` | Conservar en cada reserva el nombre informado para la cita. Requiere `reserva`. | `0b8f69b` | Por verificar | Por verificar | Por verificar | Verificar la columna sin mostrar nombres ni rellenar registros anteriores. |
| `008_suscripcion_oneclick.sql` | Incorporar inscripción, datos de renovación, intentos de cobro y auditoría de suscripciones. Requiere `suscripcion` y `pago_suscripcion`. | `f5ee04e` | Por verificar | Por verificar | Por verificar | Revisar tablas, columnas e índices, y detectar suscripciones duplicadas antes de aplicar. Mantener apagadas las renovaciones. |
| `009_intentos_webpay.sql` | Persistir la fase de creación, sesión y fecha del intento. Requiere `abono`, el estado financiero y sus columnas de orden y token. | `3c5e75f` | **Aplicada** | Por verificar | Por verificar | Verificación directa el 9 de noviembre en el PC actual. Revisar unicidad de orden, token y estados antes de aplicar en otro equipo. |
| `010_procesamiento_webpay.sql` | Añadir reclamo durable de retorno y recuperación, tipo, estado técnico, fecha y marca de posible envío de `commit`. Requiere `abono` y el backend que la utiliza requiere también la 009. | `5c87d34` | **Aplicada** | Por verificar | Por verificar | Aplicada y verificada el 9 de noviembre de 2026 en el PC actual de Natalia. En otros equipos, confirmar si falta y aplicarla únicamente con autorización, respaldo verificado y backend detenido. |

`schema.sql` define el esquema inicial, `seed.sql` carga datos de prueba y `consulta_disponibilidad.sql` contiene una consulta. No forman parte de la secuencia de migraciones incrementales de una base existente.

## Comprobaciones al cambiar de computador

1. Confirmar la carpeta del repositorio, `origin`, la rama y el commit. Revisar cambios locales y commits pendientes antes de integrar cambios.
2. Identificar la base y el esquema que usa el backend, sin mostrar configuración privada.
3. Verificar columnas, restricciones e índices directamente en la base y anotar fecha, commit y evidencia sin datos personales.
4. Confirmar un respaldo reciente y verificar que su índice sea legible. Mantener separadas las bases de los distintos computadores.
5. Aplicar solo los archivos faltantes y autorizados. Mantener el backend detenido cuando el código nuevo dependa de columnas ausentes.
6. Verificar el esquema y los registros después de aplicar. Durante las pruebas, mantener `MERAKI_SUSCRIPCIONES_AUTOMATICAS=0`.

## Aplicación de la 010 en otros computadores

Una vez autorizada y publicada junto con el código, confirmar la versión del archivo, el destino y la 009 aplicada. Verificar el respaldo, registrar conteos y una huella de abonos históricos en solo lectura y comprobar que el backend esté detenido y no haya bloqueos incompatibles. Ejecutar la 010 una sola vez con `psql`, `ON_ERROR_STOP=1` y un plazo corto para adquirir bloqueos. El archivo incluye su propio `BEGIN` y `COMMIT`. Si falla, revisar el error y el estado de la base antes de reintentar.

Después, comprobar las cinco columnas, la restricción de proceso y la unicidad de la operación. Comparar conteos, huella histórica y estados pendientes. El arranque controlado corresponde a una etapa posterior y debe mantener desactivadas las renovaciones.
