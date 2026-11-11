# Preparación: claridad y estados del resumen de Reservas

Preparación y módulo de presentación desconectados del Back Office. No crean otra
pantalla Dashboard, endpoints ni cálculos nuevos de indicadores. El módulo solo
mantiene estados de presentación en memoria. No modifica los seis indicadores.
Base inspeccionada: `main`, `16edc33ae800c008726329b03f31b8054b0ef06e`.

## Indicadores y etiquetas propuestas

El alcance siempre es la lista completa devuelta por la consulta autorizada del
emprendimiento seleccionado, no todos los negocios ni solo las tarjetas filtradas.
Texto común: «Resumen del emprendimiento seleccionado. Los filtros cambian la lista,
no estos indicadores. Valores correspondientes a la última carga válida».

| Indicador actual | Etiqueta propuesta | Significado conservado y ayuda |
| --- | --- | --- |
| Reservas en agenda | Total de reservas de la agenda | Todos los registros recibidos, incluidos pendiente_abono, confirmada, atendida, no_atendida y cancelada; sin limitar fechas. No es total de ventas. |
| Para hoy | Reservas de hoy (Santiago) | Inicio en la fecha civil actual de America/Santiago, en cualquier estado, incluidas canceladas. No significa atenciones pendientes de hoy. |
| Confirmadas | Reservas confirmadas | Estado confirmada, con fechas pasadas o futuras; no equivale a ingresos ni prueba un nuevo pago. |
| Pendientes de abono | Reservas pendientes de abono | Estado pendiente_abono. Cuenta reservas, no montos, cobros recibidos ni intentos de pago. |
| Reservas por cerrar | Reservas habilitadas para cierre | Solo puede_cerrar === true proporcionado por la API. No deducirlo de fecha o estado ni sustituir la autorización del servidor. |
| Próxima atención | Próxima atención confirmada | Confirmada futura según el resolvedor actual de Santiago; mostrar servicio/profesional disponibles, sin inventarlos. Sin próximas: «No hay próximas reservas confirmadas». |

Conservar para Próxima atención los estados separados de carga, sin próximas,
falta de Temporal, error y pendiente de revisión. Una hora ambigua no debe producir
una próxima atención declarada cierta. No ejecutar el algoritmo exhaustivo como
fallback automático de interfaz ni modificar su semántica en esta preparación.
Las etiquetas son propuestas para revisión, no cambios ya desplegados.

## Estados visuales

«Datos anteriores» significa la agenda y sus indicadores, no los campos de login.
La elección propuesta es coherente con el limpiado actual: ocultar datos durante
recargas y errores; conservar solo metadatos de la última carga válida del contexto
actual. No mantener una agenda antigua visible como si fuera actual.

