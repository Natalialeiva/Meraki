# Front Office — Fase A, bloque A2

> Registro histórico. El puerto 3001 fue un entorno temporal de desarrollo. Los comandos y rutas de demo citados aquí se conservan como evidencia y ya no forman parte del proyecto. La plataforma vigente se ejecuta en localhost:3000.

Estado vigente: **Bloque A2 aprobado por Adriana, pendiente de publicación manual**.
El cierre A2.3 al final de este documento describe los recursos y resultados
actuales. Las secciones anteriores son historial y no describen la versión final.

Implementado y verificado en el computador de Adriana el 4 de noviembre de 2026.
Punto de partida: `main` limpio en `1c783ab`, después de publicar A1 y la demo.

## Recursos oficiales y decisiones visuales

Se revisaron las tres imágenes entregadas antes de editar. La primera se utiliza
solo como referencia de estética; no se copian su marca, fotografía, textos ni
estadísticas. Las otras dos imágenes se copian fielmente a:

- `frontend/front-office/assets/banner-meraki.png` (854 × 960).
- `frontend/front-office/assets/logo-meraki.png` (854 × 480).

Sus SHA-256 coinciden con los originales y se comprueban mediante pruebas. Los
originales externos al proyecto no se modificaron. Se usan rutas relativas.
No hay imágenes sustitutas, filtros, recortes ni deformaciones.

Las frases oficiales permanecen incrustadas en el banner, exactamente como fueron
entregadas:

> Encuentra el cuidado que buscas, cerca de ti
>
> Descubre servicios de cuidado personal ofrecidos por emprendedoras

No se duplican visualmente en HTML. El atributo alt reproduce el mensaje para
lectores de pantalla. El logo se presenta como imagen, nunca como texto recreado.
Sus márgenes originales forman parte del recurso y también se conservan.

La paleta combina crema, ciruela, rosa y lavanda con títulos serif de sistema.
No se instalan dependencias ni se descargan tipografías o recursos externos.
En computador se distribuyen búsqueda y banner en columnas; en teléfono se
apilan. El banner contiene un área vacía grande en su mitad inferior: se conserva
por instrucción de mantener íntegra la imagen. Como su subtítulo se reduce con
la imagen en teléfonos, se ofrece «Ampliar banner» y texto alternativo, sin
reescribir ni recortar las frases para intentar adaptarlas.

## Mejoras implementadas

- Encabezado con logo oficial, búsqueda, catálogo y acceso al Back Office.
- Navegación adaptable, enlace para saltar a la búsqueda, foco visible, controles
  táctiles y respeto de preferencias de movimiento reducido.
- Búsqueda con jerarquía visual clara, sin cambiar filtros ni contratos de API.
- Tarjetas reales sin fotografías inventadas; categoría, comuna, descripción,
  precio, duración, abono y disponibilidad diferenciados visualmente.
- Pasos de servicio, profesional, fecha/hora y datos de contacto; resumen lateral
  en computador y apilado en tablet/teléfono. Campos y estados accesibles.
- Se conservan literalmente el mensaje neutral de indisponibilidad y todos los
  controles de A1: selección explícita, validación, limpieza de horas, respuestas
  antiguas, doble envío, nombre por reserva y enlace privado hacia el abono.
- No se reintroduce la casilla de confirmación ni se modifican reglas de reserva.

## Archivos afectados

Front Office y pruebas:

- `frontend/front-office/index.html`.
- `frontend/front-office/styles.css` (nuevo).
- `frontend/front-office/front.js` (solo marcado de presentación de tarjetas).
- Los dos PNG oficiales nuevos en `assets/`.
- `backend/test/front.test.js` (3 pruebas adicionales y comprobación de comuna).

Demo independiente:

- `demo/server.cjs`: permite exclusivamente el CSS y los dos PNG oficiales nuevos,
  además de las consultas ya autorizadas; no abre un acceso general a recursos.
- `demo/server.test.cjs`: verifica esos recursos y rechaza otros archivos/rutas.
- `demo/verify.cjs`: informa por separado las sesiones en su comparación histórica.
  El primer control histórico detectó diferencias solo en `sesion_meraki`, con el
  mismo número de filas; las sesiones pueden variar con el uso del entorno normal.
  La comparación antes/después de cada ejecución continúa incluyendo todas las
  tablas; los datos históricos del negocio mantienen una comparación estricta.
- `demo/README.md`: documenta los recursos permitidos y esta distinción de auditoría.
- Este documento de continuidad.

