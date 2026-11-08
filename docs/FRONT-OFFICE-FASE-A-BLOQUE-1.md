# Front Office — Fase A, bloque 1

> Registro histórico. El puerto 3001 fue un entorno temporal de desarrollo. Los comandos y rutas de demo citados aquí se conservan como evidencia y ya no forman parte del proyecto. La plataforma vigente se ejecuta en localhost:3000.

Verificado en el computador de Adriana el 4 de noviembre de 2026.

## Punto de partida

Ya existían búsqueda por nombre/comuna, selección de servicios, profesionales,
disponibilidad, resumen y creación de reservas con enlace privado para continuar
al abono. Las respuestas de profesionales tenían protección contra cargas antiguas.
La interfaz atribuía `reservable:false` a falta de profesionales y exigía una casilla
adicional; no validaba todos los datos al habilitar el botón de reserva.

## Cambios

- `reservable:false` utiliza «Este servicio no está disponible para reservar por el
  momento». No se deducen ni muestran causas de facturación.
- Tarjetas con nombre, emprendimiento, categoría, descripción, precio, duración,
  abono y disponibilidad, usando exclusivamente los datos públicos existentes.
- Selección explícita de profesional y hora. Los cambios de servicio, profesional
  o fecha eliminan las horas anteriores. Las consultas tardías y sus errores no
  reemplazan resultados nuevos.
- Resumen con negocio, servicio, profesional, fecha, hora, total, abono y correo.
  Se elimina la casilla; el botón requiere datos válidos y una hora consultada
  para la selección actual. Se conservan el bloqueo de doble envío y el enlace
  privado. La creación sigue enviando `nombre_clienta` por reserva.
- Etiquetas, ayudas y errores asociados a campos, estados de carga/error/éxito,
  foco de teclado estable al elegir tarjetas y distribución de una columna en móvil.

## Archivos

- `frontend/front-office/index.html`
- `frontend/front-office/front.js`
- `backend/test/front.test.js`
- Este documento de continuidad.

No se modifican API, backend de negocio, Back Office, Webpay, Oneclick, Gmail,
suscripciones, migraciones ni `.env`. No se agregan dependencias.

## Verificación

- Front Office: 20 pruebas aprobadas (antes 5; 15 casos adicionales).
- Batería completa: **145 pass, 0 fail, 0 skipped, 0 cancelled**, incluidos ambos
  grupos PostgreSQL. Oneclick, Webpay y SMTP simulados; esquemas temporales.
- Comparación antes/después de las 20 tablas de `public`: datos intactos,
  incluidas 7 reservas, 6 abonos y 2 clientas. Sin esquemas temporales nuevos al final.
- Chrome sin interfaz visible: catálogo local real y formulario con respuestas
  simuladas a 1280 y 390 píxeles. Sin errores JavaScript ni desbordamiento horizontal.
  El formulario simulado pasa la validación nativa, exige profesional/hora y permite
  continuar sin casilla. No se pulsa crear reserva contra la base principal.
- Sintaxis JavaScript y `git diff --check` correctos. Persiste la advertencia previa
  del router sobre manejadores Promise-like; no impide las pruebas.
- Procesador automático deshabilitado con `MERAKI_SUSCRIPCIONES_AUTOMATICAS=0`.

Las capturas y el registro completo se conservan fuera del repositorio, en el
directorio de artefactos de esta conversación. La revisión visual de escenarios
reservables usa datos ficticios exclusivamente en el navegador, porque los
negocios locales no tienen vigencia. No se alteró esa restricción para probar.

## Continuidad para Natalia y ChatGPT

No se requieren migraciones ni acciones de backend de Natalia para este bloque.
Se conserva el contrato de `reservable` y el flujo existente hacia `/consulta/#token`.
Para ver los cambios, recargar `/front-office/`; el script tiene nueva versión de caché.
No se hicieron commit ni push. Revisar Changes en GitHub Desktop antes de compartir.

Adriana completó la revisión manual en localhost:3001 y confirmó que el recorrido
funciona correctamente. El Bloque A1 queda listo para revisión y publicación desde
GitHub Desktop. En el cierre se repitieron las 20 pruebas del Front Office y las
3 de protección de la demo: 23 aprobadas, sin fallos ni omisiones. Estas pruebas
de cierre no sustituyen la batería completa de 145 resultados registrada arriba.

Los seis archivos independientes de `demo/` se revisaron como un segundo grupo,
para publicarlos en un commit separado. Su configuración privada no se publica.
Pendiente: mejoras posteriores de presentación y navegación y pruebas en más
dispositivos, según la coordinación con ChatGPT y Natalia. No se inició el Bloque
A2, geolocalización ni dashboard.
