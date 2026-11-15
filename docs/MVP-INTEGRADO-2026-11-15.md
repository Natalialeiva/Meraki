# Integración del MVP — 15 de noviembre de 2026

Base de código al iniciar: `93beb5a`. El árbol estaba limpio. Los cambios de este bloque permanecen locales, sin commit ni push. No se modificaron bases históricas, `.env`, herramientas privadas ni políticas V3. No se contactó a Gmail, Transbank, Oneclick o mapas externos.

## Implementación

### Reserva como invitada

Se revisó y reutilizó el prototipo de `preparacion/reserva-invitada/laboratorio`, manteniéndolo como referencia histórica. La implementación integrada está en `backend/reserva-invitada-servicio.js` y `backend/reservas-invitadas.js`.

- `GET /api/reservas/invitada/contexto`: emite o conserva cookie HttpOnly, SameSite Strict, firmada y con vigencia limitada. Secure cuando la configuración pública utiliza HTTPS. Respuesta genérica, sin identidad ni correo.
- `POST /api/reservas/invitada`: requiere cookie válida, `X-Meraki-Action: 1` e `Idempotency-Key` UUID v4. Rechaza identificadores de clienta, propiedades extra y origen cruzado. Body: `{contacto:{nombre,correo,telefono},id_servicio,id_trabajadora,fecha,hora}`.
- Contacto e intento se crean junto a la reserva en una transacción. La reserva invitada no se vincula a un perfil global por coincidencia de correo: `id_clienta=NULL`, contacto por cita y snapshots de nombre/correo para agenda y notificaciones.
- Idempotencia ligada al navegador y al contenido mediante HMAC; no almacena el cuerpo de la solicitud ni una segunda copia del token. Intento persistido por 24 horas; contexto por 7 días. Replay creado devuelve la reserva actual y el enlace privado, sin reservar nuevamente. No reutilizar la misma clave con otros datos. El frontend conserva la clave durante reintentos del mismo formulario.
- Candado de trabajadora 117 compartido con las reservas y bloqueos existentes. Revalida plan, servicio/profesional activos, asignación, horarios, bloqueos, ocupación y fecha futura dentro de la transacción.
- Límites básicos: intentos persistidos por contexto y límite por IP en memoria. Para despliegue con múltiples procesos se deberá compartir el límite de IP y definir retención/limpieza de intentos vencidos; no se implementó un borrado automático de evidencias.
- `/api/clientas` y el POST anterior `/api/reservas` requieren ahora sesión. La reserva interna anterior verifica propiedad del servicio. El Front Office ya no utiliza el flujo público de dos llamadas ni recibe IDs de otras clientas por correo.
- No acredita propiedad del correo: el enlace sigue siendo una capacidad privada. Validar un email por formato no equivale a verificar identidad. Los contactos históricos y la reserva de otras personas no se consultan ni modifican por coincidencia de correo.

### Asistencia y cancelación

- Se agregó `reserva.asistencia_confirmada_en`; no cambia `reserva.estado`, pagos ni resultado de atención.
- Se agregó una solicitud de cancelación por reserva. Estados propios `pendiente/cerrada`; no se modificó el enum de los cinco estados de reserva.
- `GET /api/reservas/consulta/:token`: expone asistencia, solicitud y capacidades nuevas.
- `POST /api/reservas/consulta/:token/confirmar-asistencia`: reserva futura, confirmada y con abono aprobado; sin solicitud pendiente. Primer timestamp conservado en reintentos.
- `POST /api/reservas/consulta/:token/solicitud-cancelacion`: reserva futura activa con algún intento de abono. Motivo opcional de hasta 500 caracteres. Reintentos devuelven la única solicitud existente, sin reabrirla.
- `GET /api/solicitudes-cancelacion`: sesión, solo solicitudes de la propietaria.
- `PATCH /api/solicitudes-cancelacion/:id/cerrar`: sesión, propiedad, respuesta de 1 a 500 caracteres y cabecera de operación. Conservar respuesta original si ya está cerrada.
- Mutaciones de clienta requieren acción explícita, cabecera y comprobación de origen; se bloquea la fila de reserva. Cerrar solicitudes no cancela, no libera horarios y no devuelve dinero. La cancelación directa existente sigue bloqueada con cualquier abono asociado.
- Consulta privada muestra asistencia/solicitud y confirma antes de POST. El modo `soloConsulta` oculta y bloquea también estas acciones en la interfaz.
- Agenda muestra indicadores y un listado para responder/cerrar solicitudes. Dashboard conserva cálculos y estados; sigue proyectando únicamente sus campos autorizados.

