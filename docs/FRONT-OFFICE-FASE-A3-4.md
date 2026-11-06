# Front Office — continuidad A3.4.1–A3.4.3

Registro de Adriana, 5 de noviembre de 2026. Bloques implementados y revisados;
pendientes de publicación manual. Google Maps real sigue deshabilitado.

## Historial y punto de partida

Se conservan sin reescribir los registros anteriores:

- [A1](FRONT-OFFICE-FASE-A-BLOQUE-1.md).
- [A2 y sus revisiones](FRONT-OFFICE-FASE-A-BLOQUE-2.md).
- [A3.1–A3.3 y cierre de cercanía](FRONT-OFFICE-FASE-A3-3.md).

El punto de partida publicado es `74f2ccf`, en `Natalialeiva/Meraki`, rama `main`.
La consulta remota de la auditoría previa confirmó ese mismo commit: sin avances
posteriores de Natalia al momento de consultar. Las referencias a mapas no
iniciados en los documentos anteriores describen su estado histórico.

## A3.4.1 — panel y adaptador

Botón opcional «Ver mapa» antes de las tarjetas, panel cerrable y accesible mediante
aria-expanded/aria-controls y mensajes de estado. No abre automáticamente.
Vista explícita de preparación, sin cartografía ficticia. Tarjetas, filtros por
nombre/comuna, orden por cercanía y selección de servicios siguen disponibles.
El adaptador separa el catálogo del proveedor y descarta respuestas antiguas.
Resultado focalizado de esta etapa: 61 aprobadas, cero fallos u omisiones.

## A3.4.2 — proveedor Google preparado, sin activar

Proveedores simulado y Google separados. Carga del SDK oficial únicamente bajo
demanda, después de abrir el panel y con configuración válida y autorizada.
Cargador compartido por documento, promesa única de SDK y bibliotecas maps,
marker y core. Se prepara AdvancedMarkerElement, identificador de mapa configurable
y reutilización de una instancia por panel. DEMO_MAP_ID solo se admite en pruebas.

Sin configuración, clave o autorización se conserva el proveedor simulado.
La configuración propuesta usa MERAKI_MAPAS_CONFIG exclusivamente en memoria por
visita: no se lee .env, no se solicitan secretos al backend y no se persiste.
Cambiar de proveedor o clave tras la primera apertura exige recargar.
La guía técnica detallada se mantiene en
[MAPAS-CONFIGURACION.md](../frontend/front-office/MAPAS-CONFIGURACION.md);
este documento registra avances, sin duplicar su procedimiento completo.

Se contemplan errores de red, API y autorización. No se reintenta por cambiar
filtros después de un fallo; cerrar/reabrir permite reintentos controlados. Un
fallo de autorización o timeout incierto requiere corregir y recargar para evitar
reinsertar el SDK. Las tarjetas permanecen operativas.
Resultado focalizado de esta etapa: 76 aprobadas, cero fallos u omisiones.

## A3.4.3 — marcadores, detalle y sincronización

- Validación de coordenadas y de IDs enteros positivos; normalización de ID numérico
  o textual, un marcador por ID y primer registro válido prevaleciente.
- Solo datos públicos de los negocios filtrados. Los negocios sin coordenadas
  permanecen en tarjetas y no generan marcadores.
- Comparación de instantáneas públicas por ID: reordenar por cercanía o cambiar
  campos privados no vuelve a preparar el proveedor.
- Actualización de posición y título, incorporación y eliminación de marcadores
  por ID, limpieza de listeners y protección frente a callbacks antiguos.
- Encuadre con coordenadas de negocios: uno, varios o ninguno. Nunca se utiliza
  la ubicación de la clienta para centrar ni se entrega al proveedor.
- Seleccionar un marcador muestra nombre y comuna. Solo «Ver servicios» llama al
  flujo existente; no crea reservas. Cerrar o cambiar resultados invalida el detalle
  y la acción anterior. No cambian reglas de reserva ni contratos de API.

## Archivos de los tres bloques

Modificados respecto al commit publicado de partida:

