# Dashboard: gráficos y resumen económico

Implementación frontend sobre la agenda autenticada existente. No añade endpoints,
consultas, librerías, acceso directo a PostgreSQL ni operaciones financieras.

## Fuente y filtros

La única fuente de las reservas es `GET /api/reservas?id_emprendimiento=…`, con
sesión y propiedad comprobadas por el servidor. Se mantiene el descarte de respuestas
antiguas y la limpieza al cambiar emprendimiento o perder la sesión.
Fecha diaria y estado del Dashboard afectan los indicadores, la dona y las distribuciones.
La evolución mensual de cantidades comparte el mes económico y el estado, sin reducirse a la fecha diaria.
El resumen económico tiene selector propio de mes/año, predeterminado al mes
actual de America/Santiago. Utiliza ese mes y el filtro de estado; ignora la fecha
diaria para no convertir un resumen mensual en el importe de un día. Se aclara en pantalla.
Los filtros de Reservas permanecen independientes. «Actualizar datos» reutiliza
la carga de agenda; navegar o filtrar no realiza solicitudes nuevas.

`estadisticas-reservas.js` sigue siendo el cálculo existente de cantidades,
porcentajes, duplicados y distribución por IDs. No se alteró su fuente generada.
`dashboard-graficos.js` añade únicamente agrupación mensual, importes y presentación.
El componente de distribución se sigue moviendo entre Reservas y Dashboard: no se
mantienen dos copias de sus barras o cálculos.

## Gráficos

- Dona por estado: cantidades del desglose existente, porcentaje respecto al total
  único filtrado y leyenda textual. Todos los estados reales se identifican por
  nombre y cantidad, sin depender solo del color.
- Barras existentes por servicio y profesional: cantidad real y porcentaje del
  total único; se conserva su desglose, empates y advertencias.
- Línea mensual por **fecha de atención**, usando `fecha_hora_inicio` civil de
  Santiago. No usa fecha de creación ni convierte los componentes civiles a UTC.
  Usa el mes seleccionado en el Resumen económico y cinco anteriores, ordenados
  cronológicamente, con cero en meses sin reservas. Comparte periodosMensuales()
  con el cálculo económico, sin alterar importes. Deduplica por id_reserva.
  La tabla accesible muestra cantidades exactas. Si todos los meses son cero,
  muestra la tabla y un aviso, sin dibujar una línea engañosa.
- Comparación económica: valor contractual de servicios de reservas activas frente
  a sus abonos contractuales. El abono forma parte del valor del servicio; no se
  suman como conceptos adicionales ni se presentan como cobros.
- Evolución económica de seis meses: mes seleccionado y cinco anteriores, por
  fecha de atención. Incluye ceros explícitos en meses sin reservas, conforme al
  ajuste mensual. Ambas evoluciones comparten la misma ventana de períodos.
  Si falta un importe en un mes, se indica no disponible, no cero, y no se traza
  una línea que invente ese dato. Hay tabla mensual y líneas continua/discontinua.

## Importes históricos y estados

Todos los valores monetarios corresponden al mes de atención seleccionado (no son
acumulados generales) y usan `reserva.precio_servicio` y `reserva.monto_abono` de la agenda,
no el catálogo actual. Son CLP. La suma utiliza centavos enteros para conservar
los dos decimales que permite el esquema; se valida el rango y la precisión.

| Indicador | Regla |
| --- | --- |
| Valor de servicios del mes sin canceladas | Suma de precio_servicio de confirmada, pendiente_abono, atendida y no_atendida del mes, aplicando el estado seleccionado. |
| Valor proyectado de reservas activas del mes | Suma de precio_servicio de confirmada y pendiente_abono del mes. Excluye canceladas. |
| Abonos esperados contractualmente del mes | Suma de monto_abono de confirmada y pendiente_abono del mes; no significa abonos pendientes ni aprobados: podrían haberse pagado y esta fuente no permite comprobarlo. |
| Tabla por estado | Precio y abono requeridos de cada estado del mes. Incluye canceladas cuando el filtro las muestra, explícitamente separadas de las proyecciones activas. |

Estos valores no son ingresos, pagos recibidos ni deuda contable. Tampoco el estado
confirmada se interpreta como evidencia de pago. No se lee `estado_abono` para
convertir el monto requerido en dinero recibido.

Un duplicado idéntico se cuenta una sola vez. Si un ID repetido presenta importes
contradictorios, falta un importe, es negativo, tiene precisión inválida, excede el
rango, o su abono supera su precio, el resumen económico no muestra sumas parciales.
Los gráficos de cantidades siguen disponibles si sus datos sí son válidos.
Una agenda vacía válida muestra ceros; un error limpia gráficos y valores anteriores.

## Datos que faltan para otras métricas

No se necesita un cambio de API para lo implementado. Para una evolución por fecha
de creación faltaría exponer esa fecha: se eligió la de atención y se indica en pantalla.
Para dinero efectivamente recibido se necesitaría una fuente autorizada de abonos
aprobados con importes reales, fechas y tratamiento de anulaciones/conciliación.
La agenda actual solo resume el último intento y el monto requerido: no basta para
una contabilidad de pagos. Ese trabajo requeriría coordinación con Natalia.

## Verificaciones

- Ajuste de evolución de cantidades: 78 pruebas focalizadas aprobadas, 0 fallidas
  y 0 omitidas. Incluyen seis meses, ceros, cambio de año, fechas civiles,
  duplicados, Todos/Confirmada, coherencia SVG/tabla y conservación de indicadores.
  Comprobación con navegador y API simulada: seis filas correctas, período vacío
  sin SVG, ancho de 360 px sin desbordamiento y sin errores de consola.
  No se consultó PostgreSQL para este ajuste.

- 125 pruebas focalizadas aprobadas, 0 fallos y 0 omisiones, tras el ajuste mensual:
  meses con cero, cruces de año/Santiago, mes independiente de fecha diaria, precisión,
  períodos inválidos y meses con datos económicos no disponibles; además de gráficos, economía,
  agenda, filtros, estados vacíos, errores y regresiones de Reservas.
- 22 pruebas de integración aprobadas, 0 fallos y 0 omisiones, en base efímera
  `meraki_mvp_efimera_1794586022184_8424cb0d`. Las sumas del Dashboard se contrastaron
  con SQL sobre reservas de esa base y el backend original. La base fue eliminada
  y su ausencia comprobada. Proveedores bloqueados; sin operaciones externas.
  Repetición mensual: 22 aprobadas en `meraki_mvp_efimera_1794587206883_ffbe2fba`,
  también eliminada y con ausencia comprobada.
- Navegador integrado: 1440, 768 y 360 px, sin desbordamiento horizontal ni errores
  JavaScript, con API simulada de solo lectura y los archivos originales.
  Se verificaron Todos, Confirmada y fecha; la comprobación visual no usó datos históricos.
- Sintaxis y git diff --check correctos. El aviso de conversión LF/CRLF corresponde
  a la configuración de Git y no es un fallo funcional.

No se modificaron backend/index.js, módulos financieros, notificaciones, configuración,
bases conservadas ni el laboratorio de reserva invitada. Sin commit ni push.

Para revisar los cambios en una instancia ya abierta, recargar el Back Office y
entrar en `#tituloDashboard`; no reiniciar el script temporal ni cerrar su consola.
