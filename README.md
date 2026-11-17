# Meraki

Plataforma de reservas y gestión para emprendimientos de belleza y cuidado personal.

**Proyecto Capstone de Ingeniería en Informática**
**Integrantes:** Adriana Ávila y Natalia Leiva.

## Funcionalidades y tecnologías

- **Front Office:** catálogo, búsqueda, filtros, mapa, servicios, disponibilidad y reservas como invitada.
- **Back Office:** perfil, servicios, profesionales, horarios, bloqueos, agenda, Dashboard, notificaciones y suscripciones.
- **Tecnologías:** Node.js, Express, PostgreSQL, JavaScript, HTML/CSS, Leaflet, Transbank SDK y Nodemailer.

Se conserva la implementación original de **Webpay Plus, Oneclick Mall y Gmail OAuth2**. En esta copia de evaluación las operaciones externas están **desactivadas por seguridad**; se demostrarán presencialmente. No se han reemplazado por simulaciones en la aplicación.

## Instalación en Windows

### 1. Instalar los requisitos

- **Node.js 24 LTS**, con npm incluido. Versiones verificadas: Node.js 24.21.0 y npm 11.19.0.
- **PostgreSQL 18** instalado y su servicio iniciado. La estructura se exportó con PostgreSQL 18.6.
- Conocer el usuario y la **contraseña local de PostgreSQL** elegidos durante su instalación. El usuario habitual es `postgres`.
- Un navegador actualizado, preferentemente Chrome o Edge, e Internet para instalar dependencias y cargar el mapa.

No se necesitan Git, Docker ni Visual Studio Code. Las bibliotecas de la aplicación se instalan en el paso 3.

### 2. Descomprimir y abrir PowerShell

1. Descomprime el ZIP con **Extraer todo**.
2. Abre la carpeta **Meraki** que contiene este `README.md` y las carpetas `backend`, `frontend` y `database`.
3. En el Explorador de archivos, haz clic en la **barra de direcciones**, escribe `powershell` y pulsa **Enter**. Se abrirá PowerShell directamente en esa carpeta.

### 3. Instalar las dependencias

En esa ventana de PowerShell ejecuta:

```powershell
cd backend
npm.cmd ci
```

**Los comandos restantes se ejecutan desde esta misma carpeta `backend`.**

### 4. Crear y guardar la configuración local

```powershell
npm.cmd run evaluacion:configurar
notepad .env
```

El primer comando crea `backend/.env` a partir de `.env.example` y genera una clave aleatoria de sesiones. No sobrescribe un `.env` existente.

En el Bloc de notas:

- Completa `DB_USER` y `DB_PASSWORD` con los datos de **tu PostgreSQL local**. Si la contraseña contiene `#`, escríbela entre comillas dobles.
- Conserva `DB_HOST=127.0.0.1`, `DB_PORT=5432` y `DB_NAME=meraki_evaluacion_capstone`, salvo que tu instalación utilice otro puerto.
- Mantén **`MERAKI_PROVEEDORES_EXTERNOS=0`** y **`MERAKI_SUSCRIPCIONES_AUTOMATICAS=0`**. No actives esas variables mediante la configuración del sistema o de PowerShell.
- No cambies la clave de sesiones generada ni completes las variables opcionales de Gmail.

**Guarda con Ctrl+S y cierra el Bloc de notas antes de continuar.** El archivo debe llamarse `.env`, no `.env.txt`. No lo compartas.

### 5. Crear la base e importar los datos ficticios

```powershell
npm.cmd run evaluacion:preparar
```

Este comando crea una base nueva llamada **`meraki_evaluacion_capstone`**, importa `database/entrega-esquema.sql` y carga los datos ficticios. Su estructura corresponde a la exportación de la base original, sin propietarios ni permisos específicos del equipo de desarrollo.

El usuario PostgreSQL necesita permiso para crear bases e instalar la extensión `btree_gist`; el usuario local `postgres` dispone normalmente de esos permisos.

**Protección de datos:** el instalador no reutiliza ni elimina bases existentes. Si el nombre ya existe, se detiene sin modificarlo. Para una instalación nueva, elige otro `DB_NAME` que empiece por `meraki_evaluacion_`.

No uses `meraki_db` ni `meraki_demo`. No ejecutes manualmente `schema.sql`, `seed.sql` ni las migraciones sobre la base importada.

### 6. Iniciar y detener Meraki

```powershell
npm.cmd start
```

Mantén esa terminal abierta mientras utilizas la aplicación. Para detenerla, pulsa **Ctrl+C**. Para volver a iniciar, ejecuta otra vez `npm.cmd start`; no repitas la preparación de la base.

## Accesos

