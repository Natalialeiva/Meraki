# Instalación académica de Meraki

## Qué se entrega

El mismo backend y las tres interfaces originales. Una única base principal `meraki_db`. `database/academica/meraki_db.sql` contiene estructura hasta 012 y datos inventados de Luna Estudio: dos servicios, dos profesionales y doce horarios. No contiene reservas, abonos, correos, sesiones, tarjetas, inscripciones ni secretos de clientas. La cuenta viene bloqueada deliberadamente, sin contraseña reutilizable.

El laboratorio Docker `meraki_webpay_sandbox` no es necesario para esta instalación, no debe restaurarse sobre la principal ni aporta transacciones a esta entrega.

## Computador nuevo

1. Instalar Node.js 24 y PostgreSQL 18; disponer de `psql` en PATH.
2. Obtener el código completo y ejecutar `npm.cmd ci` desde `backend`.
3. Crear privadamente `backend/.env` a partir de `.env.example`. Configurar PostgreSQL local, `DB_NAME=meraki_db`, secreto de sesión fuerte y URL local. Mantener ambos controles de proveedores/renovaciones en 0. No copiar el `.env` de Natalia.
4. Desde la raíz, con usuario PostgreSQL local autorizado:

```powershell
createdb -U TU_USUARIO_LOCAL meraki_db
psql -X -U TU_USUARIO_LOCAL -d meraki_db -v ON_ERROR_STOP=1 --single-transaction -f database/academica/meraki_db.sql
```

Si la base ya existe, detenerse. No eliminarla, vaciarla ni importar encima. Este SQL no crea bases ni usuarios. No ejecutar además schema/migraciones: ya están incluidas.

5. Desde `backend`, activar únicamente la cuenta bloqueada de esta instalación:

```powershell
node scripts/preparar-negocio-academico.cjs --activar-cuenta-importada
```

La contraseña aleatoria se guarda solo en `%USERPROFILE%\AppData\Local\Meraki\acceso-academico\luna-estudio.json`. Abrirlo privadamente para iniciar sesión; no subirlo, capturarlo ni compartirlo por Git. El comando no reinicia contraseñas de cuentas existentes ni sobrescribe accesos. Renueva las fechas del mes gratuito solo para la cuenta recién activada, sin tarjeta ni cobro.

6. Iniciar desde `backend`:

```powershell
$env:MERAKI_SUSCRIPCIONES_AUTOMATICAS='0'
$env:MERAKI_PROVEEDORES_EXTERNOS='0'
npm.cmd start
```

Abrir `http://127.0.0.1:3000/front-office/` y `/back-office/`. Buscar Luna Estudio. Este arranque permite revisión local; el abono devuelve bloqueo explícito y no se genera un correo real. El sistema no inventa una aprobación.

## Presentación con proveedores oficiales

Requiere autorización independiente para una reserva nueva de Integration y el destinatario Gmail. Revisar configuración OAuth, URLs de retorno y consulta, puerto disponible y conexión. Reiniciar habilitando proveedores solo al ejecutar el ensayo autorizado; mantener renovaciones en 0. Usar datos oficiales de prueba, nunca tarjetas reales. Si hay resultado incierto, no repetir el pago.

La consulta en localhost funciona en el mismo computador. Para abrir el correo en otro dispositivo, se necesita una dirección pública HTTPS autorizada y coherente con el retorno; no se configuró automáticamente un túnel.

## Computador de Adriana con datos existentes

Proteger cambios locales antes de Fetch/Pull. Este trabajo todavía no está publicado. Una vez compartido, comparar estructura y respaldar SU `meraki_db`; no restaurar el SQL académico encima. Revisar migraciones faltantes y pedir autorización antes de aplicarlas. No ejecutar el script de migración de Natalia sin revisar su plan y base objetivo.

Puede crear el mismo negocio sintético con `preparar-negocio-academico.cjs --crear-nuevo-autorizado` solo si no existe y después de autorizar esas inserciones. Así conservará sus registros y usará los mismos contratos, catálogo y estructura, sin necesitar idénticos IDs ni transacciones históricas.

## Evidencia y contingencia

`database/academica/verificacion.json` identifica el SHA-256 del SQL y la restauración comprobada en dos bases temporales propias, eliminadas después. No es una exportación histórica anonimizada: se construyó desde cero exclusivamente con datos inventados.

`npm.cmd run test:aislado` ejecuta regresión con proveedores simulados. El ejecutor `demostracion-local-segura.cjs` sigue disponible como contingencia temporal claramente identificada. No confundir esas pruebas con pagos oficiales ni con la base principal.