No se modifican el backend compartido, Back Office, autenticación, Gmail, Webpay,
Oneclick, reglas de suscripción, migraciones, datos de PostgreSQL ni archivos `.env`.

## Pruebas y comprobaciones

- Batería completa `npm.cmd test`, con `MERAKI_DB_TEST=1` y
  `MERAKI_SUSCRIPCIONES_AUTOMATICAS=0`: **148 pass, 0 fail, 0 skipped, 0 cancelled**.
  Se ejecutaron ambos grupos de integración; Oneclick, Webpay y SMTP simulados,
  esquemas PostgreSQL temporales sin acceso de negocio a `public`.
- 3 pruebas adicionales de protección de la demo aprobadas; total de ambas
  baterías: **151 resultados aprobados**. No forman parte del script npm principal.
- Las 23 pruebas de Front Office incluyen las 20 de A1 y 3 nuevas: integridad de
  imágenes, rutas/textos accesibles sin duplicación y navegación/ayudas válidas.
- `demo/verify.cjs`: catálogo reservable, profesional y 9 horas de la demo; 14 rutas
  de escritura/retorno bloqueadas; cero intentos externos y datos demo intactos.
- Chrome a 1440, 1024, 768, 390 y 320 píxeles: navegación y recursos completos,
  proporciones originales, sin filtros, errores JavaScript ni desplazamiento
  horizontal accidental. Comprobado en ambos estados: inicio y resumen completo.
- Filtros con coincidencias y sin resultados, Ver todos, selección de servicio,
  profesional, fecha, horas y resumen verificados sobre `meraki_demo`. No se envía
  el formulario de reserva.
- SHA-256 de ambas copias idénticos a sus originales. No se publica la imagen de
  inspiración ni se hace referencia a carpetas privadas de Windows.
- Comparación de las 20 tablas de `meraki_db` antes/después de la batería completa:
  todas intactas, con 7 reservas, 6 abonos y 2 clientas; sin esquemas temporales nuevos.
- Sintaxis y `git diff --check` correctos. Persiste la advertencia previa del router
  sobre manejadores Promise-like y los avisos de Git sobre LF/CRLF.

Capturas, métricas de navegador y registros de pruebas guardados fuera del
repositorio, en los artefactos de esta conversación. No hubo reservas, cargos,
inscripciones, envíos reales ni activación de renovaciones automáticas.

## Continuidad para ChatGPT y Natalia

La demo queda en `http://localhost:3001/front-office/`, con las protecciones previas.
Para verla, recargar con Ctrl+F5. En el computador de Natalia bastan sus archivos y
configuración locales; no se requieren cambios de API ni migraciones. Si utiliza
el servidor demo, debe reiniciarlo para que permita CSS e imágenes. La nueva
presentación también usa los mismos recursos relativos en el servidor normal.

Pendiente: revisión personal de Adriana de la identidad visual y su comodidad de
uso, especialmente la presentación íntegra del banner en teléfonos. Recomendado
como siguiente bloque: incorporar sus observaciones y una revisión adicional de
accesibilidad y navegación, antes de ampliar funcionalidades. Geolocalización y
dashboard no iniciados. Sin commit ni push; detenerse para coordinación.

## Segunda revisión visual de A2

Adriana solicitó mayor protagonismo del banner, menos espacio vacío, búsqueda
compacta, precios más visibles y un formulario de reserva más concentrado.
Se inspeccionaron la referencia original y las capturas de la primera revisión.

Cambios de presentación:

- Logo de mayor tamaño y encabezado más compacto, aprovechando los márgenes de
  fondo del recurso sin editar el archivo, deformarlo ni ocultar sus trazos.
- Banner a todo el ancho del contenido. La imagen original se renderiza completa,
  en su proporción natural; el buscador y el contenido siguiente ocupan su zona
  inferior de fondo vacío. No se recortan ni cubren la fotografía o las frases.
- Buscador horizontal en computador, con título secundario y campos compactos.
  En teléfono se apila justo después de la fotografía, sin la gran separación
  de la versión anterior. Se conservan ambos filtros y el botón Ver todos.
- Tarjetas en tonos marfil, lavanda y rosa empolvado. Un único emprendimiento se
  presenta como tarjeta horizontal en computador, evitando una columna vacía.
- Servicio con precio total y abono destacados; el único servicio se organiza en
  una ficha horizontal. En teléfono su información se reorganiza sin ocultarse.
