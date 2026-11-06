# A4.1 — Resumen operativo independiente

Sin integración visual, endpoints nuevos, dependencias, acceso a PostgreSQL ni proveedores externos. No modifica los indicadores actuales de Natalia.

## Contrato

`frontend/back-office/resumen.js` exporta `calcularResumenOperativo` por CommonJS para pruebas y `globalThis.MerakiResumen` en navegador. No está incorporado a ninguna página.

Entrada:

```js
calcularResumenOperativo({
    reservas: [], // cuerpo de la respuesta autenticada GET /api/reservas
    contexto: {
        idEmprendimientoConsultado: 1, // entero positivo seguro
        idEmprendimientoSeleccionado: 1, // debe coincidir
        consultaAutorizada: true,
        respuestaExitosa: true
    },
    ahoraEpochMs: 1794232800000 // instante explícito, milisegundos Unix
});
```

El contexto es una declaración del código integrador después de recibir una respuesta exitosa y autorizada del servidor. **No constituye una autorización ni prueba la pertenencia individual de las filas**: la API no incluye `id_emprendimiento` por reserva. El servidor mantiene la responsabilidad de sesión y propiedad. No se agregan campos ficticios ni se filtran permisos por JavaScript.

Salida:

```js
{
    idEmprendimiento: 1,
    reservasPorCerrar: { estado: 'disponible', cantidad: 0 },
    proximaAtencion: {
        estado: 'sin_proximas',
        motivo: null,
        reserva: null,
        inicioEpochMs: null
    },
    exclusiones: {
        registrosInvalidos: 0,
        fechasInvalidas: 0,
        horariosInexistentes: 0,
        horariosAmbiguos: 0
    }
}
```

- Contexto ausente, inválido o IDs distintos: ambos indicadores `no_disponible`, cantidad `null`, ID y exclusiones `null`, motivo `contexto_no_valido`.
- Respuesta fallida o cuerpo no array: igual, motivo `respuesta_no_disponible`.
- Array vacío autorizado: cero cierres y `sin_proximas`, con referencia temporal válida y soporte de zona horaria.
- Referencia ausente o inválida: conserva el contador autorizado; próxima `no_disponible`, motivo `referencia_temporal_no_valida`, exclusiones `null`.
- Soporte IANA no disponible: próxima `no_disponible`, motivo `zona_horaria_no_disponible`.
- Próxima inequívoca: estado `disponible`, instante numérico y copia de `fecha_hora_inicio`, `id_reserva` si es entero positivo y nombres `servicio`/`trabajadora` si son texto. No devuelve datos de clientas ni referencias a objetos de entrada.
- Incertidumbre que impide asegurar el orden: `pendiente_revision`, motivo `registros_temporalmente_indeterminados`, reserva e instante `null`.

## Reglas verificadas contra el backend

GET `/api/reservas?id_emprendimiento=…` exige sesión y propiedad. Devuelve `estado`, `puede_cerrar` y `fecha_hora_inicio` como texto civil `YYYY-MM-DDTHH:mm:ss` (sin zona). El módulo admite también minutos sin segundos, conforme al alcance solicitado.

Cierres: cuenta exclusivamente `puede_cerrar === true`; no recalcula el permiso según fecha ni estado. Próxima atención: exclusivamente `estado === 'confirmada'` y comienzo estrictamente posterior a `ahoraEpochMs`. No necesita `fecha_hora_fin` ni interpreta precios como ingresos.

## America/Santiago y ambigüedad

Valida calendario gregoriano, horas y formato estricto; no utiliza `new Date(texto)`. La referencia es un instante numérico, no una hora civil. Usa `Intl.DateTimeFormat` con zona explícita `America/Santiago`, calendario y numeración explícitos; no depende de la zona del computador.

Resuelve la hora civil buscando exhaustivamente todos los instantes a resolución de segundo en una ventana que comprende los offsets IANA de Santiago (24 horas antes y 48 horas después del inicio civil del día). La ventana no es un offset de conversión. Agrupa los horarios por día, ordena sus ventanas UTC y une las superpuestas o adyacentes antes de recorrerlas. Cada segundo de la unión se formatea una sola vez. Incluye offsets históricos con segundos; no presupone UTC−3/UTC−4 ni muestrea transiciones.