### Correos

Se reutilizan el registro único por reserva/tipo, los reintentos controlados, la revisión de envíos interrumpidos y la notificación después de recuperación del pago. Se adapta la lectura de clienta a LEFT JOIN para reservas invitadas; las destinatarias y nombres salen de los snapshots por cita.

El texto explica asistencia y solicitud desde el enlace. GET del correo no modifica datos. Ethereal conserva su enlace ficticio; Gmail mantiene el enlace auténtico y OAuth2. No se enviaron correos ni se usó transporte Ethereal real durante esta ejecución: los transportes de pruebas son dobles locales. La entrega real pendiente no se acredita con esta batería.

### Integración y alcance auditado

Las suites existentes verifican catálogo/filtros, creación y edición de servicios, profesionales, horarios/bloqueos, disponibilidad, sesiones, agenda, cierre atendida/no atendida, pagos/recuperación, notificaciones, Dashboard y economía. El recorrido nuevo añade invitada → pago simulado → notificación → consulta → asistencia → solicitud → revisión de propietaria. Se prueban concurrencia, rollback posterior a contacto, idempotencia y conservación financiera.

Geolocalización/cercanía y mapas ya estaban implementados y probados con APIs simuladas. El proveedor local simulado es la alternativa sin configuración externa; Google exige habilitación, autorización, key y mapId. No se añadieron servicios o claves. Una vista simulada no acredita un mapa Google real ni la precisión de coordenadas de un negocio.

Suscripciones/Oneclick conservan precio y política de acceso existentes. Su batería corre con proveedor simulado: inscripción, renovación, cancelación, incertidumbre y restauración de acceso. No se acredita inscripción o renovación real con estos resultados. No se amplió ese flujo.

## Migraciones nuevas y coordinación con Adriana

1. `database/011_reserva_invitada.sql`: permite NULL en la relación histórica de clienta y añade contacto por reserva e intentos idempotentes.
2. `database/012_gestiones_reserva.sql`: columna de asistencia y tabla de solicitudes, con integridad y unicidad.

Se probaron solo en bases efímeras nuevas. La prueba de migración conserva reservas anteriores. No son scripts idempotentes: comprobar catálogo antes de ejecutarlos y no repetirlos. No ejecutar `schema.sql` o `seed.sql` en bases existentes.

Antes de activar en cualquier computador:

1. Revisar/proteger cambios locales y acordar el commit compartido. Esta entrega aún no está publicada: Adriana no la recibe hasta que se haga commit/push autorizado. No descartar su trabajo ni rebajar commits posteriores.
2. Identificar la base realmente configurada, verificar un respaldo y revisar migraciones anteriores hasta 010. La última revisión de `meraki_db` de este PC detectó 009/010 ausentes; no asumir que basta aplicar 011/012. El estado de la base de Adriana debe comprobarse directamente.
3. Preparar y autorizar una ventana de aplicación con backend detenido. Revisar datos/índices, aplicar solo migraciones faltantes en orden y comparar datos históricos. No hay autorización para hacerlo en esta tarea.
4. Actualizar backend y frontend coordinadamente. Un frontend antiguo que use el flujo público anterior recibirá401. Las consultas/agenda nuevas requieren012: no arrancar esta versión sobre un esquema antiguo.
5. Mantener apagadas las renovaciones mientras se diagnostica. No copiar `.env`, credenciales o bases entre equipos por Git.
6. Ejecutar la batería aislada y ensayar navegador con una base de demostración aprobada. La revisión visual manual final no se realizó sobre datos históricos.

