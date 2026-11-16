# Fotografías de servicios — 16 de noviembre de 2026

## Alcance y uso

En Back Office → Servicios, el botón «Fotografía» abre el editor del servicio. Permite seleccionar un JPG, PNG o WebP, ver una vista previa local, guardar, reemplazar o eliminar la fotografía. No cambia precio, duración ni abono. Cuando no hay fotografía se muestra un mensaje; si falta el archivo guardado se oculta la imagen rota y se comunica el problema.

Se reutiliza `imagen_servicio`; no se requiere migración. Los archivos se guardan por defecto en `backend/almacenamiento/fotos-servicios`, o en la carpeta definida por `MERAKI_FOTOS_DIR`. El almacenamiento local queda excluido mediante `.gitignore`.

## Seguridad y consistencia

- Límite de entrada: 5 MiB; formatos JPEG, PNG y WebP. Se comprueban extensión, MIME, decodificación real y máximo de 16 millones de píxeles. No se admiten imágenes animadas ni SVG.
- Sharp normaliza la orientación, limita las dimensiones a 1920 × 1920 y convierte a WebP sin conservar los metadatos originales. Cada archivo recibe un UUID generado por el servidor.
- Las operaciones exigen sesión, propiedad del servicio, comprobación de origen y acceso vigente según las restricciones de suscripción existentes.
- Se escribe completamente el archivo nuevo antes de confirmar su asociación. La fotografía anterior se elimina solamente después del COMMIT. Los fallos previos conservan la asociación anterior.
- Si se pierde la respuesta del COMMIT, se informa incertidumbre y se conservan los archivos potencialmente referenciados. Debe actualizarse la consulta antes de reintentar. Un fallo de limpieza puede dejar archivos sin referencia; no se borran automáticamente archivos desconocidos.
- La lectura pública verifica el nombre y la asociación en PostgreSQL; exige servicio y emprendimiento activos. La propietaria puede consultar su propia fotografía aunque el servicio esté inactivo. No se publica la carpeta completa.
- Las asociaciones antiguas que no utilizan la nueva ruta administrada no se eliminan ni transforman automáticamente.

## Contrato HTTP y Front Office de Adriana

GET `/api/servicios/:id/imagen` devuelve los metadatos a la propietaria. PUT en esa misma ruta recibe el archivo binario, su MIME en Content-Type, nombre codificado en `X-Meraki-Nombre` y `X-Meraki-Action: 1`. DELETE elimina la asociación administrada. Se reutiliza la sesión existente.

Las imágenes se leen desde `/media/servicios/<uuid>.webp`. Las respuestas existentes de GET `/api/servicios`, `/api/mis-servicios` y `/api/emprendimientos/:id/servicios` incorporan el campo aditivo `imagen_url`, con esa ruta relativa o `null`.

Adriana debe utilizar `servicio.imagen_url` en las tarjetas o detalle del catálogo, con texto alternativo del servicio, dimensiones reservadas, `object-fit` y, cuando corresponda, carga diferida. Si es null o falla la carga, debe mostrar el recurso alternativo del diseño. No necesita nuevas rutas de catálogo ni rutas del sistema de archivos. No se modificó el Front Office, mapas ni Dashboard en este bloque.

## Archivos de este bloque

- Backend: `fotos-servicios.js`, `index.js`, `acceso-suscripcion.js`, `package.json` y `package-lock.json`.
- Back Office: `fotografias.js`, `servicios.js`, `back.js`, `index.html` y `gestion.css`.
- Soporte: `.gitignore` y `backend/scripts/demostracion-local-segura.cjs` (permite `blob:` en img-src para la vista previa del ensayo).
- Pruebas: `fotos-servicios.test.js`, `fotos-postgres.test.js`, `fotografias-ui.test.js` y adaptación del stub en `mvp-lectura.test.js`.
- Evidencias: este documento, `PRUEBAS-FOTOGRAFIAS-2026-11-16.txt` y `fotografia-servicio-2026-11-16.jpg`.

Los demás cambios locales anteriores se conservaron.

## Verificación realizada

`npm.cmd run test:aislado`: **553 aprobadas, 0 fallidas, 0 omitidas**. El ejecutor confirmó la eliminación de su base efímera. Se verificaron carga, formatos inválidos, tamaño excesivo, permisos entre cuentas, suscripción vencida, reemplazo, eliminación, fallos de almacenamiento y SQL, conservación de la imagen anterior, respuesta incierta de COMMIT y funcionamiento sin fotografía. Las pruebas de interfaz comprobaron selección, vista previa, revocación de URLs temporales y ausencia de archivo guardado.

En navegador se comprobó realmente el acceso al editor, selección de una imagen ficticia, vista previa, guardado y reapertura con la imagen almacenada. Reemplazo y eliminación se comprobaron automáticamente; no se presentan como recorridos visuales realizados. Captura: `fotografia-servicio-2026-11-16.jpg`.

Se verificó sintaxis y `git diff --check`. No se modificó `meraki_db`, no se ejecutaron migraciones, no se contactaron proveedores y no se hizo commit ni push. El ensayo utilizó datos ficticios y almacenamiento temporal propio.

## Traslado al computador de presentación

Git transporta el código, pero no las fotografías ni los datos de PostgreSQL. Para conservar las asociaciones:

1. Detener las cargas y escrituras durante la toma de la copia.
2. Obtener un respaldo privado de la base correspondiente y una copia de su carpeta de fotografías del mismo momento. Conservar los nombres UUID sin renombrarlos. Registrar un manifiesto SHA-256 de los archivos.
3. Trasladar ambos por un medio privado. No subir fotografías locales ni respaldos a GitHub.
4. Instalar las dependencias con `npm ci` en backend y preparar la carpeta configurada por `MERAKI_FOTOS_DIR` o la carpeta predeterminada. El usuario que ejecuta Node necesita permisos de lectura y escritura.
5. Restaurar únicamente en un destino autorizado, protegiendo primero cualquier base existente de Adriana. No sobrescribir sus datos automáticamente. Si las bases tienen servicios o IDs diferentes, copiar archivos solamente no vincula las fotos: hace falta una conciliación autorizada de las asociaciones de `imagen_servicio`.
6. Comprobar los hashes, que cada URL administrada tenga su archivo y que las fotografías se vean desde el catálogo y Back Office. Revisar archivos faltantes o sin referencia antes de borrar nada.

No se realizó ese traslado en este bloque. Debe reiniciarse el backend con el código actualizado para activar los cambios en una ejecución anterior.

## Limitaciones

El almacenamiento es local al servidor; requiere respaldo conjunto con PostgreSQL. No incluye almacenamiento externo, cuotas globales ni eliminación automática de archivos huérfanos. La instalación de dependencias informó dos alertas moderadas; no se aplicaron actualizaciones forzadas fuera de este alcance. Sharp quedó fijado en 0.35.5.