| Estado | Mensaje visible | Acciones | Foco | Anuncio accesible | Datos anteriores | Última actualización |
| --- | --- | --- | --- | --- | --- | --- |
| cargando | «Cargando la agenda de [emprendimiento]…». | Esperar; impedir recargas duplicadas, permitir cambiar de negocio con invalidación del intento anterior. | Conservar foco en control estable; no enfocarlo de nuevo por cada evento. | Una región role=status con aria-live polite; aria-busy en región de agenda; sin anunciar tarjetas individualmente. | Ocultar lista e indicadores previos; usar — o Cargando, nunca cero provisional. | No cambiar la marca válida; si existe para este contexto, «Última carga válida…; actualización en curso». |
| agenda_vacia | «Este emprendimiento todavía no tiene reservas». | Actualizar agenda; cambiar negocio. | Conservar foco; el vacío no fuerza navegación. | Anunciar resultado vacío una vez y retirar aria-busy. | Solo respuesta válida [] permite mostrar contadores cero; próxima atención conserva mensaje sin próximas. | Registrar carga exitosa del contexto actual aunque la lista esté vacía. |
| filtros_sin_coincidencias | «No hay reservas para estos filtros». | Limpiar o editar filtros; actualizar agenda. | Mantener foco en filtro usado; al limpiar, dejarlo en botón estable. | Anunciar cantidad visible y total una vez; ayudas de filtros asociadas. | Mantener agenda completa en memoria y sus indicadores; solo lista visible vacía. | Conservar marca: filtrar localmente no es una carga nueva. |
| error_carga | «No pudimos cargar la agenda. Puedes volver a intentarlo». | Reintentar explícitamente; cambiar negocio. | No robar foco si la persona cambió de control; aviso y reintento alcanzables con teclado. | Anunciar error vigente una vez; retirar aria-busy; no leer respuesta HTML ni detalles internos. | No mostrar lista ni ceros; indicadores No disponible o —. | Si no hubo éxito en este contexto, «Sin actualización exitosa en esta sesión». No registrar el fallo como actualización. |
| sesion_vencida | «Tu sesión venció. Inicia sesión para consultar la agenda». | Iniciar sesión; sin reintento protegido antes de autenticar. | Tras confirmar expiración vigente, enfocar encabezado o primer campo del acceso, conforme a navegación acordada. | Anunciar expiración una vez; detener anuncios del panel oculto. | Limpiar agenda, indicadores y metadatos privados de todos los negocios de la sesión; invalidar solicitudes. | Ocultar nombre y marca anteriores; mostrar marca solo tras nueva respuesta autorizada. |
| actualizada | «Agenda de [emprendimiento] actualizada». | Consultar lista, filtros, actualizar o cambiar negocio; sin ejecutar acciones financieras por actualizar. | Mantener foco en Actualizar cuando la acción fue explícita; no enfocar automáticamente una reserva. | Un solo anuncio de éxito; siguiente cambio de filtros anuncia solo visibles/total. | Sustituir lista e indicadores exclusivamente por respuesta válida y vigente; no acumular duplicados. | Registrar hora de recepción/aceptación exitosa para ese emprendimiento, con hora de Santiago. |
| error_actualizacion | «No pudimos actualizar la agenda. Los datos no están disponibles por ahora». | Reintentar explícitamente; cambiar negocio. | Mantener foco estable, aviso próximo al botón Actualizar. | Anunciar error vigente una vez; no anunciar éxito ni cero. | Ocultar lista y métricas anteriores, aunque fueran del mismo negocio; no prometer actualidad. | Conservar valor previo sin alterarlo: «Última carga válida…; la actualización más reciente falló». Si no existe, sin carga exitosa. |
| cambio_emprendimiento | «Cargando la agenda del emprendimiento seleccionado…». | Esperar; seleccionar otro negocio. | Conservar foco en selector. | Anunciar nuevo contexto una vez y carga; no anunciar respuestas descartadas. | Limpiar inmediatamente lista e indicadores del negocio anterior, antes de esperar HTTP. | Ocultar marca y nombre anteriores inmediatamente; sin reutilizar la marca de A al seleccionar B, ni al volver a A hasta cargarlo de nuevo. |

Prioridades: una sesión vencida vigente limpia todo; un cambio de contexto invalida
respuestas previas; solo después una respuesta válida puede determinar vacío o éxito.
Si la lista completa es [], usar agenda_vacia aunque existan filtros. Si contiene
registros pero los filtros no coinciden, usar filtros_sin_coincidencias.
Una respuesta no-array, JSON ilegible o registro requerido inválido es error, no [].
La validación exacta de registros se acordará sin rechazar estados temporales ya
admitidos por el resolvedor: una hora indeterminada debe poder producir revisión,
no convertirse silenciosamente en cero o en pérdida de toda la agenda.

## Última actualización exitosa

- Mantener en memoria una marca para el contexto visible: sesión, emprendimiento
  solicitado/seleccionado, versión de solicitud e instante de aceptación.
- Ejemplo ficticio: «Última carga válida: Negocio de prueba — 18/11/2026, 15:04:12,
  hora de Santiago». Usar Intl.DateTimeFormat('es-CL') con timeZone:
  America/Santiago y hourCycle: h23; mostrar fecha además de hora, sin offsets fijos.
- Es la hora local de recepción/aceptación en el navegador, NO fecha de modificación
  de PostgreSQL, garantía de sincronización global ni hora certificada del servidor.
  El reloj del dispositivo puede ser incorrecto. No alterar horarios de reservas.
- Actualizar únicamente tras HTTP exitoso, respuesta estructuralmente válida y
  control de vigencia superado. La marca y la instantánea aceptada se asocian en
  la misma transición lógica. Un fallo temporal de Próxima atención no impide
  registrar la carga de agenda válida: su estado propio permanece no disponible.
- No cambiar por reintentos iniciados, errores, filtrado, tiempo transcurrido,
  respuestas viejas o estado sin Temporal. Durante una recarga fallida del mismo
  negocio, conservar la marca numérica anterior con advertencia explícita de fallo.
- Al cambiar negocio, ocultar/eliminar la marca anterior de la presentación; al
  volver, exigir nueva carga válida. Cerrar sesión borra sus metadatos. No persistir
  en localStorage, cookies o analítica los nombres ni datos de agenda.
