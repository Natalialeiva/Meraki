# Continuidad Natalia — organización del Back Office

Fecha: 6 de noviembre de 2026. Se conserva el Front Office de Adriana.

## Resultado

El Back Office original en /back-office/ deja las reservas como vista principal cuando no hay un enlace directo a otra sección. El resto de la gestión se organiza en vistas mediante navegación local, sin crear páginas ni servidores alternativos.

- Menú con iconos: Reservas, Servicios, Equipo, Horarios, Pagos, Notificaciones, Perfil del negocio y Suscripción.
- Agenda con tarjetas, estados, fecha y horas legibles, filtros y contadores derivados de las reservas cargadas. No hay estadísticas inventadas.
- Selector de emprendimiento común a las secciones.
- Revisar abono abre Pagos, conserva su identificador y exige la consulta habitual antes de ofrecer recuperación. Navegar no inicia una consulta a Webpay ni un cargo.
- Los enlaces #tituloPerfil, #tituloHorarios, #tituloSuscripcion y los demás títulos continúan abriendo su vista; se conserva el destino del retorno Oneclick.
- Cambiar de vista no reconstruye los formularios ni elimina campos sin guardar.
- Ojito de contraseña dentro del campo, etiqueta accesible y ocultación al iniciar sesión o restablecer el formulario.
- En una suscripción ya inscrita se ocultan la nueva alta y el consentimiento innecesario. Un reintento de pago rechazado sigue exigiendo consentimiento nuevo y confirmación.
- Menú lateral en escritorio, navegación desplazable en móvil, foco visible y etiquetas accesibles.
- Dashboard está marcado solo como próximo. No se presenta como función implementada.

No se cambiaron reglas de pagos, permisos, vigencia, reservas ni esquema PostgreSQL en este bloque. No se instalaron dependencias, enviaron correos ni ejecutaron pagos para verificar el diseño.

## Archivos que deben publicarse juntos

- backend/test/suscripcion-ui.test.js
- frontend/back-office/index.html
- frontend/back-office/back.js
- frontend/back-office/suscripcion.js
- frontend/back-office/gestion.css (nuevo)
- frontend/back-office/navegacion.js (nuevo)
- Este documento.

gestion.css y navegacion.js son necesarios, no recursos opcionales. Deben incluirse junto con el HTML y back.js: publicar solamente los archivos previamente rastreados puede romper la carga de la interfaz.

## Verificación

- 49 pruebas de agenda, pagos de interfaz, perfil, servicios, trabajadoras, horarios y suscripción aprobadas sobre el diseño final, sin fallos, omisiones ni cancelaciones. Repetidas durante la auditoría previa a publicación.
- Revisión de navegador a 1440, 768, 390 y 320 px: sin errores JavaScript ni desbordamiento horizontal. Comprobados filtros, vista única, navegación, conservación de campos, acceso a pagos y enlace de suscripción.
- Esas revisiones autenticadas usaron respuestas ficticias interceptadas solo en un navegador de verificación sobre la URL original. Cero solicitudes de escritura; no alteraron la base principal. No se presentan como pruebas externas de Oneclick o Webpay.
- Auditoría HTTP contra localhost:3000: HTML, CSS, navegación, back.js y suscripcion.js responden 200 y coinciden byte por byte con los archivos del repositorio activo mediante SHA-256.
- git diff --check sin errores; avisos informativos previos sobre LF/CRLF.

El resultado previo de 212 pruebas corresponde al cierre de la corrección de pagos anterior al rediseño, no a una nueva ejecución completa PostgreSQL durante esta auditoría visual. No sumar baterías que contienen los mismos casos como si fueran resultados únicos.

## Continuidad para Adriana

Abrir /back-office/#tituloReservas y recargar con Ctrl+F5 si hay recursos antiguos en caché. Los enlaces existentes de otras secciones continúan siendo válidos. No se modificó frontend/front-office ni sus recursos de identidad visual, geolocalización o mapas.

Estos archivos comparten main con los avances de Adriana. Consultar origin/main y revisar el árbol local antes de integrar o publicar; no descartar trabajo ajeno ni asumir que un registro histórico de remoto sigue vigente.

La auditoría de este equipo utilizó meraki_traslado_20261104. Esa base y su .env no viajan con GitHub ni reemplazan los datos locales de Adriana.

## Límite de Oneclick

La tarjeta de prueba se inscribió correctamente en la aplicación original. La renovación mensual automática aún no está validada y el planificador debe mantenerse desactivado con MERAKI_SUSCRIPCIONES_AUTOMATICAS=0. Ni el nuevo diseño ni la fecha de próximo cobro del panel certifican la ejecución del procesador. Ver PAGOS-ONECLICK-WEBPAY-2026-11-06.md antes de continuar pruebas externas.

Pendientes: revisión visual de Natalia y Adriana, dashboard futuro y revisión específica de la renovación mensual. No activar pagos como parte de mostrar o publicar el diseño.
