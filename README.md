# Meraki

Plataforma académica para emprendimientos de estética y cuidado personal. Las clientas pueden explorar servicios, reservar sin crear una cuenta y gestionar su cita mediante un enlace privado. Las emprendedoras administran servicios, profesionales, horarios, agenda y estadísticas.

## Tecnologías y estructura

Node.js, Express, PostgreSQL, HTML/CSS/JavaScript, SDK de Transbank y Nodemailer. Docker se utiliza en el laboratorio financiero trasladable; no es obligatorio para el backend local ni para toda la aplicación.

```text
backend/                 Aplicación Express, adaptadores, scripts y test/
frontend/front-office/   Catálogo, filtros, ubicación y reserva invitada
frontend/back-office/    Gestión, agenda, solicitudes y Dashboard
frontend/consulta/       Consulta privada y resultado del abono
database/                Esquema inicial y migraciones incrementales
docs/                    Funcionalidades, migraciones, evidencias y continuidad
preparacion/             Fuentes y antecedentes utilizados por pruebas
```

El backend sirve las tres interfaces. No abrir los HTML directamente desde el explorador de archivos. Algunas fuentes de `preparacion/` se comparan con módulos integrados: no eliminar esa carpeta sin revisar sus dependencias.

## Requisitos e instalación

- Node.js 24 como referencia de desarrollo y npm.
- PostgreSQL 18 como referencia de pruebas; cliente `psql` para instalación manual.
- Extensión `btree_gist` para las restricciones de horarios.
- Una única base principal local `meraki_db`. Las bases y `.env` de cada computador son independientes.

Desde la carpeta del repositorio:

```powershell
cd backend
npm.cmd ci
```

Configurar privadamente `backend/.env` a partir de `backend/.env.example`. Revisar estas variables, sin publicarlas:

- PostgreSQL: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
- Sesiones: `SESSION_SECRET`, con un secreto fuerte y estable.
- Aplicación: `PORT`, `PUBLIC_BASE_URL`, `WEBPAY_RETURN_URL`.
- Diagnóstico: `MERAKI_SUSCRIPCIONES_AUTOMATICAS=0` y `MERAKI_PROVEEDORES_EXTERNOS=0`.
- Gmail opcional: `MAIL_PROVIDER`, `GMAIL_USER`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `MAIL_TEST_TO`.

No copiar secretos entre equipos mediante Git. Para fechas locales puede usarse `PGOPTIONS=-c timezone=America/Santiago`. El proyecto maneja horarios civiles de Santiago; no convertirlos arbitrariamente a UTC.

## Base nueva frente a base existente

### Instalación inicial

Si `meraki_db` ya existe, NO seguir esta instalación: revisar primero sus migraciones y respaldarla. Para un computador sin instalación previa, crear una base **nueva y vacía**:

```powershell
createdb -U TU_USUARIO_LOCAL meraki_db
psql -X -U TU_USUARIO_LOCAL -d meraki_db -v ON_ERROR_STOP=1 --single-transaction -f database/academica/meraki_db.sql
```

El respaldo académico ya incluye la estructura hasta 012 y el negocio inventado Luna Estudio, sin transacciones históricas ni credenciales activas. Su restauración se comprobó en PostgreSQL 18. No volver a aplicar `schema.sql` ni las migraciones sobre esa restauración. Activar la cuenta local importada siguiendo [la instalación académica](docs/INSTALACION-ACADEMICA.md).

Como alternativa técnica al respaldo, una base completamente vacía puede construirse con `schema.sql` y luego las siguientes migraciones, en orden; son dos métodos de instalación excluyentes:

1. `migracion_abonos_reintentos.sql`
2. `002_agregar_token_consulta.sql`
3. `003_notificaciones_correo.sql`
4. `004_fecha_inicio_envio.sql`
5. `005_revision_notificaciones.sql`
6. `006_correccion_correo_reserva.sql`
7. `007_nombre_reserva.sql`
8. `008_suscripcion_oneclick.sql`
9. `009_intentos_webpay.sql`
10. `010_procesamiento_webpay.sql`
11. `011_reserva_invitada.sql`
12. `012_gestiones_reserva.sql`

Todos están en `database/`. No existe una migración `007_clienta_correo_unico.sql`: no agregarla al procedimiento. `schema.sql` instala `btree_gist` en la base elegida y puede requerir permisos de instalación. El backend de uso habitual debe tener los permisos de aplicación necesarios, no utilizar credenciales administrativas de un laboratorio restaurado.

