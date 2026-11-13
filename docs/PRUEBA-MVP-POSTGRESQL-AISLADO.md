# Prueba integral del MVP con PostgreSQL efímero

Código de partida: `main`, `2379aa3d2972b6c068140d2279f632f04f841979`,
incluyendo el cambio aditivo local de agenda. No se ejecutó la batería anterior.

## Ejecución reproducible

Desde `backend`, con PostgreSQL local disponible y un usuario autorizado para
crear una base temporal e instalar `btree_gist` en ella:

```powershell
$env:MERAKI_MVP_DB_TEST='1'
$env:MERAKI_SUSCRIPCIONES_AUTOMATICAS='0'
node --test --test-reporter=spec test/mvp-postgres-aislado.test.js
```

El script lee privadamente los parámetros de conexión de `.env`, pero ignora
`DB_NAME` como destino. Se conecta a `postgres` exclusivamente para crear y
eliminar una base con prefijo `meraki_mvp_efimera_`, nombre aleatorio y `template0`.
Si el nombre existe, no lo reutiliza. Confirma `current_database()` antes de cargar
estructura o datos. No se conecta a `meraki_db` ni a `meraki_demo`.

Los SQL del esquema y las migraciones actuales se ejecutan únicamente dentro de
la nueva base. No se utiliza `seed.sql`: se crean dos cuentas, dos negocios,
dos categorías, tres servicios, tres profesionales, asignaciones, horarios y
suscripciones ficticias sin renovación ni tarjeta.

Se carga la aplicación original con el pool efímero, el almacenamiento real de
sesiones PostgreSQL y proveedores inyectados que rechazan cualquier operación.
El backend escucha solo en `127.0.0.1`, en un puerto asignado por el sistema,
sin reemplazar el servidor 3000. Las solicitudes HTTP externas se bloquean.

## Resultado final

**22 pruebas contabilizadas por Node, todas aprobadas; 0 fallidas, 0 omitidas.**
Son 21 escenarios y su prueba contenedora. La ejecución final duró unos 2,4 segundos.

- Páginas y archivos JS/CSS/módulos originales accesibles por HTTP.
- Catálogo, categorías y filtros combinados sobre PostgreSQL real.
- Disponibilidad y rechazo de fecha, hora o profesional inválidos.
- Reserva válida pendiente de abono, sin iniciar un pago.
- Horario ocupado y reenvío rechazados; dos creaciones simultáneas producen
  una respuesta 201 y otra 409, y una sola reserva.
- Consulta privada con token válido, rechazo de token inválido/desconocido,
  fecha y hora civiles de Santiago correctas y ausencia de identificadores
  de clienta/token en la respuesta pública de consulta.
- Cancelación sin abonos, liberación del horario y agenda actualizada.
- Login/logout, sesiones PostgreSQL reales y rechazo del negocio ajeno.
- Agenda con IDs contrastados contra las relaciones de la base, conservando
  los campos anteriores.
- Cálculos de distribución y presentación real de `back.js` con la agenda
  recibida del backend efímero; filtros existentes sin consultas adicionales.
- Agenda vacía diferenciada de error de base, recuperación tras el fallo simulado.
- Cero filas en abono, pago de suscripción, inscripción y notificación;
  cero renovaciones y cero llamadas a proveedores.

Una primera ejecución falló en una comprobación del simulador: el fallo de base
inyectado impedía leer primero la sesión. Se delimitó la inyección para probar
el error de agenda manteniendo disponible su sesión; no se modificó el backend.
La base de esa ejecución también fue eliminada.

## Problemas de invitadas reproducidos, NO corregidos

Las cuatro pruebas rotuladas `DIAGNÓSTICO` verifican riesgos existentes. Que pasen
significa que los reproducen, no que el flujo cumpla un contrato seguro:

1. Correo existente devuelve el mismo ID y HTTP 200, frente a 201 para uno nuevo.
2. Un ID conocido de clienta permite atribuir una reserva sin probar propiedad.
3. Un registro de contacto seguido de un horario rechazado deja el contacto sin
   reserva, al tratarse de dos operaciones separadas.
4. La cabecera de idempotencia no tiene contrato implementado: tras cancelar,
   reenviar con la misma clave crea otra reserva en vez de recuperar el intento.

No se cambiaron identidad, contratos públicos ni protecciones para que pasaran.
Estos puntos requieren coordinación antes de exposición pública con datos reales.

## Límites de la demostración

- El Back Office tiene filtros visuales de fecha y estado. Se verificaron
  subconjuntos por ID de servicio/profesional con la respuesta real para cálculos,
  pero NO existen selectores visuales de esos dos filtros en la agenda actual.
- `back.js` se ejecutó en un DOM de prueba con HTTP y PostgreSQL reales;
  no fue una nueva revisión visual manual en Chrome, Edge o Firefox.
- Node no ofrece Temporal nativo en este entorno: la sexta tarjeta conserva
  la indicación de indisponibilidad, sin ejecutar el resolvedor exhaustivo.
- Una reserva confirmada se preparó como fixture mediante SQL exclusivamente
  en la base efímera. No representa un pago ni acredita Webpay Integration.
- No se verificó entrega de correos ni transacciones de pago externas.
- Express emitió un aviso sobre promesas procedentes de la VM de pruebas;
  no produjo fallos y no demuestra un problema del arranque normal.

Para una demostración visual completa falta acordar la corrección de invitadas,
verificar el navegador elegido y preparar un entorno aislado de demostración
que permanezca abierto con autorización. Esta prueba elimina todos sus recursos
al finalizar; no deja una URL ni contactos de prueba en las bases conservadas.

## Limpieza y protección

Bases de ambas ejecuciones, eliminadas y con ausencia comprobada:

- `meraki_mvp_efimera_1794536967598_b13e58a0`
- `meraki_mvp_efimera_1794537066975_146d77d8`

El cierre detiene el servidor HTTP y la tienda de sesiones, cierra el pool y
solo elimina la base creada si su nombre y OID siguen correspondiendo al original.
Se verificaron huellas SHA-256 antes/después de los cinco archivos locales
pendientes: todos se conservaron idénticos. No se modificaron `.env`, módulos
financieros, código de producción ni las bases conservadas. Sin commit ni push.