- `frontend/front-office/front.js`: notificación de resultados al adaptador.
- `frontend/front-office/index.html`: panel, aviso y detalle seleccionado.
- `frontend/front-office/styles.css`: estilos responsive del panel y detalle.
- `backend/test/front.test.js`: integración con filtros y flujo existente.
- `demo/server.cjs`: GET exactos para los cinco módulos locales, tipo JavaScript.
- `demo/server.test.cjs`: rutas permitidas y métodos/archivos rechazados.

Nuevos:

- `frontend/front-office/mapa.mjs`: adaptador, versiones, selección y acción.
- `frontend/front-office/mapa-datos.mjs`: datos públicos, validación y deduplicación.
- `frontend/front-office/mapa-simulado.mjs`: vista local sin red.
- `frontend/front-office/mapa-google.mjs`: cargador y proveedor preparados.
- `frontend/front-office/mapa-proveedores.mjs`: elección diferida del proveedor.
- `frontend/front-office/MAPAS-CONFIGURACION.md`: mecanismo y límites de configuración.
- `backend/test/mapa.test.js` y `backend/test/mapa-google.test.js`.
- Este documento de continuidad en `docs/`.

## Verificación final y seguridad

**83 pruebas focalizadas aprobadas, 0 fallidas, 0 omitidas y 0 canceladas.**
Repetidas satisfactoriamente durante la auditoría previa a publicación. Incluyen
Front Office A1/A2/A3, Haversine, consentimiento, adaptador, proveedores simulados,
marcadores, detalle, filtros, respuestas tardías, privacidad y protección de demo.

Comando desde la raíz del repositorio, con renovaciones automáticas deshabilitadas:

```text
node --test backend/test/front.test.js backend/test/geografia.test.js backend/test/ubicacion.test.js backend/test/mapa.test.js backend/test/mapa-google.test.js demo/server.test.cjs demo/verify.test.cjs
```

No se repitió la batería completa con PostgreSQL en estos bloques: los resultados
históricos de 171 principales más 8 de demo corresponden al cierre anterior y no
deben presentarse como una nueva ejecución de A3.4. Las pruebas Google usan objetos
de SDK y documento simulados en memoria, sin CDN ni conexiones de red.

Chrome a 1440, 768 y 390 px: apertura/cierre, tres negocios de meraki_demo, detalle,
Ver servicios, filtro Lavanda, resultados vacíos y Ver todos comprobados sin enviar
reservas. Ubicación de clienta simulada. Sin desbordamiento horizontal; logo,
banner y diseño general aprobados conservados. Capturas fuera del repositorio.

Sintaxis de todos los JavaScript pendientes correcta; git diff --check sin errores,
solo avisos informativos LF/CRLF. Auditoría sin credenciales reales, datos personales,
rutas privadas ni respaldos en los cambios. La clave de los tests es ficticia.

**No se han utilizado claves reales, activado Google Maps JavaScript API ni
facturación. Cero conexiones reales a Google en las comprobaciones de la demo.**
Sin configuración local, no se insertó script SDK ni existió google en el navegador.
No hay ubicación personal en URLs, logs, almacenamiento o proveedor. La demo mantiene
usuario lector, métodos de escritura bloqueados y proveedores de pagos/correo
deshabilitados. No se modificaron PostgreSQL, backend compartido de ejecución,
Back Office, pagos, suscripciones, migraciones ni archivos .env.

## Limitaciones y siguiente paso

La vista actual continúa siendo simulada; las pruebas no certifican el servicio
Google real, sus restricciones de clave, cuotas, facturación, accesibilidad ni
mensajes del SDK. Antes de habilitarlo deben revisarse configuración restringida,
autorización y costos. Una clave JavaScript de navegador es observable: depende de
restricciones de API y HTTP referrer, no de ocultarla en el código.

Persiste la limitación aprobada del subtítulo pequeño del banner en teléfonos.
La demo usa negocios ficticios; sus suscripciones vencen sin renovación automática.

**A3.4.4 está pendiente de definición, revisión y autorización con ChatGPT.**
No iniciar nuevas funcionalidades ni activar Google real. Sin commit ni push
automáticos; este documento debe incluirse junto a los 14 archivos de A3.4.1–A3.4.3
en el commit manual que Adriana está preparando.