La exactitud respecto del algoritmo original se conserva por construcción: se recorre la misma unión de instantes, cada objetivo mantiene su ventana original semiabierta y se guardan todas sus coincidencias. La guarda de límites por objetivo impide aceptar una coincidencia fuera de su ventana al unir otras. No se detiene al encontrar la primera coincidencia; conserva horarios repetidos y detecta cero coincidencias para los inexistentes. El resultado no depende del orden de entrada.

Cero coincidencias: horario inexistente; varias: ambiguo. Nunca elige una ocurrencia arbitraria ni desplaza automáticamente una hora inexistente. Cuenta las exclusiones por registro. Una reserva ambigua bloquea la próxima cuando alguna ocurrencia futura puede preceder o empatar la candidata. Horas inexistentes usan límites conservadores para evitar afirmar un orden incierto. Fechas inválidas o filas no interpretables bloquean la certeza. Si solo hay registros indeterminados, devuelve `pendiente_revision`. Una ambigüedad demostrablemente posterior a una candidata inequívoca no la bloquea.

Limitaciones: las reglas dependen de la base ICU/IANA instalada y deben mantenerse actualizadas ante cambios legales futuros. El algoritmo original recorría 259.200 segundos por día civil distinto. La versión optimizada recorre solo la unión: para D días consecutivos, `(D+2)*86.400` segundos. Para fechas separadas por tres días o más no hay ahorro de recorridos. Sigue siendo exhaustivo y sincrónico; puede bloquear el hilo con historiales grandes. **No integrar directamente en el hilo de interfaz sin otra solución de rendimiento acordada con Natalia.** No se han añadido Web Workers ni integración visual.

## Integración posterior con Natalia

1. Mantener autorización de sesión y propiedad exclusivamente en el backend.
2. Tras respuesta exitosa, verificar que la sesión y el emprendimiento seleccionado siguen siendo los de la solicitud; usar un identificador de solicitud para descartar respuestas antiguas, incluso al cambiar y regresar al mismo negocio.
3. Construir el contexto con el ID consultado y el seleccionado, convirtiendo/validando los IDs fuera del módulo si llegan como texto. Pasar únicamente esa respuesta autorizada.
4. Proporcionar una referencia Unix explícita; el integrador puede obtenerla del reloj de la aplicación. El módulo no consulta la hora actual.
5. Distinguir `no_disponible`, `pendiente_revision`, `sin_proximas` y cero real; no renderizar indisponibilidad como cero. Mostrar advertencia comprensible si corresponde y respetar las exclusiones.
6. Coordinar rendimiento, actualización de zona horaria y presentación sin duplicar los resúmenes existentes. No se ha editado `back.js`, HTML, CSS, navegación ni backend de Natalia.

## Verificación aislada

`node --test backend/test/resumen.test.js`

Solo datos ficticios y módulos nativos. Incluye contexto, respuestas erróneas, calendario, cambios de hora de abril/septiembre de 2026, ambigüedad de orden, día chileno frente a UTC, ejecuciones en distintas zonas del computador, inmutabilidad y trampas de efectos externos. No abre conexiones ni escribe en `meraki_db`.

Resultado local del 6 de noviembre de 2026: 42 pruebas nuevas aprobadas y 3 pruebas existentes de `agenda.test.js` aprobadas; total 45, cero fallos, omisiones o cancelaciones. Sintaxis comprobada en ambos archivos JavaScript y revisión de espacios sin errores. Git advierte únicamente la normalización habitual LF→CRLF. No se ejecutó la batería de integración PostgreSQL.

## Optimización controlada posterior

Se conserva el historial anterior de 45 pruebas. La versión optimizada agrega 8 casos: seis comparaciones de salida completa contra el resolvedor original, instrumentación de llamadas a `Intl` y actualización de permisos/referencia entre llamadas. Total actual: **53 aprobadas, 0 fallidas, 0 omitidas, 0 canceladas** (50 del módulo y 3 de agenda).

Las comparaciones usan un oráculo exhaustivo conservado exclusivamente en pruebas. Cubren horarios normales, verano/invierno de 2026, horas repetidas e inexistentes, fechas históricas de 1900/1910 con offsets de segundos, ventanas solapadas y disjuntas, orden de entrada y fechas inválidas. Se conservan las pruebas anteriores de zonas del computador, entradas congeladas, ausencia de efectos externos y estados de indisponibilidad.