`seed.sql` es opcional y contiene datos ficticios; no proporciona una cuenta de presentación lista para usar. Para una evaluación guiada utilizar el ejecutor seguro de la siguiente sección, que crea sus propias cuentas y un plan ficticio vigente.

### Actualización de una base existente

Primero identificar el destino, obtener un respaldo verificable y revisar su catálogo. Con el backend detenido, aplicar **solo las migraciones faltantes**, en orden, y verificar que se conservaron los datos. No ejecutar `schema.sql`, `seed.sql` ni todas las migraciones indiscriminadamente. Los archivos descargados de Git no prueban que una migración esté aplicada.

Las migraciones 011/012 añaden contacto por reserva, idempotencia, asistencia y solicitudes. Esta versión las necesita para esos flujos. No aplicarlas al sandbox del pago histórico. Ver [control de migraciones](docs/CONTROL-MIGRACIONES-MERAKI.md).

## Ejecución habitual

Solo después de configurar una base compatible y autorizar su uso:

```powershell
cd backend
$env:MERAKI_SUSCRIPCIONES_AUTOMATICAS='0'
$env:MERAKI_PROVEEDORES_EXTERNOS='0'
npm.cmd start
```

Puerto predeterminado 3000:

- Front Office: `http://127.0.0.1:3000/front-office/`
- Back Office: `http://127.0.0.1:3000/back-office/`
- Consulta: abrir el enlace privado de una reserva; no publicarlo.

El arranque habitual utiliza `meraki_db` configurada en `.env` y puede escribir sesiones y datos. Con `MERAKI_PROVEEDORES_EXTERNOS=0` bloquea las rutas de abonos y operaciones de suscripción, los transportes de correo y las llamadas Oneclick, y escucha solo en loopback. Este modo no simula pagos ni confirma reservas: sirve para revisión local. Para una prueba externa autorizada se debe reiniciar con la configuración de Integration adecuada; no activar renovaciones automáticas.

## Contingencia simulada y pruebas aisladas

La presentación principal utiliza el sistema original y `meraki_db`; el siguiente ejecutor es una contingencia identificada explícitamente como simulación. No acredita Webpay Integration ni recepción Gmail y no es la instalación final.

Con dependencias instaladas y PostgreSQL local disponible, desde la raíz:

```powershell
node backend/scripts/demostracion-local-segura.cjs
```

El ejecutor crea una base nueva `meraki_muestra_…`, aplica el esquema hasta 012 y carga únicamente datos ficticios. Sirve **el backend y las interfaces originales** en `http://127.0.0.1:3002`. No reemplaza un servidor existente. Otro puerto puede elegirse con `--puerto 3003`.

La consola muestra la fecha del ensayo y el acceso exclusivamente ficticio. No utilizar datos personales, tarjetas o cuentas reales. El pago se aprueba en una pantalla local que dice **Pago simulado**, sin salir hacia Webpay. El registro de notificación usa `DEMO-SIN-ENVIO`: no entrega correo. Oneclick y renovaciones permanecen bloqueados, al igual que la recuperación y consulta externa de pagos.

La traducción del destino de pago existe solo en el lanzador. El backend original mantiene su exigencia de respuesta HTTPS del proveedor. La consulta admite la pantalla HTTP local únicamente en loopback, mismo origen y con la cabecera de demostración emitida por el lanzador.

Al terminar, pulsar **Ctrl+C** y esperar la confirmación de eliminación de la base creada. No cerrar a la fuerza. Si la limpieza falla, conservar el nombre exacto e investigar; no borrar otras bases por prefijo.

Comprobación automática de arranque y cierre:

```powershell
node backend/scripts/demostracion-local-segura.cjs --verificar
```

Recorrido e intervención manual: [guía de demostración](docs/GUIA-DEMOSTRACION-LOCAL.md).

## Pruebas

Desde `backend`:

```powershell
npm.cmd run test
npm.cmd run test:aislado
```

El primer comando ejecuta la batería normal; algunas integraciones SQL se omiten sin activación explícita. El segundo crea bases nuevas, utiliza proveedores simulados y limpia únicamente sus recursos temporales. Necesita permisos locales de creación de bases y de `btree_gist`. No activar las suites SQL apuntando a bases históricas.

