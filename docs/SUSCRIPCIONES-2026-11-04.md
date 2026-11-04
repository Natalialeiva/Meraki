# Suscripción mensual automática — 4 de noviembre de 2026

## Reglas confirmadas por Natalia

- $9.990 CLP mensuales.
- Un mes calendario gratuito, no 30 días fijos.
- Renovación automática con tarjeta inscrita en Transbank Oneclick.

El mes gratuito comienza al confirmar la primera inscripción exitosa. Solo se concede una vez por cuenta. Una reinscripción conserva la fecha de prueba anterior. Los períodos usan fechas locales de Chile y final exclusivo a las 00:00 del día indicado. El día mensual se conserva al pasar por febrero: 31 de enero → último día de febrero → 31 de marzo.

## Implementación

- Inscripción de tarjeta con consentimiento explícito del plan `meraki-9990-mes-v1`, monto y fecha registrados en auditoría.
- Tarjeta ingresada directamente en Transbank. Meraki no recibe PAN completo ni CVV. Guarda últimos cuatro dígitos, tipo y el identificador reutilizable cifrado con AES-256-GCM.
- Retornos GET y POST; confirmación repetida no repite `finish` ni reinicia la prueba.
- Procesador de vencimientos al iniciar el servidor y cada 60 segundos mientras el backend está activo. Recorre lotes de 50 cuentas con avance de cursor para que los pagos inciertos iniciales no bloqueen otras renovaciones. No hay endpoint de cliente para ejecutar un cargo arbitrario.
- Registro durable del intento antes de llamar a Oneclick; orden padre/tienda únicas; verificación de monto, órdenes, comercio, estado y código de respuesta.
- Candado por cuenta entre procesos, índices por período/intento y aprobación única por período.
- Ante timeout, caída después de autorizar o respuesta inconsistente: pendiente/en revisión. Los siguientes ciclos consultan la orden; nunca vuelven a autorizar ese intento a ciegas.
- Rechazo definitivo: no extiende vigencia y no se reintenta solo. Otro intento requiere nueva aceptación y confirmación de la emprendedora.
- Cancelación: deshabilita renovación, conserva el período vigente e intenta eliminar la inscripción en Transbank. Si la revocación externa falla, queda un evento pendiente y no se generan nuevos cargos. Una operación ya iniciada se resuelve antes de completar la cancelación.
- Si el servidor estuvo apagado, no acumula mensualidades atrasadas: procesa un solo cargo y concede un mes desde el día de ejecución, que pasa a ser el nuevo día de renovación.