### Evaluación de alternativas nativas

En Node 24.21.0, ICU 78.3 e IANA 2026c, `Temporal` no está disponible. `Intl.DateTimeFormat` permite formatear instantes, pero no enumera las transiciones ni todas las correspondencias de una hora civil. Una búsqueda binaria o un muestreo horario de offsets no demuestra por sí solo que no se omitió otra transición en un intervalo. No se implementa una estrategia más rápida basada en esos supuestos. Se utiliza la alternativa exacta autorizada de unión de ventanas, compatible con las mismas capacidades `Intl` del módulo anterior.

No se verificó ejecución física en navegadores en esta etapa independiente. La compatibilidad exige `Intl` con `America/Santiago`; si falta, se conserva `no_disponible`. La antigüedad de los datos horarios del navegador sigue siendo una limitación para reglas históricas o futuras; no se han descargado tablas ni instalado dependencias.

### Reproducción de mediciones

```powershell
node --test backend/test/resumen.test.js backend/test/agenda.test.js
node backend/test/resumen.test.js --medir-rendimiento
```

El segundo modo no ejecuta pruebas en paralelo. Usa una llamada de calentamiento y una medición por escenario, sin caché temporal. Genera reservas confirmadas ficticias desde el 1 de enero de 2026, fechas consecutivas, horarios a las 11 horas con minutos variados y referencia fija `Date.UTC(2025,11,31)`. Congela las entradas y verifica que no cambien; comprueba próxima atención y cantidad de cierres. Los tiempos anteriores son los registrados en la auditoría previa, con el mismo generador y versiones del entorno; no son nuevas ejecuciones del algoritmo anterior sobre 500 días. Los factores temporales están sujetos a carga y temperatura del equipo. Las llamadas indicadas son llamadas a `.format`, no cantidad de instancias de `DateTimeFormat`.

| Reservas / días distintos | Anterior (ms) | Optimizado (ms) | Factor | `.format` anterior | `.format` optimizado |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10 / 10 | 3.969,64 | 1.733,84 | 2,29× | 2.592.010 | 1.036.810 |
| 100 / 100 | 38.784,28 | 13.408,77 | 2,89× | 25.920.100 | 8.812.900 |
| 500 / 500 | 194.473,15 | 66.364,35 | 2,93× | 129.600.500 | 43.373.300 |
| 500 / 10 | 3.888,93 | 1.547,48 | 2,51× | 2.592.500 | 1.037.300 |

Los conteos de la tabla se calculan exactamente a partir de las ventanas y timestamps únicos de estos conjuntos. Una prueba instrumentada valida el ahorro con tres días consecutivos: 777.603 llamadas antes y 432.003 después, sin diferencias de salida. La unión depende de la distribución de fechas: no debe extrapolarse un factor constante para conjuntos dispersos.

Conclusión: reducción sustancial del trabajo repetido, pero **66,36 segundos en primera carga no son adecuados para el hilo de interfaz**. No se recomienda integrar A4.1 directamente sin Web Worker u otra estrategia exacta que resuelva esa latencia. Un Worker mejoraría la respuesta visual, pero tampoco eliminaría la espera del cálculo. Debe autorizarse y diseñarse por separado; no forma parte de este cambio.

### Caché evaluada, no implementada

Una caché LRU en memoria de hasta 512 timestamps civiles podría almacenar únicamente el timestamp y sus posibles instantes (también conjuntos vacíos o ambiguos), sin IDs de negocio, nombres ni datos de clientas. No debería almacenar resúmenes completos: permisos, contexto y referencia deben recalcularse siempre. Tendría que tener invalidación explícita/recreación al cambiar la configuración temporal y descartarse al recargar; sin persistencia ni intercambio entre entornos. Las salidas deberían copiar los arrays cacheados para impedir su modificación accidental.

No se agregó: aceleraría repeticiones, pero no resuelve la primera carga ni conjuntos fuera del límite y podría ocultar el costo real en las mediciones. Requiere pruebas de expulsión, aislamiento, resultados vacíos/ambiguos y modificación de permisos antes de adoptarse. El siguiente paso debe acordarse con Natalia; esta optimización no autoriza integrar la interfaz ni modificar sus archivos.