La evidencia distingue resultados automatizados, ensayo de navegador y pruebas externas pendientes. Ver [integración del MVP](docs/MVP-INTEGRADO-2026-11-15.md) y [ensayo seguro](docs/ENSAYO-SEGURO-2026-11-15.md). Los totales del ejecutor incluyen contenedores de subpruebas.

## Funcionalidades y límites

- Catálogo y filtros combinados; selección de profesional, horarios y disponibilidad.
- Reserva invitada transaccional e idempotente, sin vincular perfiles por coincidencia de correo.
- Gestión de servicios, profesionales, horarios, bloqueos y agenda con sesión/propiedad.
- Consulta privada, confirmación de asistencia y solicitud de cancelación. Una solicitud no cancela, libera horario ni devuelve dinero.
- Dashboard de estados, distribuciones y proyecciones contractuales; estas proyecciones no equivalen a ingresos cobrados.
- **Webpay Plus** para abonos de reservas; **Oneclick Mall** para inscripción y suscripciones. Los adaptadores actuales utilizan Integration, no producción.
- Gmail mediante OAuth2 y control de notificaciones/reintentos. La simulación no acredita entrega real.
- Cercanía opcional y mapa local simulado. Google requiere configuración y autorización externas; no se activa por defecto.

Pendientes externos: renovar la validación de Gmail cuando se autorice; ensayar un caso nuevo de Webpay Integration con alcance propio; completar la validación real de inscripción/renovación Oneclick. No reutilizar la transacción histórica pagada. La reserva invitada valida formato de contacto, no posesión del correo. El despliegue de producción y la política de devolución/cancelación efectiva de citas pagadas requieren trabajo separado.

La evidencia histórica de correo conserva datos operativos en el historial de Git. Para la entrega consultar la [versión académica anonimizada](docs/recuperacion-gmail-academica.json) y sus [limitaciones de privacidad](docs/PRIVACIDAD-EVIDENCIA-CORREO.md). La copia anonimizada no retira automáticamente el original del historial.

Continuidad del equipo: [traspaso a Adriana](docs/TRASPASO-ADRIANA-2026-11-15.md). Cada computador debe revisar sus propios cambios, configuración y migraciones antes de integrar.


## Mapa académico: Leaflet y OpenStreetMap

El Front Office original usa Leaflet 1.9.4, instalado con versión fija en backend
(package-lock incluido). La biblioteca, CSS, iconos y licencia BSD se sirven desde
`frontend/front-office/vendor/leaflet/`, sin CDN ni clave de Google. Se conservan
los módulos Google históricos como referencia, pero el mapa principal elige Leaflet
local; no requiere `mapas-config.local.json` ni facturación.

Para el profesor: instalar dependencias con `npm.cmd ci` desde backend, configurar
la única base principal meraki_db según la guía académica y abrir
http://localhost:3000/front-office/ . Pulsar Ver mapa. No conceder ubicación es
válido: el mapa usa únicamente coordenadas públicas del catálogo. Pulsar un marcador
y después Ver servicios reutiliza la selección existente. Buscar por nombre/comuna
actualiza los marcadores; negocios sin coordenadas siguen disponibles en tarjetas.
Si no hay coordenadas, se muestra Santiago como referencia general, sin inventar
marcadores. Camila está actualmente en la coordenada académica de Plaza de Armas;
no se modificaron esas coordenadas en esta tarea. Sofía continúa sin coordenadas.

Internet es necesario para teselas de `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
La atribución © OpenStreetMap contributors permanece visible. Solo se descargan
las teselas solicitadas por la vista, con Referer y caché normal del navegador.
No realizar descargas masivas, precarga ni almacenamiento offline. El servicio es
comunitario, sin garantía de disponibilidad ni capacidad ilimitada; para tráfico
alto se debe evaluar otro proveedor o alojamiento propio, no añadir reintentos
agresivos. Política: https://operations.osmfoundation.org/policies/tiles/ .
Abrir el mapa comparte IP, Referer y las zonas cartográficas solicitadas con OSM;
no se envían las coordenadas personales obtenidas por la geolocalización opcional.
Si falla Internet/cartografía, el aviso conserva la posibilidad de usar las tarjetas;
una carga inicial del catálogo también necesita que el backend local esté disponible.
Google Maps/Cloud no se activa y no hay servicios de facturación nuevos.

Verificación: cartografía oficial cargada en navegador, marcador de Camila,
selección/servicios y filtros comprobados en localhost:3000. No se efectuaron
reservas, pagos ni correos para esta comprobación.