La integración técnica sigue el flujo oficial de [Oneclick](https://transbankdevelopers.com/documentacion/oneclick) y su [referencia Node](https://proyecto-ejemplo-node.transbankdevelopers.cl/api-reference/oneclick-mall). Se verificaron también las firmas del SDK instalado 6.1.1. El adaptador solo permite el ambiente de integración y usa los códigos públicos oficiales de Oneclick Mall y su tienda de prueba.

## Archivos

- `database/008_suscripcion_oneclick.sql`: columnas, inscripciones, auditoría y restricciones nuevas.
- `backend/scripts/aplicar-migracion-suscripciones.js`: migración transaccional con huellas de los datos anteriores.
- `backend/oneclick.js`: adaptador sandbox y límite de espera de 20 segundos.
- `backend/suscripcion-plan.js`: plan, fechas, cifrado y validación de resultados.
- `backend/suscripciones.js`: rutas, servicio de suscripciones y procesador.
- `backend/index.js`: montaje e inicio del procesador solo al ejecutar el servidor, no al importarlo en pruebas.
- `frontend/back-office/suscripcion.js`, `back.js`, `index.html`: panel de estado, consentimiento, inscripción, cancelación y reintento autorizado.
- `backend/test/suscripciones.test.js`, `suscripcion-ui.test.js`: pruebas nuevas. La batería anterior carga también la migración 008 en su esquema temporal.

No se modificó Front Office ni `.env`. Los abonos de reservas siguen separados de los pagos de suscripciones.

## Migración y operación

Aplicada en el equipo de Natalia:

```powershell
# Desde backend. En otro equipo, aplicar antes de iniciar la nueva versión.
node scripts/aplicar-migracion-suscripciones.js
```

Resultado observado: `migracion: 008`, `aplicada: true`, `datosAnterioresSinCambios: true`. Compara reservas, abonos y las columnas anteriores de suscripciones/pagos. Una inconsistencia o cuentas con suscripciones duplicadas aborta la migración; no borra ni fuerza estados.

El cifrado deriva su clave de `SESSION_SECRET`. Esa clave debe conservarse y respaldarse junto con la base. Cambiarla sin migrar los identificadores cifrados impide usarlos para cobrar o revocar; no se modificó su valor en esta sesión. Las API nunca devuelven el identificador, el texto cifrado ni el usuario interno de Oneclick.

El backend debe permanecer activo para cobrar a su vencimiento; este bloque no instala una tarea de Windows ni un servicio de hosting. `MERAKI_SUSCRIPCIONES_AUTOMATICAS=0` permite deshabilitar el procesador. No se alteraron variables del entorno. Las inscripciones pendientes de más de 20 minutos pueden abandonarse y reiniciarse; las confirmaciones inciertas requieren revisión o cancelación explícita del proceso, sin cobros habilitados.

## API

- `GET /api/suscripcion`: sesión requerida. Devuelve plan, estado propio, vigencia, tarjeta enmascarada y últimos doce pagos. Sin inscripción devuelve suscripción nula. No crea registros ni cobra.
- `POST /api/suscripcion/inscribir`: sesión, `X-Meraki-Action: 1`, JSON `{acepta_renovacion:true,version_plan:"meraki-9990-mes-v1"}`. Devuelve token temporal y URL sandbox. El navegador envía `TBK_TOKEN` por POST a Transbank. La inscripción no es un pago mensual.
- `GET|POST /api/suscripcion/retorno`: recibe `TBK_TOKEN`, consulta la inscripción y redirige al panel sin exponer el identificador reutilizable. Conserva el alias localhost/127.0.0.1 del mismo puerto para no cambiar de sesión; un Host externo no modifica el retorno configurado.
- `POST /api/suscripcion/cancelar`: sesión y cabecera de acción. Cancela la renovación propia y los procesos de inscripción en curso. No cancela reservas ni anula pagos anteriores.
- `POST /api/suscripcion/reintentar`: exige el mismo consentimiento del plan y un rechazo definitivo. No admite pendientes inciertos; autoriza un intento para el procesador.
- Sin sesión 401; falta de cabecera 403; consentimiento/datos inválidos 400; inscripción inexistente 404; estado incompatible 409; error externo 502. Errores internos se presentan sin secretos como indisponibilidad 503.

## Pruebas y evidencia

```powershell
# Desde backend
$env:MERAKI_DB_TEST='1'
npm.cmd test
```

Resultado final: **123 casos aprobados y 2 grupos de integración**. Node informa **125 pass, 0 fail, 0 skipped**. Registro: `pruebas-suscripciones-2026-11-04.txt`.

Las pruebas usan esquemas temporales con resolución exclusiva de sus propias tablas durante las operaciones. Oneclick, Webpay y SMTP están simulados. Se probó:

- Mes calendario, febrero/bisiesto, conservación del día mensual y retorno local seguro.
- Cifrado, clave incorrecta y bloqueo de producción.
- Sesión, cabecera, consentimiento exacto, propiedad y datos privados no expuestos.
- Inscripción concurrente única; retorno idempotente y ausencia de cobro durante la prueba.
- Cobro único ante cinco procesadores simultáneos.
- Rechazo sin vigencia ni reintento automático; otro intento consentido.
- Timeout después de autorizar y reinicio del servicio; consulta sin cargo duplicado.
- Respuesta con monto, orden, comercio o código inconsistente.
- Fallo de persistencia después del cargo y recuperación sin adelantar vigencia antes de confirmar.
- Cancelación, revocación, reinscripción sin nueva prueba, atraso sin mensualidades acumuladas y cancelación concurrente.
- Inscripción rechazada/incierta sin activar renovación.
- Ocho casos de interfaz: consentimiento, redirección, estado, duplicados, cancelación y reintento.
- Recorrido por lotes: una cuenta que debe renovarse se procesa aunque las cincuenta cuentas anteriores tengan pagos inciertos.

Se corrigió durante la verificación una ambigüedad de tipos del enum PostgreSQL al registrar resultados. La ejecución final completa pasó. El esquema temporal dejado por una prueba interrumpida se identificó y eliminó; no se eliminó ningún esquema principal.

La revisión visual abrió únicamente el panel en la cuenta de Camila, sin aceptar el consentimiento ni iniciar inscripción. Se observó «Aún no has inscrito una tarjeta» y «Sin cobros registrados». Captura: `suscripcion-back-office-2026-11-04.png`.

## Límites pendientes

- Falta la prueba completa contra Oneclick sandbox con inscripción realizada por la usuaria y una tarjeta de prueba; las pruebas de cobro actuales son simuladas. No se usaron tarjetas reales ni se generaron cargos en Transbank durante esta implementación.
- Producción permanece deshabilitada. El flujo actual es para integración.
- Natalia aprobó posteriormente la política de restricciones: el código, pruebas y activación local verificada se documentan en `ACCESO-SUSCRIPCION-2026-11-04.md`. Nuevas reservas y configuración requieren vigencia; la agenda y citas existentes se conservan.
- No hay envío nuevo de correo de suscripción ni anulación/reembolso desde el panel. Los resultados se consultan en el historial.
- Fallos de confirmación de inscripción o revocación quedan auditados; requieren revisión. No existe todavía un panel administrativo específico para resolverlos.

Cambios pendientes de revisión y commit junto con los bloques de trabajadoras/horarios. Sin commit, push, pull ni reset en este bloque.
