# Demostración aislada de MERAKI

## Abrir y recorrer

URL: **http://localhost:3001/front-office/**. El puerto 3000 conserva su entorno normal.
La franja verde identifica la demostración; no debe confundirse con la base principal.

1. Pulsar «Ver servicios de Estudio Meraki — DEMO».
2. Elegir la profesional ficticia y una fecha actual o futura.
3. Consultar horas y seleccionar una de las opciones de PostgreSQL.
4. Introducir nombre y correo ficticios, por ejemplo `demo@example.com`.
5. Revisar el resumen. No se admite crear una reserva: si se pulsa continuar,
   el servidor rechaza la primera escritura y no guarda clientas ni reservas.

El Back Office y sus enlaces están bloqueados en este servidor: la demo sirve
exclusivamente para el recorrido público hasta el resumen.

## Iniciar y detener

Desde la raíz del repositorio, en PowerShell:

```powershell
$env:MERAKI_SUSCRIPCIONES_AUTOMATICAS='0'
node demo/server.cjs
```

Dejar esa consola abierta. Para detener ese proceso, pulsar **Ctrl+C** en esa consola.
Si Codex lo inició en su propia sesión, solicitarle que lo detenga antes de iniciarlo
manualmente. No detener procesos desconocidos ni reemplazar el servidor del puerto 3000.
Si el puerto 3001 está ocupado, el arranque falla sin sustituir el proceso existente.

## Preparación inicial — ya ejecutada en Adriana

`node demo/setup.cjs` crea la base nueva y el usuario `meraki_demo_lector`.
**No repetir para reiniciar la demo.** Si la base, el usuario o la configuración
ya existen, se detiene sin sobrescribirlos ni eliminarlos.

La preparación lee las variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y
`DB_PASSWORD` del `.env` principal solo para la creación administrativa y las
comparaciones de lectura. No copia la base ni conserva esas credenciales.
Aplica `schema.sql` y 002–008 únicamente en `meraki_demo`, nunca en `meraki_db`.
No ejecuta `seed.sql`: inserta solo sus propias filas ficticias.

Datos de demostración:

- Un emprendimiento activo: Estudio Meraki — DEMO.
- Una categoría: Bienestar demo.
- Un servicio de 60 minutos, precio ficticio $20.000 y abono ficticio $5.000.
- Una profesional activa, asignada al servicio.
- Siete horarios, uno por día, de 09:00 a 18:00.
- Una suscripción ficticia en prueba, vigente un mes calendario desde la creación.
- Renovación automática falsa, sin tarjetas ni identificadores Oneclick.
- Sin clientas, reservas, abonos, pagos de suscripción ni notificaciones.
- Cuenta ficticia con acceso deshabilitado; la demo no admite autenticación.

## Configuración privada y aislamiento

`demo/.env.demo` contiene exclusivamente la conexión de lectura de la demo y una
clave de sesión propia. Está excluido de Git por la regla existente `.env.*`.
No modificar ni publicar ese archivo. Los informes `.env.demo.audit.json` y
`.env.demo.verify.json` también están ignorados y no contienen credenciales.
Cada computador debe preparar su propia demo; no trasladar este archivo privado.

El servidor se niega a usar un nombre distinto de `meraki_demo`, un usuario distinto
de `meraki_demo_lector` o un puerto distinto de 3001. No carga el `.env` principal.
El usuario demo no es propietario de tablas, solo tiene SELECT y carece de permisos
sobre las tablas de `meraki_db`. Tiene `default_transaction_read_only=on`.

## Protecciones

- Servidor ligado a localhost; no se publica en la red.
- Lista cerrada de GET para catálogo, categorías, profesionales, disponibilidad
  y los dos archivos del Front Office. Las demás rutas devuelven HTTP 405.
- Todas las escrituras se bloquean antes de llegar al backend, incluso clientas,
  reservas, configuración, autenticación, abonos, notificaciones y suscripciones.
- También se bloquean los retornos GET de Webpay y Oneclick.
- No se ocultan ni saltan validaciones: se ejecutan el catálogo, la disponibilidad
  y el control de suscripción originales con una conexión de lectura a la demo.
- Una carga aislada del backend sustituye DB, pagos, correo y almacenamiento de
  sesiones únicamente dentro del proceso demo. Los adaptadores externos arrojan
  error si se intenta usarlos. No se importan las implementaciones reales de correo
  ni de Oneclick. El SDK de Webpay se sustituye por un adaptador bloqueado.
- Se eliminan las cookies recibidas antes de entrar al backend para no reutilizar
  sesiones del localhost del puerto 3000.
- El planificador no se inicia: la aplicación se importa y se fuerza
  `MERAKI_SUSCRIPCIONES_AUTOMATICAS=0`.
- `/demo/estado` informa base, usuario de lectura y contadores de intentos externos,
  sin mostrar claves. No permite ejecutar operaciones.

No se modifican archivos compartidos del backend ni las reglas de Natalia. La
vigencia ficticia solo existe en la base demo y no crea un pago aprobado ficticio.
Al vencer, se aplicará el bloqueo normal; no se renueva automáticamente.

## Verificar

```powershell
node --test demo/server.test.cjs
node demo/verify.cjs
```

La segunda orden requiere el servidor demo activo y acceso de lectura administrativo
al entorno principal para comparar huellas. Comprueba rutas bloqueadas, PostgreSQL
de lectura, falta de acceso del rol demo a las tablas principales, vigencia sin
tarjetas y ausencia de cambios en ambas bases. Solo intenta un UPDATE sin filas
afectables en la demo para confirmar que PostgreSQL lo rechaza. No ejecuta escrituras
en `meraki_db` ni operaciones reales de proveedores.

Resultados de preparación en Adriana, 4 de noviembre de 2026:

- 3 pruebas de lista de acceso aprobadas, sin fallos.
- 14 rutas de escritura/retorno rechazadas con 405.
- Catálogo reservable, 1 profesional y 9 horas para el 5 de noviembre.
- Resumen comprobado en Chrome a 1280 y 390 píxeles, sin enviar el formulario,
  errores JavaScript ni desbordamiento horizontal.
- Intentos de Webpay, Oneclick y correo: cero.
- Comparación de las 20 tablas de `meraki_db`: intactas desde la preparación,
  incluidas 7 reservas, 6 abonos y 2 clientas. `.env` principal intacto.
- Datos de la demo intactos después de las comprobaciones.

La primera ejecución del script visual temporal apuntó por error al puerto 3000;
solo realizó lecturas y no pudo completar el recorrido restringido. Se corrigió
la URL a 3001 y la comprobación pasó. Ese script y las capturas están fuera del
repositorio; no se modificó el Front Office para esta demostración.

## Continuidad para Natalia y ChatGPT

Archivos nuevos exclusivamente en `demo/`: configuración auxiliar, preparación,
servidor, pruebas, verificación y este documento. Sin cambios del backend compartido,
API, Front Office, migraciones o `.env` principal durante este bloque. Los cambios
pendientes del Bloque A1 se conservan. No hay commit ni push.
