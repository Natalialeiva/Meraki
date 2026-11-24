# Administración de Meraki

Ruta: `http://localhost:3000/admin/`, con acceso propio en `/admin/login`. No existe registro público ni se conceden permisos por coincidir con un correo escrito en el código.

## Alcance

Amplía el Admin de lectura existente y reutiliza los estilos actuales: `gestion.css`, `tema-rosa.css`, `diseno-tokens.css`, DM Sans y Fraunces locales. No cambia Front Office, Back Office, reservas, Dashboard ni módulos financieros.

Permite consultar todas las emprendedoras (incluso sin emprendimiento), suscripciones, períodos, pagos e historial administrativo. Los importes son aprobaciones registradas de **Integration**, no ingresos bancarios ni dinero real; se deduplican períodos conocidos con el criterio ya existente.

La cookie administrativa es independiente de la de emprendedoras, tiene firma separada, HttpOnly, SameSite Strict, caducidad de 30 minutos renovable y máximo absoluto de ocho horas. Cada petición verifica que la cuenta siga activa. El login limita intentos. La cancelación exige sesión, origen permitido, cabeceras propias y token CSRF.

## Cancelación local

**Cancelar suscripción** solicita motivo (10–500 caracteres) y confirmación. Usa el mismo candado PostgreSQL `(509, id_emprendedora)` que el procesador existente. Rechaza la operación si hay un cobro en curso o pendiente de resolución, sin consultar proveedores.

Una sola transacción desactiva renovación y reintento, marca la suscripción como cancelada, conserva `acceso_hasta`, cierra inscripciones locales todavía en curso y registra administradora, fecha, motivo, resultado y estado anterior/posterior. Un fallo de auditoría revierte todo. La clave de solicitud conserva la misma operación ante respuesta perdida y evita duplicar cambios o auditoría.

No cobra, reembolsa, modifica pagos aprobados, descifra tarjetas ni elimina inscripciones en Transbank. La inscripción externa y la tarjeta cifrada pueden permanecer registradas. Revocarlas externamente requiere un procedimiento distinto y autorizado. No se puede declarar cancelado un cobro ya iniciado. Una inscripción posterior expresamente consentida seguirá las reglas originales del proyecto.

## Actualización en los dos computadores

**Las migraciones no se aplican automáticamente a bases conservadas.** Git no sincroniza PostgreSQL. No se modifica el ZIP del profesor.

1. Conservar los cambios locales y coordinar `backend/administracion.js` y `frontend/admin/` antes de sincronizar; no sobrescribir trabajo ajeno.
2. Detener el servidor controladamente y verificar ausencia de operaciones financieras activas. Mantener proveedores externos y renovaciones en `0`.
3. Crear y verificar un respaldo privado fuera de Git. Desde `backend` existe este procedimiento, que crea un respaldo completo, restaura en una base temporal y compara estructura, conteos y huellas:

   ```powershell
   node scripts/verificar-respaldo-principal.cjs --verificar
   ```

   No añadir `--aplicar-009-012`. Si falla o no coincide la restauración, detenerse. Conservar respaldo y SHA-256.
4. Revisar el destino. Aplicar `014_administradoras.sql` únicamente si no existe `administradora`. Después aplicar la nueva `015_auditoria_administrativa.sql`. No repetir `schema.sql`, semillas ni migraciones existentes.
5. Tras autorización de la responsable de cada base, ejecutar desde `Meraki` (PostgreSQL 18 en su ruta habitual):

   ```powershell
   $pgBin = Join-Path $env:ProgramFiles 'PostgreSQL\18\bin'
   # Solo si 014 aún no está aplicada:
   & (Join-Path $pgBin 'psql.exe') -X -h 127.0.0.1 -p 5432 -U postgres -d meraki_db -v ON_ERROR_STOP=1 -f database/014_administradoras.sql
   # Ejecutar 015 únicamente si el paso anterior terminó correctamente:
   & (Join-Path $pgBin 'psql.exe') -X -h 127.0.0.1 -p 5432 -U postgres -d meraki_db -v ON_ERROR_STOP=1 -f database/015_auditoria_administrativa.sql
   ```

   Introducir la contraseña en la terminal, sin escribirla en el comando. Comprobar `$LASTEXITCODE` después de cada ejecución; ante un valor distinto de cero, detenerse antes del siguiente comando. Ajustar usuario, puerto y base únicamente al destino revisado. Ambos SQL son transaccionales. No restaurar automáticamente sobre la principal si aparece un error.
6. Verificar tablas, índices y claves foráneas y comparar conteos/huellas históricos con el respaldo. Reiniciar el backend original para cargar el módulo ampliado. No requiere dependencias nuevas. Mantener `MERAKI_SUSCRIPCIONES_AUTOMATICAS=0` y `MERAKI_PROVEEDORES_EXTERNOS=0` durante la comprobación local.

## Cuentas individuales de Adriana y Natalia

Desde una terminal local interactiva en `backend`, con el `.env` privado del equipo correcto:

```powershell
node scripts/administradoras.cjs crear --correo adriana@example.test --autorizar
node scripts/administradoras.cjs crear --correo natalia@example.test --autorizar
```

Sustituir los correos ficticios por los elegidos privadamente por cada integrante. El procedimiento muestra la base, exige escribir `AUTORIZAR` y pide dos veces una contraseña que no se muestra. Usar claves distintas de al menos 12 caracteres y hasta 72 bytes. Se almacenan con bcrypt, nunca en Git ni argumentos. No usar contraseñas de fixtures para cuentas reales.

Solo una persona con acceso local autorizado a PostgreSQL puede aprovisionar cuentas. No hace falta compartir contraseñas. Existe `desactivar --correo ... --autorizar`, que impide desactivar la última administradora activa. El panel no crea cuentas ni concede permisos.

## Pruebas

Suites específicas: `administracion.test.js`, `admin-gestion.test.js` y `admin-ui.test.js`; regresiones de sesiones y suscripciones. Las pruebas PostgreSQL utilizan el lanzador aislado existente, con bases temporales, datos ficticios, proveedores simulados y red externa bloqueada. Nunca deben probarse cancelaciones reales para validar el botón.

La revisión visual se hace contra ese entorno temporal. Si faltan 014 o 015 en un equipo conservado, se trata como preparación pendiente, sin omitir autorización ni auditoría para permitir operaciones.