La restauración privada `meraki_webpay_sandbox` y su reserva2 pagada no son el destino de estas migraciones. Las huellas/supervisores privados conservados corresponden al código anterior: rechazarán cambios de código. No actualizar sus huellas para eludir la protección ni modificar V3. Su demostración necesita otra revisión autorizada por separado.

## Repetir las pruebas sin tocar bases conservadas

Desde `backend`:

```powershell
npm.cmd run test:aislado
```

El script usa las credenciales locales solo para conectarse a `postgres` y crear una base nueva `meraki_mvp_ejecucion_<fecha>_<azar>`, desde template0. Instala btree_gist únicamente allí. No usa DB_NAME como base de pruebas. Ejecuta las suites con proveedores simulados y elimina solo la base creada, comprobando su OID. La suite integral anterior crea otra base efímera propia, también eliminada. Si falla una limpieza, se informa: no eliminar otros recursos ni usar FORCE a ciegas.

Las suites SQL de integración/suscripciones exigen ahora el prefijo de base efímera del runner. No ejecutar `MERAKI_DB_TEST=1 npm test` apuntando a una base histórica. `npm test` normal no ejecuta todas las integraciones SQL.

Resultados finales y nombres de destinos creados/eliminados: `PRUEBAS-MVP-2026-11-15.txt`. Los contenedores de subpruebas cuentan en el total de Node; no presentar ese total como igual número de escenarios externos reales. Las pruebas DOM son automatizadas y no sustituyen el ensayo visual en el computador de presentación.

Durante el desarrollo se corrigieron ajustes de fixtures al nuevo contrato público, construcción del body de invitada, exposición de solicitudes en consulta, expectativa de retorno repetido (409 seguro) y proyección mínima exigida por estadísticas. No se cambió el algoritmo financiero para hacer pasar pruebas.

## Pendientes que requieren autorización o validación externa

- Revisión/commit/push de esta entrega y sincronización de Adriana.
- Respaldo y aplicación de migraciones en cada base conservada, con verificación individual.
- Arranque y ensayo visual del recorrido nuevo en una base de demostración autorizada.
- Gmail real, otra transacción Webpay Integration y Oneclick real: necesitan alcance separado; no reutilizar el pago histórico.
- Modo privado de lectura del laboratorio: adaptación pendiente, sin cambios a sus originales en este bloque.
- Política para una cancelación efectiva de cita pagada y eventual devolución: no implementada. El MVP permite solicitar y registrar gestión, conservando reserva y dinero.

El código integrado y sus simulaciones no equivalen a MVP desplegado en producción. Falta validar configuración, entorno de presentación y operación externa según lo autorizado.

## Resultado final de esta ejecución

El ejecutor Node registró **468 entradas aprobadas, 0 fallidas, 0 omitidas y 0 TODO**, incluyendo contenedores de subpruebas. Evidencia completa en `PRUEBAS-MVP-2026-11-15.txt`; las dos bases efímeras se eliminaron correctamente. Verificación focalizada de Front Office: 39 aprobadas, 0 fallidas, registrada en `PRUEBAS-FRONT-MVP-2026-11-15.txt`. `git diff --check` no detectó errores de espacios. No hubo commit, push ni activación sobre bases conservadas.

## Revisión previa a publicación

Se repitió `npm.cmd run test:aislado` antes del commit. Resultado actualizado: **469 entradas aprobadas, 0 fallidas y 0 omitidas**, incluyendo grupos. Se añadió una regresión para retirar los botones de asistencia/solicitud durante una recarga fallida de consulta, evitando capacidades obsoletas. El registro final de pruebas corresponde a esta ejecución. No se modificó la evidencia histórica `recuperacion-gmail-real.json`, que no forma parte de los cambios de este bloque; su existencia anterior en Git no se elimina al excluirla de este commit. La publicación se verifica por separado contra la referencia remota.