- Profesional y fecha/hora se presentan juntos en computador, contacto debajo y
  resumen lateral con etiquetas y valores diferenciados. En teléfono se apilan.
- Fecha legible en español en el resumen (por ejemplo, «jueves, 5 de noviembre de
  2026»). El input, la consulta de disponibilidad y el envío conservan AAAA-MM-DD.
- El mismo elemento de mensajes se sitúa dentro de la reserva cuando se trabaja
  en ella, y vuelve al catálogo al buscar. No cambian los mensajes ni decisiones
  de negocio; se corrige su ubicación visual.

Archivos de esta segunda revisión: `frontend/front-office/index.html`,
`frontend/front-office/styles.css`, `frontend/front-office/front.js`,
`backend/test/front.test.js` y este documento. No se modificaron módulos compartidos
del backend, demo, PostgreSQL, `.env`, pagos, suscripciones ni correo en esta revisión.
Los cambios previos de A2 en la demo permanecen pendientes de publicación.

Pruebas de cierre de la segunda revisión:

- **150 pass, 0 fail, 0 skipped, 0 cancelled** en la batería principal, con ambos
  grupos de integración aislados y proveedores simulados.
- **3 pruebas de protección de la demo aprobadas** adicionales: 153 resultados
  aprobados entre ambas baterías. El Front Office tiene 25 casos dentro de los 150.
- Se conservan las pruebas de A1. Se añadieron dos casos para comprobar la fecha
  localizada sin cambios del payload y los mensajes dentro de su contexto.
- Comprobación visual de inicio a 1440, 1024, 768, 390 y 320 px, y de reserva a
  1440, 768, 390 y 320 px. Filtros, profesional, horas y resumen operativos; no se
  envió ninguna reserva. Sin desbordamiento horizontal ni errores JavaScript.
- PNG oficiales sin cambios: hashes originales y proporciones comprobados.
- Las 20 tablas de `meraki_db` coincidieron antes/después de la batería completa,
  incluidas 7 reservas, 6 abonos y 2 clientas; sin nuevos esquemas de prueba restantes.
- Renovaciones automáticas deshabilitadas; no hubo cobros, inscripciones ni correo.

Capturas fuera del repositorio: `a2-r2-inicio-1440.png`, `a2-r2-inicio-390.png` y
`a2-r2-reserva-1440.png`, además de las otras dimensiones y las métricas del navegador.
El servidor demo permanece en localhost:3001. Pendiente únicamente la revisión
personal de Adriana de esta propuesta, antes de nuevos ajustes o publicación.
No se realizó commit ni push.

## A2.2 — Fondo y acabado visual

Se mantiene la composición y toda la lógica de la segunda revisión. Este ajuste
se limita a estilos, la versión de caché del CSS y el color de tema del navegador.

- Base crema `#f6f0eb` y marfil `#fbf8f4`, con halos radiales de rosa `#f3e5e8`
  y lavanda `#efe7f3`. Son fondos CSS suaves, sin nuevas imágenes ni adornos fuertes.
- Marco claro y sombra alrededor de la fotografía del banner, sin recortar ni
  aplicar filtros al recurso oficial. Halo suave bajo el buscador, en el área
  vacía de fondo del recurso, sin cubrir la fotografía o las frases.
- Buscador, catálogo y reserva con superficies diferenciadas, bordes finos,
  esquinas suaves y sombras de baja intensidad.
- Inputs y selects con acabado de marfil, sombra interior discreta y foco visible;
  errores y estados deshabilitados conservan sus diferencias visuales.
- Tarjetas con transiciones suaves entre marfil, rosa y lavanda; CTA ciruela y
  botones secundarios claros. El resumen tiene una superficie lavanda más marcada,
  iluminación suave y contraste para el importe total.
- Espacios interiores ajustados a teléfono; sin cambiar el orden del flujo.

Archivos de A2.2: `frontend/front-office/styles.css`,
`frontend/front-office/index.html` (solo dos metadatos de presentación) y este
documento. No se modifican JavaScript funcional, pruebas, demo, backend, API,
imágenes oficiales, PostgreSQL ni `.env` durante este ajuste. Los cambios de
revisiones anteriores siguen pendientes de publicación.

Verificación de A2.2:

- 28 pruebas focalizadas aprobadas: 25 de Front Office y 3 de protección de la demo,
  sin fallos, omisiones ni cancelaciones. No se repite la batería PostgreSQL, ya
  que este ajuste no cambia código funcional ni ejecuta escrituras de ningún tipo.
