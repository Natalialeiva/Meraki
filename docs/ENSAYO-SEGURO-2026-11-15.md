# Ensayo del MVP sobre PostgreSQL efímero

El ejecutor usa el backend original en loopback:3002 y una base nueva `meraki_muestra_…`. No usa datos de `meraki_db`, `meraki_demo` ni del sandbox financiero pagado. Los adaptadores externos se sustituyen en el proceso; no se editan Webpay, Oneclick ni las herramientas V3.

## Comprobación real en navegador

| Paso | Resultado observado |
| --- | --- |
| Front Office | Abrió con catálogo e imágenes locales. |
| Búsqueda/filtros | Nombre y categoría Manicure redujeron el catálogo a un negocio. |
| Servicios/profesionales/disponibilidad | Manicure, Profesional Uno, fecha del fixture y hora 10:00 disponibles. |
| Reserva invitada | Creó la cita ficticia 5; contacto de ejemplo, sin cuenta de clienta. |
| Pago | Abrió una pantalla local «Pago simulado», sin tarjetas ni red Transbank. |
| Retorno | Mostró «Abono aprobado» y enlace de vuelta a la reserva. |
| Consulta | Reserva confirmada, asistencia inicialmente sin confirmar. |
| Asistencia | Tras confirmación explícita mostró «Confirmada por la clienta». |
| Solicitud | Quedó pendiente y la cita siguió confirmada. |
| Back Office | Login ficticio; agenda mostró asistencia y solicitud de la cita. |
| Revisión | Se registró respuesta y se cerró la solicitud sin modificar reserva ni abono. |
| Notificación | Registro enviado, un intento, identificador DEMO-SIN-ENVIO: no SMTP real. |
| Dashboard | Mostró cinco reservas, tres confirmadas, una pendiente y una cancelada; filtro Confirmada mostró tres. Los otros estados provenían de fixtures, no de pagos. |
| Consulta posterior | Mostró solicitud cerrada y respuesta; conservó reserva confirmada y asistencia. |

Natalia aceptó manualmente los tres diálogos del navegador: asistencia, solicitud y cierre. La automatización no pudo aceptar esos cuadros; no se presenta ese tramo como totalmente automático. No hubo intervención manual para pagar a un proveedor: el pago fue solo una simulación local autorizada.

Los datos de demostración usaron la fecha 16/11/2026 calculada por el lanzador. En ejecuciones futuras la consola indicará otra fecha. No usar los enlaces efímeros del ensayo como enlaces de reservas históricas.

Resumen local antes del cierre: un abono simulado aprobado y una notificación simulada. El proceso se detuvo mediante Ctrl+C y confirmó la eliminación de su base por nombre/OID y su ausencia. No se dejaron cuentas ni reservas de ese ensayo en bases conservadas.

## Error detectado y corrección

La primera versión del simulador devolvía HTTP local y el backend rechazó correctamente la respuesta por exigir HTTPS. Se descartó esa base efímera después de su cierre comprobado. No se desactivó la validación: el proveedor simulado ahora responde con una URL HTTPS de formato compatible y solo el lanzador traduce la respuesta exitosa a la página local. La consulta exige cabecera de demo, loopback y mismo origen para admitir ese destino.

También se corrigió la referencia a `007_clienta_correo_unico.sql`, inexistente, y se incorporaron 011/012 al arranque nuevo. No se aplicaron a bases conservadas.

## Evidencias y límites

- `ensayo-consulta-2026-11-15.png`: consulta final con asistencia y solicitud cerrada.
- `ensayo-dashboard-2026-11-15.png`: Dashboard con datos ficticios.
- `PRUEBA-DEMO-2026-11-15.txt`: arranque y limpieza automáticos. Las credenciales ficticias de consola se omiten del registro publicable.
- Las pruebas de regresión de esta mejora se registran separadamente; no confundirlas con entrega Gmail o Webpay Integration.

La fecha del archivo corresponde a la sesión iniciada el 15/11; parte del ensayo puede terminar al día siguiente. No se validaron de nuevo Gmail real, tarjetas Integration, Oneclick, permisos de geolocalización ni Google Maps externo. El modo de lectura del laboratorio histórico continúa siendo un trabajo separado.

## Regresión cerrada el 16/11/2026

- `npm.cmd run test`: 358 aprobadas, 0 fallidas y 4 grupos SQL omitidos deliberadamente. Registro: `PRUEBAS-REGRESION-DEMO-2026-11-16.txt`.
- `npm.cmd run test:aislado`: 477 entradas aprobadas, 0 fallidas y 0 omitidas; incluye grupos de integración. Creó y eliminó su propia base efímera. Registro: `PRUEBAS-INTEGRALES-DEMO-2026-11-16.txt`.
- Ejecutor con `--verificar`: 31 comprobaciones aprobadas y eliminación de la base confirmada.
- El original de la evidencia Gmail conserva su SHA-256. No se hicieron commit ni push.
