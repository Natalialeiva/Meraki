# Estadísticas de reservas: módulo independiente

Preparación sobre `main`, commit `6e6b3898c26a21fa7ef6ffad9f2019c921d9c3a2`.
No integrado al Back Office ni al backend. Solo calcula distribución de reservas
de una lista ya autorizada y proyectada; no obtiene datos ni valida sesiones.

## Entrada y uso

CommonJS: `const {calcularEstadisticasReservas} = require('./estadisticas.js')`.
Script clásico: `globalThis.MerakiEstadisticasReservas.calcularEstadisticasReservas`.
No hay dependencias, DOM, HTTP, PostgreSQL, proveedores ni reloj del sistema.

```js
const resultado = calcularEstadisticasReservas([{
  id_reserva: 1,
  id_servicio: 10,
  servicio: 'Servicio ficticio',
  id_trabajadora: 20,
  trabajadora: 'Profesional ficticia',
  estado: 'confirmada',
  fecha_hora_inicio: '2026-11-18T15:00:00',
  fecha_hora_fin: '2026-11-18T16:00:00'
}]);
```

Son los ocho campos admitidos; no enviar el objeto completo de la API con clienta,
correo, teléfono, abonos, montos o tokens. El integrador deberá construir esta
proyección explícita tras obtener una respuesta autorizada. Los campos adicionales
se rechazan sin copiar sus valores a diagnósticos. El módulo no puede detectar
datos personales colocados erróneamente dentro de nombres públicos permitidos.

IDs: números enteros positivos seguros. No convierte strings, booleanos, cero,
null, NaN o Infinity en identificadores. Los nombres deben ser strings no vacíos
de hasta 150 caracteres (servicio) o 100 (profesional); no se agrupa por ellos.
Las cadenas civiles exigen YYYY-MM-DDTHH:mm:ss, calendario válido y fin posterior
al inicio. No se convierten a UTC ni se resuelve DST: horas civiles repetidas o
inexistentes pueden contarse como registros, sin afirmar un instante de atención.
No determina cuáles son futuras ni calcula productividad o próximas atenciones.

## Salida

```js
{
  estado: 'disponible',
  estadisticas: {
    totalReservasUnicas: 1,
    duplicadosOmitidos: 0,
    porServicio: [{
      id_servicio: 10, servicio: 'Servicio ficticio', nombres: ['Servicio ficticio'],
      reservas: 1, porcentaje: 100,
      porEstado: {pendiente_abono: 0, confirmada: 1, atendida: 0, no_atendida: 0, cancelada: 0}
    }],
    porProfesional: [{
      id_trabajadora: 20, trabajadora: 'Profesional ficticia', nombres: ['Profesional ficticia'],
      reservas: 1, porcentaje: 100,
      porEstado: {pendiente_abono: 0, confirmada: 1, atendida: 0, no_atendida: 0, cancelada: 0}
    }],
    serviciosMasReservados: [10],
    profesionalesMasReservados: [20]
  },
  incidencias: [],
  advertencias: []
}
```

Ante entrada inválida: `{estado:'no_disponible', estadisticas:null,
incidencias:[...], advertencias:[]}`. Ante un ID de reserva contradictorio:
`estado:'inconsistente'`, también con estadisticas null. No ofrecer subtotales
parciales ni ceros como sustitución de datos inválidos. Las incidencias contienen
códigos, nombres de campos permitidos e IDs válidos; no valores rechazados.
Se deduplican tipos de incidencia y no representan necesariamente una por fila.

## Reglas de conteo

- Usar todos los registros recibidos de la agenda del contexto autorizado. No
  aplicar filtros visuales dentro del módulo ni mezclar negocios antes de llamarlo.
- Cada id_reserva cuenta una vez. Duplicado idéntico significa igualdad estricta
  de los ocho campos admitidos, independientemente del orden de propiedades.
  Distintas reservas con el mismo horario cuentan por separado.
- Si cambia cualquier campo para un mismo id_reserva válido, se rechaza el lote
  completo como inconsistente. No sobrescribir con la primera o última versión.
- Incluir los cinco estados: pendiente_abono, confirmada, atendida, no_atendida,
  cancelada. No inferir futuro, cobro recibido ni ingresos a partir de confirmada.
- Cada entidad se agrupa únicamente por su ID. Los grupos y ganadores se ordenan
  por ID ascendente. Todos los empates del máximo se devuelven, sin elegir uno.
- Si distintas reservas tienen etiquetas diferentes para un mismo ID, contar la
  entidad una sola vez, devolver todas las etiquetas ordenadas y el nombre singular
  null, con advertencia nombres_multiples. No decidir cuál es el nombre vigente ni
  asegurar que se trata de un renombrado. El ranking por ID sigue siendo fiable.
- Porcentaje = reservas únicas del grupo / total de reservas únicas del lote × 100.
  Redondear cada resultado a dos decimales, sin redistribuir residuos: tres tercios
  pueden sumar 99.99. Un denominador común incluye todos los estados.
- Lista vacía válida: total cero, grupos vacíos y ganadores vacíos. No hay división
  por cero ni un ganador ficticio. Los grupos se construyen solo si hay reservas.
- La salida es nueva y determinista para permutaciones del mismo lote, incluso
  conflictos y etiquetas múltiples. No muta ni retiene los objetos recibidos.

No calcula servicios sin reservas: hace falta el catálogo completo del negocio y
su cruce por ID. No pretende representar demanda real, ingresos o productividad:
los máximos son cantidades de reservas registradas, incluidas las canceladas.

## Limitación de la API actual y futura integración

GET /api/reservas valida sesión y propiedad del emprendimiento pero actualmente
solo entrega servicio y trabajadora por nombre, no id_servicio ni id_trabajadora.
Por eso esta implementación usa exclusivamente fixtures con IDs estables y NO
debe conectarse a la respuesta actual ni rellenar los IDs por nombre o posición.

La ampliación coordinada con Natalia deberá aportar ambos IDs; conviene incluir
id_emprendimiento en el contrato de agenda para comprobaciones adicionales. El
módulo no acredita pertenencia individual ni reemplaza permisos del servidor.

Pasos futuros: acordar el contrato, conservar la carga autorizada existente,
descartar respuestas antiguas por sesión/negocio/versión, proyectar solo los ocho
campos y calcular una vez por lista aceptada. Reutilizar la misma respuesta, sin
nuevas consultas por cada indicador o cambio de filtros. Mantener errores como
no disponibles, distinguir lista vacía y renderizar etiquetas con textContent.
No cambiar módulos financieros ni notificaciones al integrar esta preparación.

## Pruebas automatizadas

`node --test preparacion/estadisticas-reservas/estadisticas.test.cjs`

Datos completamente ficticios: vacío, una y varias reservas, nombres iguales con
IDs diferentes, igualdad de horarios, duplicados y contradicciones por cada campo,
empates, los cinco estados, porcentajes, campos ausentes, IDs inválidos, calendario
e historia, etiquetas múltiples, orden de entrada, entradas congeladas, ausencia
de referencias compartidas y rechazo de datos personales/financieros adicionales.
También ejecución como script sin DOM, red, almacenamiento, Intl ni reloj.

Estas pruebas no prueban la API real ni una integración visual o autorización.
