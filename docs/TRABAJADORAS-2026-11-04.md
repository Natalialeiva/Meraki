# Trabajadoras y asignación de servicios — 4 de noviembre de 2026

## Bloque completado

Back Office permite listar, crear, editar y desactivar trabajadoras del negocio seleccionado, consultar sus servicios, asignar un servicio activo propio y retirar una asignación con confirmación. Se reutilizaron las rutas existentes.

El formulario conserva lo escrito ante error, bloquea envíos duplicados, diferencia guardado y recarga, e ignora respuestas de asignaciones anteriores al cambiar de negocio. Las trabajadoras inactivas no reciben nuevas asignaciones; sus relaciones existentes pueden consultarse y retirarse.

Las trabajadoras y servicios desactivados se conservan para el historial. Retirar una asignación no cancela reservas existentes. La interfaz avisa de estas consecuencias antes de la acción y recuerda que se necesitan horarios configurados para ofrecer horas.

## Archivos

- `backend/index.js`: rechazo de campos desconocidos/protegidos en creación y edición de trabajadoras y alta de asignaciones.
- `frontend/back-office/trabajadoras.js`: nuevo módulo de interfaz, con carga por negocio y gestión de asignaciones.
- `frontend/back-office/back.js`: inicialización y cambio de negocio.
- `frontend/back-office/index.html`: formularios, listado, navegación y estilos propios del módulo.
- `backend/test/trabajadoras.test.js` y `backend/test/integracion.test.js`: pruebas.

Sin migración nueva, cambios en Front Office ni cambios de credenciales. Los datos del negocio principal solo se consultaron durante la verificación visual; las altas y modificaciones de pruebas se ejecutaron en el esquema temporal.

## Contratos utilizados

Todas las rutas requieren sesión; la cuenta determina los negocios autorizados.

- `GET /api/mis-trabajadoras`: listado propio, activas e inactivas.
- `POST /api/trabajadoras`: `{id_emprendimiento,nombre,apellido,descripcion}`. Nombre obligatorio de hasta 100 caracteres; apellido opcional de hasta 100; descripción opcional de hasta 1000. Éxito 201 `{mensaje,trabajadora}`; negocio ajeno 403.
- `PATCH /api/trabajadoras/:id`: edición parcial de nombre, apellido y descripción; opcionales admiten `null`. Éxito 200 `{mensaje,trabajadora}`; trabajadora ajena o inexistente 404.
- `PATCH /api/trabajadoras/:id/desactivar`: baja lógica, 200; si ya estaba inactiva, 409.
- `GET /api/trabajadoras/:id/servicios`: relaciones actuales, incluyendo servicios inactivos para mantener su administración.
- `POST /api/trabajadoras/:id/servicios`: `{id_servicio}`; ambas entidades activas y del mismo negocio de la sesión. Éxito 201 `{mensaje,asignacion}`; duplicado 409; relación ajena, inexistente o inactiva 404.
- `DELETE /api/trabajadoras/:id/servicios/:id_servicio`: retira solo la relación; 200 `{mensaje,asignacion}`. Inexistente o ajena, 404. Puede volver a asignarse por el flujo normal si ambas entidades siguen activas.
- Sin sesión: 401. Datos inválidos o campos protegidos/desconocidos: 400. El rechazo de campos desconocidos es más estricto que el comportamiento anterior.

No se añadieron rutas ni se implementó reactivación en este bloque. Próximo bloque recomendado: horarios individuales y bloqueos mediante las rutas existentes.

## Evidencia

Desde `backend`, PowerShell:

```powershell
$env:MERAKI_DB_TEST='1'
npm.cmd test
```

Resultado: **81 casos aprobados y un grupo de integración**. Node informa **82 pass, 0 fail, 0 skipped**. Registro completo: `pruebas-trabajadoras-2026-11-04.txt`.

Se añadieron seis casos integrales: autenticación y validación; creación y edición; asignaciones concurrentes sin duplicados y necesidad de horarios; permisos y cruce de negocios; retirada conservando reservas; desactivación conservando historial y excluyendo nuevas reservas.

Se añadieron ocho casos de interfaz: filtrado por negocio, creación y edición, errores, selección de servicios válidos, retirada y trabajadora inactiva, doble envío y recarga fallida, confirmación de baja y respuestas antiguas.

Las consultas y sesiones del servidor de pruebas resuelven únicamente tablas del esquema temporal. SMTP y Webpay se simulan. No se ejecutan cobros ni envíos reales. La limpieza elimina solo el esquema temporal validado.

Comprobación visual en el servidor local reiniciado: trabajadora Camila Ejemplo, Manicure permanente asignado y Manicure de prueba Meraki disponible para asignar. No se pulsó Guardar, Asignar, Retirar ni Desactivar en la base principal. Captura: `trabajadoras-back-office-2026-11-04.png`.

Sintaxis JavaScript y `git diff --check` correctos; advertencias LF/CRLF informativas. Sin commit, push, pull ni reset en este bloque. Cambios listos para revisión en GitHub Desktop.
