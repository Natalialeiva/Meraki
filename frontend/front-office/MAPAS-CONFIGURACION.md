# Estado vigente: Leaflet y OpenStreetMap

El mapa principal usa Leaflet local y teselas OSM. No necesita clave, Map ID,
Google Cloud ni el archivo local de configuración Google. Ver README del repositorio.
La preparación Google que sigue se conserva como documentación histórica/opcional,
no como requisito del mapa principal. No se activó ningún servicio Google.

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

Para revisar sin Google, abrir Meraki principal en http://localhost:3000/front-office/ y pulsar «Ver mapa». Ejecutar estas pruebas desde la raíz del repositorio:

```text
node --test backend/test/front.test.js backend/test/geografia.test.js backend/test/ubicacion.test.js backend/test/mapa.test.js backend/test/mapa-google.test.js
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
horizontal; ubicación simulada y negocios de meraki_demo, sin crear reservas. Esta evidencia corresponde al entorno temporal ya retirado.
Ningún recurso externo ni SDK Google cargado, configuración ausente.
Capturas guardadas fuera del repositorio con prefijo a3-4-3.

No hubo cambios de base, .env, backend compartido, pagos, suscripciones o Back
Office. No se activó Google Cloud ni hubo cargos. Persisten las limitaciones de
prueba sin proveedor real: faltan comprobaciones reales de credenciales, cuotas,
accesibilidad y errores del SDK. A3.4.4 pendiente de definir/autorizar; revisar
con ChatGPT antes de agregar enlaces de navegación o habilitar Google.
Sin commit ni push.


## Preparación persistente para entrega académica — 16/11/2026

El proveedor existente admite ahora `mapas-config.local.json`, junto al HTML del
Front Office. Está excluido de Git; en Adriana se creó deshabilitado y sin clave.
La plantilla compartible es `mapas-config.example.json`. La lectura se realiza solo
al abrir el panel con coordenadas válidas. Ausencia, fallo de lectura o configuración
incompleta conservan el catálogo y el proveedor de preparación existente. No se
agregó otra cartografía ni un simulador. La configuración global por memoria sigue
siendo compatible y tiene prioridad. Recargar después de modificar la configuración.

### Pasos manuales, iguales para Adriana, Natalia y el profesor

1. Obtener autorización antes de activar Google Cloud/facturación. Crear o elegir
   un proyecto propio o del equipo con permisos administrativos suficientes para
   administrar facturación, habilitar APIs y gestionar credenciales/map IDs.
2. Vincular una cuenta de facturación y habilitar **Maps JavaScript API**. No se
   necesitan Places, Directions ni Geocoding para estos marcadores.
3. Crear un Map ID para JavaScript. Utilizar un ID propio; DEMO_MAP_ID no evita costos.
4. Crear una clave de **navegador**, restringida a Maps JavaScript API y Websites
   (HTTP referrers): `http://localhost:3000/*` y, solo si se utiliza,
   `http://127.0.0.1:3000/*`. Añadir por separado cualquier dominio HTTPS de despliegue.
   No usar restricciones de IP de servidor para la clave del navegador.
5. Revisar cuotas, límites aplicables y alertas de presupuesto. Las alertas no
   constituyen un corte automático de gastos. No se promete costo cero: revisar
   tarifas vigentes de Dynamic Maps y la configuración del proyecto.
6. Si falta el archivo local, copiar `mapas-config.example.json` a
   `mapas-config.local.json` en la misma carpeta. Completar apiKey y mapId
   privadamente y poner habilitado/autorizado en true únicamente tras autorización.
   Mantener entorno en produccion para Map ID propio. Nunca guardar contraseñas,
   secretos de sesión, credenciales de pagos o tokens OAuth en este archivo.
7. El archivo es servido al navegador: la clave NO es secreta. Su protección depende
   de las restricciones de sitio/API. No subir el archivo a Git ni compartir capturas
   con la clave. Cada computador debe configurarlo localmente.
8. Abrir `http://localhost:3000/front-office/`, recargar y pulsar Ver mapa.
   No se requiere reiniciar el backend por cambiar un recurso estático. No iniciar
   el servidor sobre una configuración financiera insegura para probar el mapa.
9. Para comprobar funcionamiento real faltan coordenadas autorizadas: confirmar
   SDK oficial, mapa con calles, dos marcadores, selección/Ver servicios y filtros.
   También probar móvil, cierre/reapertura y ausencia de permiso de ubicación.
   No mostrar claves en evidencias. Los fallos permiten continuar con las tarjetas.

### Ubicaciones propuestas, NO guardadas

Son referencias públicas académicas, no domicilios reales de Camila ni Sofía.
Requieren autorización concreta antes de actualizar cualquier fila:

| Negocio propuesto | Referencia | Latitud | Longitud | Comuna de la referencia |
| --- | --- | --- | --- | --- |
| Camila (ID 1) | Plaza de Armas de Santiago | -33.4379667 | -70.6504000 | Santiago |
| Sofía (ID 9) | Museo Parque de las Esculturas | -33.4201806 | -70.6129056 | Providencia |

Fuentes de coordenadas (redondeadas a siete decimales para DECIMAL(10,7)):
https://es.wikipedia.org/wiki/Plaza_de_Armas_de_Santiago y
https://es.wikipedia.org/wiki/Museo_Parque_de_las_Esculturas_de_Providencia .
La municipalidad confirma el segundo lugar y dirección Santa María 2205:
https://www.providencia.cl/provi/explora/turismo/conocenos/parque-de-las-esculturas .
No acreditan una entrada exacta ni la existencia de estos negocios en esos lugares.
Para Sofía, usar esa referencia exigiría autorizar también cambiar comuna/dirección
para evitar contradicción con su comuna actual Santiago, o elegir otro punto aprobado.

El Back Office incorpora ahora latitud y longitud opcionales en Perfil del negocio.
Ambas deben ser válidas o quedar vacías; cero explícito es válido. El servidor
acepta números o cadenas decimales, valida rangos y conserva la propiedad por sesión.
Enviar ambas como null elimina la ubicación; omitir ambas conserva la anterior.
PostgreSQL conserva su precisión existente DECIMAL(10,7). No hay migración.
No se guardaron ubicaciones de Camila ni Sofía durante esta implementación.
La integración SQL comprobó autenticación, propiedad, rechazo de pares incompletos,
lectura pública actualizada y conservación de otros campos y reservas en base efímera.
Resultado de regresión posterior: 493 aprobadas, cero fallidas y omitidas.
Tener coordenadas permite marcadores y distancias; no habilita automáticamente
Cómo llegar: la API sigue sin evidencia de confirmación de destino real.

### Fuentes de configuración y costos

- https://developers.google.com/maps/documentation/javascript/get-api-key
- https://developers.google.com/maps/documentation/javascript/usage-and-billing
- https://developers.google.com/maps/api-security-best-practices

### Verificación de esta preparación

47 pruebas focalizadas aprobadas, cero fallidas y omitidas: configuración local
bajo demanda, lectura compartida, ausencia/fallo/archivo inválido, compatibilidad
por memoria, proveedor Google simulado, selección, filtros y ubicación denegada.
No se activó Google Cloud, no se llamó al SDK real y no se cambiaron datos.
