# A3.4.2 — proveedor Google preparado, deshabilitado

No hay claves, SDK descargado, servicios activados ni facturación configurada en
este bloque. La demo conserva la vista simulada. No se requiere configurar nada
para seguir probando búsqueda, cercanía, servicios o el panel de preparación.

## Configuración local, únicamente en memoria

Se lee `globalThis.MERAKI_MAPAS_CONFIG` en la primera apertura con negocios válidos.
No se carga ningún archivo de configuración, no se consulta al backend y no se
usa almacenamiento persistente. Al recargar se pierde esta configuración.
Cambiar de proveedor o clave después de la primera apertura requiere recargar.

Forma de configuración **inactiva**, sin credenciales:

```javascript
globalThis.MERAKI_MAPAS_CONFIG = {
    habilitado: false,
    autorizado: false,
    apiKey: '',
    mapId: '',
    entorno: 'pruebas'
};
```

No activar en A3.4.2. Tras autorización posterior, la persona responsable podrá
establecer los valores en la consola local de desarrollo, antes de pulsar «Ver
mapa». Este mecanismo por visita permite pruebas locales sin escribir claves en
Git, `.env`, HTML ni archivos públicos. No compartir capturas de esa consola ni
copiar credenciales al chat. No constituye aún un sistema de configuración de
producción; su suministro para despliegue deberá coordinarse en otro bloque.

El proveedor real exige `habilitado === true`, `autorizado === true`, clave no
vacía, identificador de mapa y entorno explícito (`pruebas` o `produccion`).
`DEMO_MAP_ID` solo se admite con `entorno: 'pruebas'`; no reemplaza la clave ni
evita facturación. Contexto HTTPS o localhost seguro obligatorio. Configuración
ausente, incompleta o no autorizada conserva el proveedor simulado.

Una clave JavaScript del navegador será visible en la solicitud del SDK. Nunca
utilizar secretos de PostgreSQL, Gmail, Webpay ni del backend para este propósito.
Antes de habilitar: crear/revisar proyecto y facturación con aprobación, habilitar
solo Maps JavaScript API, configurar clave de navegador con restricciones de API
y HTTP referrer para los orígenes autorizados (incluido el puerto localhost demo),
cuotas y alertas de gasto. Revisar las tarifas vigentes; no se promete costo cero.

## Arquitectura y ciclo de vida

- `mapa.mjs`: adaptador del catálogo; publica únicamente campos públicos de los
  negocios filtrados con coordenadas válidas. Protege renders y selección con
  versiones de búsqueda/panel. No recibe la ubicación de la clienta.
- `mapa-simulado.mjs`: controles locales de preparación, sin red.
- `mapa-proveedores.mjs`: selección diferida de proveedor y configuración por visita.
- `mapa-google.mjs`: cargador compartido por documento, promesa única de SDK y
  bibliotecas `maps`/`marker`/`core`, AdvancedMarkerElement y una instancia reutilizable
  de mapa por panel. Creación y render solo después de validar la versión activa.

No hay SDK al cargar la página, buscar, ordenar o actualizar ubicación con el
panel cerrado. Tampoco se carga si no hay negocios con coordenadas válidas.
La URL oficial del SDK es fija; la configuración no permite cambiar el proveedor
por otra URL. Se evita cargar sobre un SDK/hook global ajeno para no duplicarlo.
El encuadre usa solo coordenadas de negocios; nunca ubicación personal. Cerrar
oculta la superficie y retira marcadores/listeners, conservando la instancia
para evitar crear otra al reabrir. Tras cargar Google, cerrar no puede deshacer
las conexiones ya realizadas por el SDK; para descargarlo se debe cerrar/recargar
la página. Ningún dato de la clienta se pasa al proveedor.

Fallo de red: mensaje neutral, tarjetas operativas; reintento solo al cerrar y
reabrir. Cambiar filtros no reintenta tras un error. Error de bibliotecas/API:
limpieza y reintento controlado, reutilizando SDK/instancia si ya existen.
Autorización fallida (`gm_authFailure`) o timeout de carga incierta: no se vuelve
a insertar el SDK en esa visita; corregir configuración y recargar. No se muestran
URLs, claves ni errores técnicos del proveedor en los mensajes de la aplicación.

