# Revisión segura del MVP — Adriana

Base revisada: `main`, `2379aa3d2972b6c068140d2279f632f04f841979`.
El árbol estaba limpio antes de esta revisión. No se consultaron ni modificaron
`meraki_db` o `meraki_demo` durante estas pruebas. No se inició el backend principal.

## Cobertura y resultados

- Batería `backend/test/*.test.js`: **289 aprobadas, 0 fallidas, 2 omitidas**.
- Preparaciones independientes: **113 aprobadas, 0 fallidas, 28 TODO**.
- Los TODO son contratos futuros; no son funcionalidades implementadas.
- Las dos integraciones PostgreSQL quedaron desactivadas con `MERAKI_DB_TEST=0`:
  ejecutan scripts SQL de construcción/migración y requieren otro entorno. No se
  ejecutaron contra bases históricas ni se presenta esta revisión como una nueva
  validación integral de PostgreSQL.
- Sintaxis de los tres JavaScript afectados y `git diff --check`: correctos.

Las suites existentes cubren catálogo, filtros combinados, reintentos, selección
de servicio/profesional/horas, respuestas fuera de orden, resumen, validaciones,
consulta privada, mapa y cercanía; además, perfil, servicios, trabajadoras,
asignaciones, horarios, bloqueos y los seis indicadores de agenda con APIs simuladas.
Las regresiones financieras existentes utilizan simulaciones; no certifican que
Webpay Integration esté terminado.

Se agregó una prueba de las rutas originales de Express con sesiones en memoria,
SQL simulado que rechaza escrituras y dependencias externas bloqueadas. Verifica
recursos estáticos, rechazo de visitantes, login/logout y que consultar otro
emprendimiento no alcance la consulta de reservas. No prueba el almacenamiento
de sesiones de PostgreSQL ni sustituye una integración con una base aislada.

La ejecución en VM emite un aviso de Express sobre promesas de otro contexto.
No produjo fallos y no demuestra por sí mismo un problema del servidor normal.
No se efectuó una nueva revisión visual manual en Chrome/Edge en esta revisión.

## Corrección comprobada

En la consulta privada faltaba una defensa explícita contra cancelaciones repetidas
y actualizaciones manuales durante la operación. Además, si la cancelación era
aceptada pero fallaba su recarga, se perdía el mensaje de éxito.

Ahora se bloquean envíos repetidos y actualizaciones manuales durante la cancelación,
se invalidan lecturas anteriores y se conserva la confirmación ante error posterior.
Si el resultado de la cancelación es incierto, se pide actualizar antes de intentar
otra vez, sin afirmar que la operación falló. Se añadieron cuatro casos simulados.
No se cambiaron el endpoint, las reglas de cancelación ni el código de pagos.

## Pendientes de coordinación

### Distribución de reservas

`GET /api/reservas?id_emprendimiento=…` todavía no devuelve `id_servicio` ni
`id_trabajadora`. Las columnas existen en la tabla; no falta una migración.
El consumidor de producción encontrado es `frontend/back-office/back.js`, que
reutiliza esa agenda para listado, indicadores y distribución. También consumen
el contrato las pruebas de interfaz e integración.

Propuesta para Natalia: añadir `r.id_servicio` y `r.id_trabajadora` al SELECT de
esa ruta, conservando nombres, fechas civiles, permisos, filtros de propiedad y
campos anteriores. Probar que cada ID corresponde al nombre entregado, que el
negocio ajeno sigue rechazado y que no se amplía el alcance de datos. No se aplicó
el cambio. Hasta entonces la distribución debe seguir mostrando indisponibilidad;
no agrupar por nombre ni inventar identificadores.

### Reserva como invitada

El flujo actual conserva dos solicitudes (`POST /api/clientas` y
`POST /api/reservas`) y envía `id_clienta` desde el navegador. Siguen pendientes
la resolución segura del contacto, transacción única, idempotencia y protección
contra atribución de identidades. Conocer un correo no demuestra su propiedad.
La prevención de doble clic del frontend no resuelve duplicados por desconexión
ni la autorización del servidor. Requiere coordinación antes de una exposición
pública con contactos reales; ver `preparacion/reserva-invitada/README.md`.

### Compatibilidad y mapa

- Próxima atención conserva su resolvedor rápido; sin Temporal informa
  indisponibilidad. La revisión práctica de Firefox sigue pendiente.
- Google Maps real continúa fuera de esta validación. «Cómo llegar» permanece
  deshabilitado sin evidencia confiable de ubicación.
- No se certificó entrega real de correo ni pago externo.

## Procedimiento de demostración

1. En `http://localhost:3000/front-office/`, mostrar catálogo, nombre/comuna/categoría,
   filtros aplicados y eliminación individual. Usar solo lectura en la base habitual.
2. Seleccionar negocio, servicio, profesional y fecha; consultar disponibilidad y
   completar el resumen. **No pulsar Crear reserva sobre las bases históricas.**
3. Para demostrar creación y cancelación, utilizar únicamente un entorno futuro
   con base independiente, contactos ficticios, proveedores sustituidos y renovación
   automática desactivada. No se preparó ni arrancó ese entorno en esta revisión.
   Las pruebas automatizadas actuales muestran esos comportamientos con simulaciones,
   no una creación real de extremo a extremo en PostgreSQL.
4. Para mostrar agenda/dashboard sin escribir en bases históricas, utilizar sesiones
   y respuestas ficticias en pruebas. Un login normal guarda una sesión en PostgreSQL;
   no debe incluirse bajo una condición de cero escrituras sobre la base habitual.
5. Mostrar los seis indicadores y que los filtros afectan la lista, no los totales.
   Explicar la indisponibilidad actual de distribución por falta de IDs en la API.
   Los casos con IDs ficticios en pruebas muestran cantidades, porcentajes y empates.
6. No iniciar abonos, recuperar pagos, inscribir tarjetas ni reenviar notificaciones.
   Presentar Webpay Integration como trabajo pendiente de Natalia.

Para completar una demostración real de búsqueda → reserva → agenda → dashboard,
primero acordar el cambio aditivo de API y la preparación segura del entorno aislado,
sin ejecutar migraciones en las bases históricas. Las correcciones de identidad de
invitadas son un pendiente separado, no una consecuencia del cambio de estadísticas.

## Archivos de esta revisión

- `frontend/consulta/consulta.js`: manejo de cancelación en la interfaz.
- `backend/test/consulta.test.js`: cuatro regresiones de cancelación.
- `backend/test/mvp-lectura.test.js`: comprobaciones de rutas con datos en memoria.
- `docs/VERIFICACION-MVP-ADRIANA.md`: resultados, propuesta y recorrido seguro.

Sin cambios en backend de ejecución, Back Office, pagos, Oneclick, suscripciones,
notificaciones, dependencias, configuración ni esquema. Sin commit ni push.
