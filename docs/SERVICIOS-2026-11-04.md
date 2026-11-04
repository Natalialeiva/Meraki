# Administración de servicios — 4 de noviembre de 2026

## Funcionalidad

Back Office: listado de servicios activos e inactivos del negocio seleccionado; creación, edición de nombre, categoría, descripción, precio, duración y abono; desactivación con confirmación. Los valores se muestran como texto, sin interpretar HTML.

El formulario conserva los datos si falla el guardado, evita doble envío, bloquea el selector durante la operación e ignora respuestas antiguas al cambiar de negocio. Si el guardado termina pero falla la recarga, comunica el éxito y la necesidad de actualizar la lista, sin invitar a repetir la creación.

Los nuevos servicios requieren una trabajadora activa asignada para reservarse. La interfaz de asignaciones sigue pendiente. Desactivar un servicio retira su oferta pública; no elimina ni cancela sus reservas anteriores. La reactivación no forma parte de este bloque.

## Archivos del bloque

- `backend/index.js`: cambio de categoría en PATCH; rechazo de campos desconocidos, valores monetarios fuera de capacidad o con más de dos decimales y duraciones fuera del rango entero PostgreSQL. UPDATE verifica abono <= precio contra la fila vigente para proteger ediciones simultáneas.
- `frontend/back-office/servicios.js`: módulo de gestión.
- `frontend/back-office/back.js`: carga al iniciar sesión y al cambiar de negocio.
- `frontend/back-office/index.html`: formulario, listado, acceso directo y estilos limitados al Back Office.
- `backend/test/servicios.test.js` y `backend/test/integracion.test.js`: casos de interfaz y API.

No se modificó Front Office durante este bloque. Sus modificaciones visibles en Git son anteriores. No requiere migración PostgreSQL. No se alteraron credenciales, pagos ni datos de servicios en la base principal.

## Contratos

Todas las rutas privadas requieren sesión. La propietaria se obtiene de la sesión, no del JSON.

- `GET /api/mis-servicios`: devuelve servicios propios activos e inactivos. Nombre del servicio en la respuesta: `servicio`.
- `GET /api/categorias`: catálogo público de categorías existentes.
- `POST /api/servicios`: JSON `{id_emprendimiento,id_categoria,nombre,descripcion,precio,duracion_min,monto_abono}`. Precio y abono son números, duración entero positivo; abono entre 0 y precio. Devuelve 201 `{mensaje,servicio}`. Negocio ajeno: 403.
- `PATCH /api/servicios/:id`: admite los mismos campos editables sin `id_emprendimiento`. Ahora admite `id_categoria` como entero positivo correspondiente a una categoría existente. Devuelve 200 `{mensaje,servicio}`. Servicio ajeno o inexistente: 404. Cambio simultáneo incompatible: 409, requiere recargar y revisar.
- `PATCH /api/servicios/:id/desactivar`: desactivación lógica; 200 si cambia, 409 si ya estaba inactivo, 404 si no existe o es ajeno.
- Sin sesión: 401. Datos inválidos o campos protegidos/desconocidos: 400. Dinero: hasta 99.999.999,99 y máximo dos decimales, consistente con las columnas actuales. El rechazo de campos desconocidos es más estricto que el comportamiento anterior.

La categoría, precio y duración se aplican al servicio vigente. Cada reserva conserva el precio, abono y horas guardados al crearla; los cambios del servicio no reescriben ese historial.

## Evidencia

Desde `backend`, PowerShell:

```powershell
$env:MERAKI_DB_TEST='1'
npm.cmd test
```

Resultado: **67 casos aprobados y un grupo de integración**. Node informa **68 pass, 0 fail, 0 skipped**. Registro completo: `pruebas-servicios-2026-11-04.txt`.

Se añadieron cinco casos integrales: validación y autenticación; creación/edición/categoría y conservación de reservas; ediciones simultáneas; permisos de otra propietaria; desactivación y retirada del catálogo. Se añadieron ocho casos de interfaz: carga por negocio, creación, edición, errores y validación, recarga fallida tras guardado, confirmación de desactivación, doble envío y respuestas antiguas.

Las pruebas usan exclusivamente un esquema temporal para las consultas y sesiones; SMTP y Webpay se simulan. La comprobación visual local cargó la lista y el formulario de edición de Manicure permanente, sin pulsar Guardar ni Desactivar. Captura: `servicios-back-office-2026-11-04.png`.

Sintaxis JavaScript y `git diff --check` correctos, con avisos informativos LF/CRLF. Servidor local reiniciado para activar los cambios. Sin commit, pull, push ni reset. Antes del commit en GitHub Desktop, revisar las eliminaciones de evidencias que ya estaban presentes al iniciar la sesión.
