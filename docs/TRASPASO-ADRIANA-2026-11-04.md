# Traspaso Natalia → Adriana — 4 de noviembre de 2026

## Qué se entrega

Back Office con gestión de perfil, servicios, trabajadoras y asignaciones, horarios y bloqueos. Suscripción de $9.990 CLP mensuales con un mes calendario gratuito y renovación Oneclick en integración. Sin vigencia se bloquean nuevas reservas y cambios de configuración, conservando agenda, citas existentes y regularización.

La migración 007 conserva el nombre de cada reserva aunque se reutilice el correo de una clienta. La migración 008 incorpora inscripción, auditoría y procesamiento de suscripciones. No se modificaron credenciales ni se inscribieron tarjetas reales.

Última batería registrada: **128 casos y 2 grupos de integración**, Node **130 pass, 0 fail, 0 skipped**. Evidencia: `pruebas-acceso-suscripcion-2026-11-04.txt`. Las pruebas usan esquemas temporales y proveedores simulados.

## Cierre en Natalia

1. Revisar Changes de GitHub Desktop: módulos, pruebas, migración 008 y evidencias nuevas.
2. No hay eliminaciones pendientes entre estos cambios. El commit anterior `d4475f3` («borrar evidencias») ya eliminó cuatro archivos antiguos: EVIDENCIAS.md, OPERACION.md y dos capturas. No se revierten ni se repiten esas eliminaciones en este bloque; los documentos originales siguen recuperables desde su historial Git.
3. `.env` está ignorado y no versionado. La búsqueda de patrones de tokens/credenciales en los archivos preparados no encontró coincidencias. No publicar archivos privados, copias de `.env`, tokens de Gmail, identificadores reutilizables de tarjetas ni contraseñas.
4. Commit y Push origin en GitHub Desktop. Después verificar que el hash de `main` remoto sea el mismo del commit local. Un commit local por sí solo no acredita publicación.

## Inicio en Adriana

Git sincroniza código; **no sincroniza PostgreSQL, cuentas, reservas, tarjetas inscritas ni el archivo `.env`**. Los números de reserva/abono de Natalia no necesariamente existen en Adriana.

1. Abrir el repositorio correcto en GitHub Desktop y revisar Changes. Si hay trabajo propio, protegerlo con un commit o una rama antes de sincronizar. No usar Discard, reset ni sobrescribir archivos.
2. Ejecutar Fetch origin. Revisar la rama y los commits recibidos; Pull origin solo después de proteger cambios locales. Si hay divergencia o conflictos, detenerse para revisarlos.
3. Comprobar su `.env` local sin imprimir valores ni copiar secretos en el chat. No reemplazarlo con el de Natalia.
4. Detener su backend anterior antes de arrancar la nueva versión. Para el diagnóstico, mantener deshabilitado el procesador automático en esa consola:

```powershell
# Ejecutar desde la carpeta backend del repositorio de Adriana.
$env:MERAKI_SUSCRIPCIONES_AUTOMATICAS='0'
npm.cmd ci
```

5. Revisar su base y las migraciones aplicadas. Si ya existe la estructura base y token de consulta, aplicar en orden los procedimientos aditivos:

```powershell
node scripts/aplicar-migraciones-notificaciones.js
node scripts/aplicar-migracion-suscripciones.js
```

El primero aplica 003–007; el segundo aplica 008. Verifican que los datos anteriores no cambien. Si falta la estructura base/token, hay suscripciones duplicadas o una migración falla, diagnosticar primero: **no ejecutar schema.sql o seed.sql sobre una base existente** ni forzar estados de pagos.

6. Verificar sintaxis y pruebas con aislamiento:

```powershell
$env:MERAKI_DB_TEST='1'
npm.cmd test
```

La extensión PostgreSQL `btree_gist` debe estar instalada. Las pruebas lo comprueban y no la instalan automáticamente en la base principal. Si no se habilita `MERAKI_DB_TEST=1`, se omiten los grupos de PostgreSQL y el resultado no equivale a la batería completa.

7. Arrancar con `npm.cmd start` y revisar Front Office, sesión del Back Office, agenda y estado de suscripción. Una cuenta sin plan no podrá crear reservas ni configurar servicios; esto es la política vigente, no un fallo de conexión.

El procesador automático solo debe habilitarse después del diagnóstico y la revisión de la configuración de integración. Funciona mientras el backend esté activo. El identificador de Oneclick se cifra con una clave derivada de SESSION_SECRET: no cambiar esa clave sin un procedimiento para los datos cifrados, ni trasladar inscripciones entre bases sin coordinación.

## Prompt para Codex de Adriana

> Continúa MERAKI desde el repositorio real de este equipo. Antes de editar, revisa AGENTS.md si existe, ruta, rama, estado Git y último commit recibido. No hagas reset, discard, pull con cambios locales ni operaciones destructivas. Lee docs/TRASPASO-ADRIANA-2026-11-04.md, docs/SUSCRIPCIONES-2026-11-04.md y docs/ACCESO-SUSCRIPCION-2026-11-04.md. Esta base PostgreSQL es independiente de la de Natalia: no asumas IDs ni datos iguales. Comprueba variables sin mostrar secretos, migraciones 003–008 y aislamiento de las pruebas. Mantén MERAKI_SUSCRIPCIONES_AUTOMATICAS=0 durante el diagnóstico; no envíes correos ni realices cargos externos. Ejecuta comprobaciones seguras y reporta aprobados, fallidos y omitidos. Adriana trabajará principalmente en Front Office, responsive, geolocalización y dashboard; conserva los contratos del backend y coordina sus cambios. Antes de seguir, informa qué está sincronizado, qué migraciones faltan y si hay conflictos. No hagas commit ni push sin una instrucción explícita.

## Pendientes conocidos

- Prueba completa de Oneclick sandbox con tarjeta de prueba ingresada por la usuaria; hasta ahora la batería de cobros es simulada.
- Abono 8 / reserva 19 de Natalia: pendiente; no aprobar ni rechazar manualmente.
- Trazabilidad de casos técnicos con el Excel original de pruebas.
- Front Office: mejorar con Adriana el mensaje genérico de servicio no disponible sin exponer facturación del negocio a las clientas.
- Producción y hosting continuo no habilitados. No hay una tarea de Windows que sustituya al backend apagado.
- No se ha ejecutado Fetch/Pull, migraciones ni diagnóstico en el computador de Adriana desde esta sesión.
