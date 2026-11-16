# Regla de abonos CLP del MVP

Los servicios reservables de este MVP requieren abono: monto numérico entero positivo, de 1 a 99.999.999 CLP y no superior al precio del servicio. El máximo respeta el almacenamiento NUMERIC(10,2). El precio conserva su contrato anterior de hasta dos decimales; no se impuso un precio entero sin necesidad. No se implementó un flujo de reservas sin abono.

## Corrección

Antes, POST/PATCH de servicios y el formulario del Back Office admitían cero y hasta dos decimales. PostgreSQL NUMERIC(10,2) también los almacena. El inicio de Webpay ya exigía un entero positivo; el desacuerdo podía producir una reserva pendiente imposible de pagar.

- `backend/montos-abono.js` centraliza la regla de negocio para servicios, reservas e inicio de Webpay. Las API de servicios exigen números JSON, no cadenas, booleanos o null. Los NUMERIC de PostgreSQL se convierten explícitamente al leer.
- `backend/index.js` valida creación y combinación final de PATCH, incluso si solo cambia el precio o un texto. El UPDATE también protege la fila vigente contra ediciones concurrentes. La reserva autenticada comprueba la tarifa antes del INSERT.
- `backend/reserva-invitada-servicio.js` rechaza una tarifa histórica incompatible antes de crear la reserva/contacto y revierte la transacción. La repetición idempotente de una reserva ya creada conserva su respuesta histórica.
- `backend/inicio-webpay.js` usa la misma regla con el precio histórico de la reserva; un monto inválido no crea abono ni llama al SDK. No cambia pagos o estados anteriores.
- `frontend/back-office/servicios.js` y `index.html`: entero positivo, min=1, max=99999999, step=1 y comprobación frente al precio. La validación cliente no sustituye a la del servidor.

No se añadieron rutas. No se modificó ningún archivo del Front Office ni módulos financieros Oneclick/retorno/recuperación.

## PostgreSQL e históricos

`database/013_servicio_abono_clp.sql` está preparada, NO aplicada en la base principal. Añade CHECK NOT VALID solo en servicio: protege escrituras futuras conservando filas previas sin actualizarlas ni validar retroactivamente su contenido. No restringe tablas históricas de reserva/abono ni altera estados. Su aplicación futura requiere revisión, respaldo y autorización. Al actualizar una fila de servicio antigua incompatible, se debe proporcionar una tarifa válida; un cambio de nombre aislado no permite perpetuar esa tarifa inválida. El API devuelve 400 en esa situación.

Conteo de solo lectura en `meraki_db`: 6 servicios, 28 reservas y 15 abonos; cero incompatibilidades encontradas en montos cero/negativos/fraccionarios y, para servicio/reserva, superiores al precio. No se imprimieron datos personales ni se modificaron registros. Si aparecieran históricos incompatibles en otro computador, conservar reservas/abonos y revisar la tarifa de servicio con autorización; no redondear ni corregir pagos automáticamente. El nuevo inicio de pagos sobre una reserva incompatible queda bloqueado.

Los respaldos académicos existentes hasta 012 no se regeneraron ni migraron. El backend actualizado funciona sobre esa estructura y aplica su regla en aplicación; la protección SQL directa adicional queda pendiente de 013. No afirmar que el CHECK ya existe en la principal.

## Validación

Regresión `npm.cmd run test:aislado`: 536 entradas aprobadas, cero fallidas y cero omitidas. Bases efímeras propias eliminadas. Registro: `PRUEBAS-ABONOS-CLP-2026-11-16.txt`. Incluye montos válidos, igualdad con precio, cero, negativos, decimales, superiores al precio y datos inválidos; POST/PATCH y formulario; reserva invitada; inicio Webpay inválido sin efectos; pagos válidos simulados y conservación de históricos. La migración se probó en transacción sobre la base aislada, conservando una fila antigua incompatible y rechazando nuevas escrituras inválidas.

Durante el ajuste se corrigió la lista de dependencias del test de lectura en memoria y la conexión transaccional del nuevo test SQL; la ejecución final pasó completa. Sintaxis Node y git diff --check comprobados. No hubo contactos con Transbank/Gmail/Oneclick, reservas reales, migraciones principales, commit ni push.

## Compatibilidad y coordinación

Cambio intencional: clientes que intenten crear/editar servicios con abono 0 o fraccionario recibirán 400. Las consultas, estados y registros históricos siguen disponibles. Los servicios existentes inválidos no pueden generar nuevas reservas/pagos; deben revisarse, no transformarse silenciosamente en reservas gratis.

No hay ajuste obligatorio en el Front Office de Adriana para los datos válidos: el contrato de rutas y campos no cambia y el servidor obtiene el monto desde PostgreSQL. Si se desea mejorar la presentación de tarifas históricas incompatibles, Adriana puede impedir seleccionar esos servicios y mostrar el motivo; es una mejora de interfaz independiente y no se implementó aquí. El servidor ya impide crear una reserva no pagable, aunque una interfaz antigua permita seleccionarla.

La instancia que estuviera ejecutándose antes del cambio requiere reinicio controlado para cargar el código nuevo. No se reinició sobre la principal ni se realizaron escrituras de ensayo. Mantener proveedores y renovaciones bloqueados durante revisión.

Próximo bloque recomendado: revisar y autorizar 013 por separado, tras respaldo y diagnóstico de cada computador. Este trabajo termina aquí; no se aplica automáticamente ni se avanza a otra funcionalidad.