- El paso del tiempo no recalcula los indicadores actuales. Mostrar que son valores
  de la carga indicada; no proponer aquí un temporizador, polling o nuevos cálculos.

## Concurrencia y accesibilidad: reglas de integración futura

Reutilizar los controles existentes de versión de agenda, sesión y emprendimiento.
En A → B → A, la primera respuesta de A no es vigente por coincidir su ID: también
debe coincidir la versión. Un 401 antiguo no puede cerrar una sesión nueva.
Una respuesta vieja no cambia lista, indicadores, mensajes, foco ni última carga.
Abortar solicitudes puede ahorrar trabajo, pero no reemplaza estas comprobaciones.
No modificar el helper compartido de pagos para resolver estados de este panel.

Los contadores se calculan sobre la agenda completa autorizada, antes de filtrar.
No pedir datos de otros negocios para construir comparaciones ni introducir
solicitudes HTTP adicionales solo por cambiar filtros.

Reutilizar una región visible de estado, textos asociados a controles y foco
visible. Evitar duplicar sus anuncios con los role=status actuales de las tarjetas:
la estrategia final debe probarse con lector de pantalla, sin quitar información
accesible de Próxima atención o Reservas por cerrar. No depender solo de color,
iconos o tooltip al explicar el alcance. Permitir lectura de ayudas con teclado
y en móvil; probar nombres largos y zoom. El módulo ya entrega metadatos de foco
y accesibilidad, pero su aplicación al DOM y verificación práctica siguen pendientes.

## Dependencias y límites

Datos suficientes en GET /api/reservas?id_emprendimiento=… con sesión y propiedad
verificadas por el backend. El cliente enlaza la respuesta a ese contexto; no
afirma acreditar la pertenencia individual de cada registro sin ese contexto.
No hacen falta endpoints ni cambios PostgreSQL para esta propuesta.

La integración futura necesitaría acordar con Natalia los cambios delimitados de
back.js, index.html y gestion.css y posiblemente un módulo independiente de
presentación. No modificar permisos, puede_cerrar, reglas temporales, montos,
retornos financieros ni notificaciones. El marcador Dashboard sigue sin activarse.
La exactitud temporal del permiso de cierre del servidor se coordina aparte, no
se corrige reinterpretando sus permisos desde este diseño.

## Comprobaciones y pendientes

Ejecutar: `node --test preparacion/dashboard-reservas/dashboard-reservas.test.cjs`.
Las comprobaciones de `dashboard-reservas.test.cjs` leen documentación y recursos,
sin HTTP, ejecución de backend, PostgreSQL ni proveedores. No constituyen pruebas
de funcionamiento del futuro componente conectado. Sus 12 TODO siguen pendientes
de integración, aunque partes de su lógica se prueban ahora de forma aislada.

## Módulo aislado implementado

Implementado sobre `cada55630cdcc7ad0fd5937b1ef80e4059de7651`, sin integración.

`presentacion.js` exporta por CommonJS `{crearPresentador, formatearSantiago}` y,
como script clásico, `globalThis.MerakiPresentacionReservas`. No requiere DOM,
backend, red, temporizadores, almacenamiento ni dependencias externas. La futura
interfaz debe usar textContent para los textos, incluidos nombres de negocios.

Contrato del presentador:

- `crearPresentador()` devuelve una instancia privada en memoria. Antes del
  contexto hay un estado de guarda `sin_contexto`, sin contadores ni marca.
- `cambiarContexto({sesion, idEmprendimiento, nombre})`: sesión como identificador
  lógico opaco del integrador (NO contraseña, cookie ni token real), ID entero
  positivo y nombre de hasta 150 caracteres. Siempre invalida tickets y limpia
  marca/datos, incluso si vuelve al mismo ID. El integrador debe llamarlo al
  cambiar sesión o negocio. El estado público no expone el identificador de sesión.
- `iniciarCarga()` devuelve un ticket opaco congelado. Llamarlo durante una carga
  devuelve el mismo ticket, sin transición ni anuncio adicional; no inicia HTTP.
  Guardar su referencia para entregar respuesta o error; no reconstruirlo.
- `aceptarRespuesta(ticket, {reservas, idsVisibles?, recibidoEnEpochMs,
  consultaAutorizada, respuestaExitosa})` devuelve true solo al aceptar una carga.
  Ambas banderas deben ser exactamente true y proporcionarse tras autorización
  real del servidor; NO autentican por sí mismas. El módulo no puede acreditar
  pertenencia individual cuando la API no trae id_emprendimiento. Si lo trae y
  contradice el contexto, rechaza la lista.