- Chrome: inicio a 1440, 1024, 768, 390 y 320 px; resumen a 1440, 768, 390 y 320 px.
  Búsqueda, ausencia de resultados, Ver todos, servicio, profesional, fecha, horas
  y resumen correctos. Sin errores JavaScript ni desbordamiento horizontal.
- Imágenes con proporciones originales, `object-fit:contain`, sin filtros ni
  transformaciones. Las pruebas de identidad mantienen los SHA-256 oficiales.
- Consultas `BEGIN READ ONLY` compararon las 20 tablas principales con el cierre
  de la revisión anterior: ninguna diferencia. Se conservan 7 reservas, 6 abonos
  y 2 clientas. No se modificó ninguna estructura ni dato PostgreSQL.
- `/demo/estado`: `meraki_demo`, solo lectura, renovaciones deshabilitadas y cero
  intentos de Webpay, Oneclick o correo. No se envió el formulario de reserva.
- `git diff --check` sin errores; permanecen los avisos informativos LF/CRLF.

Capturas fuera del repositorio: `a2-2-inicio-1440.png`, `a2-2-inicio-390.png`,
`a2-2-reserva-1440.png` y las demás dimensiones. La demo permanece en
localhost:3001; recargar con Ctrl+F5 para obtener el CSS actualizado.
Sin commit ni push. Detenerse para revisión personal de Adriana.


## Cierre A2.3 aprobado — continuidad y publicación

Adriana aprobó el diseño final del Bloque A2. No iniciar geolocalización ni dashboard.

- Recursos activos: `frontend/front-office/assets/banner-meraki-nuevo.png`
  (1672 × 941) y `logo-meraki-transparente.png` (2172 × 724, transparencia real).
  Se copiaron sin alterar sus bytes; las dos imágenes anteriores se conservan
  en la misma carpeta para recuperación y sus hashes siguen comprobados.
- Se eliminaron las figuras abstractas. Banner completo, sin recortes ni textos
  visibles duplicados; CTA «Explorar emprendimientos» fuera de la imagen.
  Se retiró «Ampliar banner». El hero tiene un ancho máximo de 1060 px.
- Último ajuste: errores individuales tras interacción con cada campo o intento
  de continuar. Se conservan las reglas de validez y los contratos de reserva.
- **Limitación pendiente:** en teléfonos el subtítulo incrustado resulta pequeño
  al reducir el banner horizontal completo. La imagen y ambas frases se conservan
  íntegras. El enlace de ampliación ya no forma parte del diseño aprobado.
  Cualquier solución futura debe coordinarse antes de cambiar el recurso oficial.
- Última batería principal: **151 pass, 0 fail, 0 skipped, 0 cancelled**, incluidas
  las integraciones PostgreSQL en esquemas temporales y proveedores simulados.
  Otras **3 pruebas de protección de demo aprobadas**: 154 resultados en total.
- Última comprobación visual: escritorio 1440 px, tablet 768 px y teléfono 390 px,
  sin desbordamiento horizontal ni errores JavaScript. Catálogo, selección,
  disponibilidad y resumen comprobados sin enviar la reserva.
- Demo `localhost:3001/front-office/`: `meraki_demo`, usuario lector, escrituras
  bloqueadas, renovaciones automáticas deshabilitadas y cero intentos externos.
  No hubo reservas, pagos ni correos reales.
- No se modificaron módulos compartidos de ejecución del backend, Back Office,
  PostgreSQL principal, pagos, suscripciones, Gmail, migraciones ni `.env`.
  El único archivo modificado bajo `backend/` es `test/front.test.js`.

Preparación de publicación: rama local `main` en `1c783ab`; consulta directa
`git ls-remote origin refs/heads/main` confirma el mismo commit remoto
`1c783ab276008ed7e498203e582e31706a0568b5`. No se integraron cambios.
Los archivos privados `.env` y `.env.*` están ignorados; capturas, registros y
respaldos permanecen fuera del conjunto a publicar. No hay credenciales ni rutas
privadas en los cambios seleccionados. La revisión corresponde a este momento;
comprobar de nuevo el remoto antes de publicar si transcurre tiempo.

Publicar manualmente un único commit del Bloque A2 con los recursos, pruebas,
documentación y ajustes de demo relacionados. Mensaje propuesto:
`feat(front-office): cerrar diseño responsive e identidad visual del bloque A2`
Sin commit ni push automáticos. Detenerse para compartir el informe con ChatGPT.