- **Front Office:** [http://localhost:3000/front-office/](http://localhost:3000/front-office/)
- **Back Office:** [http://localhost:3000/back-office/](http://localhost:3000/back-office/)
- **Consulta privada:** abre el enlace generado al crear una reserva. No existe un enlace común para todas las reservas.

## Cuentas ficticias del Back Office

| Correo | Contraseña de evaluación | Emprendimiento |
|---|---|---|
| `equipo@example.test` | `Meraki-Evaluacion-2026!` | Estudio Evaluación — equipo ficticio |
| `sola@example.test` | `Meraki-Evaluacion-2026!` | Estudio Evaluación — atención individual |

Las cuentas se crean únicamente en la base de evaluación y sus contraseñas se almacenan mediante hash. No reutilices estas credenciales en producción.

## Recorrido de revisión

1. En el Front Office, busca «Estudio», combina comuna y categoría y abre un servicio.
2. Selecciona una profesional y una fecha futura. Los horarios ficticios son de 09:00 a 18:00 todos los días, excepto las horas ocupadas.
3. Si deseas crear una reserva, introduce datos inventados y un correo como `contacto@example.test`. Envía una sola vez y conserva el enlace privado.
4. **Una reserva nueva puede quedar pendiente de abono: es el resultado esperado, no un fallo.** Los pagos y correos externos están desactivados en esta evaluación. No es necesario pagar para revisar el código, la agenda o el Dashboard.
5. Usa el enlace privado para consultar fecha, hora de Santiago y estado. La cancelación aparece cuando las reglas de la reserva la permiten. La recuperación de una respuesta incierta funciona durante la misma visita; no promete recuperación después de recargar la página.
6. En el Back Office revisa agenda, filtros, indicadores y Dashboard. Hay reservas ficticias históricas y una atención futura. Los estados de muestra **no acreditan pagos reales**.
7. Revisa servicios, profesionales, horarios y perfil. La segunda cuenta permite comprobar la separación entre emprendimientos.
8. En Notificaciones hay una confirmación pendiente de muestra, sin envío. Puedes actualizar la lista; no reintentes enviarla. En Suscripción hay un mes gratuito desde la instalación, sin tarjeta inscrita ni cobros.

El abono pendiente con orden `EVAL-SIN-PROVEEDOR-1` es ficticio: no tiene token ni autorización de Transbank. Los valores del Dashboard son reservas y proyecciones, no ingresos recibidos.

## Integraciones y limitaciones

- **Webpay Plus y Oneclick Mall:** código original de Transbank Integration incluido. Sus operaciones están desactivadas en la configuración entregada. Un ensayo externo propio requiere configurar el ambiente correspondiente; no utilizar tarjetas ni credenciales productivas.
- **Gmail OAuth2:** implementación original incluida, sin credenciales privadas ni envíos habilitados. Para utilizarla se necesitan una cuenta remitente y credenciales propias, no las de las integrantes.
- **Mapas:** Leaflet se incluye localmente con su licencia. Las teselas de OpenStreetMap requieren Internet y mantienen su atribución. No se permiten descargas masivas ni precarga ([política de uso](https://operations.osmfoundation.org/policies/tiles/)). El catálogo funciona si falla la cartografía. Los negocios ficticios no tienen coordenadas inventadas; el mapa puede aparecer sin marcadores. «Cómo llegar» permanece deshabilitado sin ubicación confirmada.
- **Próxima atención:** requiere Temporal nativo y `getTimeZoneTransition`. Si el navegador no los ofrece, muestra indisponibilidad sin bloquear la interfaz.

Las integraciones externas se mostrarán en la demostración presencial. La instalación local no acredita una aprobación de pago ni una recepción de correo.

## Pruebas automatizadas

Abre otra ventana de PowerShell en la carpeta `Meraki`, entra en `backend` y ejecuta:

```powershell
cd backend
npm.cmd run test:aislado
```

El comando requiere PostgreSQL disponible, `.env` configurado y permiso para crear bases. Crea y elimina bases temporales propias, con datos ficticios y proveedores simulados. No ejecuta las pruebas sobre la base de evaluación ni sobre bases históricas. El proceso de pruebas bloquea la red externa y no utiliza credenciales OAuth privadas.

## Problemas frecuentes

| Problema | Solución |
|---|---|
| Node o npm no reconocido | Instala Node.js y vuelve a abrir PowerShell. |
| PostgreSQL no responde | Inicia su servicio y revisa `DB_HOST` y `DB_PORT` en `.env`. |
| Contraseña de base incorrecta | Corrige tus datos locales `DB_USER` y `DB_PASSWORD`; guarda `.env`. |
| Base ya existente | Para instalar desde cero, usa otro nombre `meraki_evaluacion_...`. No borres bases históricas. |
| Puerto 3000 ocupado | Detén tu otra instancia o cambia `PORT`, `PUBLIC_BASE_URL` y `WEBPAY_RETURN_URL` al mismo puerto libre; abre las URLs con ese puerto. |
| Dependencias faltantes | Ejecuta `npm.cmd ci` dentro de `backend`. |
| `.env` no encontrado o incompleto | Ejecuta `evaluacion:configurar` una sola vez y completa los datos locales. Comprueba que no se haya guardado como `.env.txt`. |
| Mes gratuito vencido | Prepara una base nueva con otro nombre permitido. No se activan renovaciones. |

## Estructura y seguridad

```text
backend/                 Servidor original, dependencias, scripts y pruebas
frontend/front-office/   Catálogo, mapas y reservas
frontend/back-office/    Gestión, agenda, Dashboard y notificaciones
frontend/consulta/       Consulta privada
database/                Estructura exportada y migraciones originales
preparacion/             Fuentes y pruebas de módulos
docs/                    Archivos de apoyo requeridos por pruebas
```

La entrega contiene datos ficticios reproducibles. Se excluyen datos históricos, credenciales privadas, cookies, sesiones y enlaces privados existentes. El inicio utiliza el servidor original y conserva sus reglas financieras. No actives pagos, envíos ni renovaciones durante la revisión local.