- La validación mínima requiere array, IDs positivos sin duplicados, estados del
  contrato actual y campos temporales string. No resuelve ni valida calendarios
  civiles: deja sus exclusiones al módulo temporal existente. No cambia permisos
  ni calcula los seis indicadores. Una fecha indeterminada puede coexistir con
  carga válida y Próxima atención pendiente de revisión en el integrador.
- `idsVisibles` es un subconjunto único de IDs de la respuesta; por defecto son
  todos. `aplicarFiltro(idsVisibles)` actualiza solo visibles/estado, sin modificar
  total o marca. Los filtros reales siguen siendo responsabilidad del integrador.
  Un filtro inválido lanza TypeError sin cambiar el estado; sin datos válidos retorna
  false. Si la cantidad visible no cambia, no genera otro anuncio del resumen.
- `registrarError(ticket, {sesionVencida?})`: error normal oculta datos y conserva
  marca del mismo contexto si existe; expiración vigente elimina contexto, datos y
  marca. No recibe ni publica detalles internos de excepciones.
- Tickets viejos, reconstruidos, ya consumidos o de otra instancia se ignoran
  devolviendo false, sin modificar estado, marca, foco ni anuncio. No sustituye
  el control de sesiones y respuestas antiguas del código que realizará HTTP.
- `obtenerEstado()` devuelve una instantánea profundamente congelada con `estado`,
  `emprendimiento`, `mensaje`, `acciones` declarativas, `datos`, `ultimaActualizacion`,
  `foco` y `accesibilidad`. No devuelve reservas ni conserva sus objetos originales;
  retiene solo IDs de la agenda aceptada, contexto y marca durante la visita.
  Ocultar datos significa total/visibles null, no cero. `indicadores` indica
  `usar_agenda_completa` o `no_disponibles`, sin reemplazar sus cálculos.
- `anuncioId` identifica cada transición aceptada para que el integrador la anuncie
  una sola vez. No garantiza por sí solo un anuncio real ni mueve foco. El estado
  cambio_emprendimiento sugiere selector; sesión vencida sugiere acceso; el resto
  conserva foco. `acciones` nunca se ejecutan desde este módulo.

Ejemplo ficticio, sin solicitudes:

```js
const {crearPresentador} = require('./presentacion.js');
const panel = crearPresentador();
panel.cambiarContexto({sesion:'visita-ficticia', idEmprendimiento:1, nombre:'Negocio ficticio'});
const ticket = panel.iniciarCarga();
panel.aceptarRespuesta(ticket, {
  reservas: [], consultaAutorizada:true, respuestaExitosa:true,
  recibidoEnEpochMs: Date.UTC(2026, 10, 18, 18, 4, 12)
});
const vista = panel.obtenerEstado(); // agenda_vacia; carga válida, no error
```

Ejecutar pruebas del módulo: `node --test preparacion/dashboard-reservas/presentacion.test.cjs`.
Usan exclusivamente reservas ficticias. Las pruebas incluyen instantes de verano,
invierno, transiciones y cruce de año, procesos con UTC/Tokio/Santiago y script
en contexto sin DOM ni servicios externos. No constituyen revisión en navegadores
reales ni prueban un lector de pantalla. Intl utiliza las reglas horarias del
entorno; el reloj de aceptación es explícito y debe proporcionarlo el integrador.
No se usa Date.now ni se garantiza que el reloj del equipo esté sincronizado.

Resultado de esta etapa: 33 pruebas del módulo y 7 comprobaciones documentales
aprobadas (40), sin fallos; 12 criterios de integración TODO permanecen pendientes.
Regresión existente de agenda/interfaz: 16 aprobadas, sin fallos ni omisiones.
Total ejecutado aprobado: 56; los TODO no se incluyen en ese total.

Antes de integrar, probar con transporte simulado los ocho estados, respuestas
antiguas, sesión, filtros y marcas; después realizar revisión real de teclado,
lector de pantalla, escritorio y móvil. No ejecutar pruebas financieras para esta
preparación ni utilizar bases históricas.

Siguiente paso independiente: acordar las etiquetas y la matriz con Adriana y
Natalia; preparar después ejemplos ficticios de transiciones y un contrato de
presentación, todavía sin conectarlo al Back Office.