## Verificación de A3.4.2

Pruebas de proveedor con documento, scripts, clases Map/AdvancedMarkerElement y
errores totalmente simulados en memoria: no hay DOM de navegador ni conexión de
red para cargar Google en esas pruebas. La comprobación visual de demo usa el
proveedor simulado, sin MERAKI_MAPAS_CONFIG y sin clave. La batería focalizada
incluye A1/A2/A3, aislamiento de recursos y protección de demo. No es una prueba
del servicio Google real; quedan pendientes restricciones reales, cuotas, errores
de consola del SDK, atribución y accesibilidad del mapa con el proveedor habilitado.

Para revisar sin Google: iniciar la demo habitual, abrir
http://localhost:3001/front-office/, recargar y pulsar «Ver mapa». En otra terminal:

```text
node --test backend/test/front.test.js backend/test/geografia.test.js backend/test/ubicacion.test.js backend/test/mapa.test.js backend/test/mapa-google.test.js demo/server.test.cjs demo/verify.test.cjs
```

Fuentes de diseño:
- https://developers.google.com/maps/documentation/javascript/load-maps-js-api
- https://developers.google.com/maps/documentation/javascript/advanced-markers/start
- https://developers.google.com/maps/api-security-best-practices

Sin cambios de backend compartido, base de datos, contratos, reservas, .env ni
permisos del lector. Sin commit/push. A3.4.3 pendiente de revisión y autorización.


## A3.4.3 — marcadores y sincronización, sin Google real

- mapa-datos.mjs normaliza únicamente datos públicos, valida coordenadas e IDs
  enteros positivos y deduplica ID numérico/textual. El primer registro válido
  prevalece. Orden por ID para comparar conjuntos independientemente de cercanía.
- El adaptador compara esa instantánea pública: no prepara de nuevo por cambios
  de orden o datos privados. Filtros y nuevas búsquedas invalidan selecciones y
  renders anteriores; los negocios sin coordenadas permanecen en tarjetas.
- Seleccionar un marcador muestra nombre y comuna. Solo «Ver servicios» llama al
  flujo existente. Cerrar o cambiar resultados elimina ese detalle y su acción.
- Google mantiene marcadores por ID: actualiza posición/título, retira los que ya
  no corresponden, limpia listeners y evita callbacks antiguos. La instancia de
  mapa y el SDK no se vuelven a crear por filtros. Encuadre solo de negocios,
  con manejo de uno, varios y cero. Sin coordenadas de clienta.
- La demo permite exclusivamente GET al módulo nuevo mapa-datos.mjs; continúa el
  bloqueo de otros métodos y archivos no autorizados.

Verificación: 83 pruebas focalizadas aprobadas, cero fallos, omisiones o
cancelaciones, incluyendo A1/A2/A3, proveedores simulados y protección demo.
Sintaxis y git diff --check correctos. No se ejecutó la regresión PostgreSQL.
Chrome a 1440, 768 y 390 px: apertura, detalle, acción Ver servicios, cierre,
filtro Lavanda, cero resultados y Ver todos correctos. Sin desbordamiento
horizontal; ubicación simulada y negocios de meraki_demo, sin crear reservas.
Ningún recurso externo ni SDK Google cargado, configuración ausente.
Capturas guardadas fuera del repositorio con prefijo a3-4-3.

No hubo cambios de base, .env, backend compartido, pagos, suscripciones o Back
Office. No se activó Google Cloud ni hubo cargos. Persisten las limitaciones de
prueba sin proveedor real: faltan comprobaciones reales de credenciales, cuotas,
accesibilidad y errores del SDK. A3.4.4 pendiente de definir/autorizar; revisar
con ChatGPT antes de agregar enlaces de navegación o habilitar Google.
Sin commit ni push.
