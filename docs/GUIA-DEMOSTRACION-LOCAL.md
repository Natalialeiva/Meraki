# Demostración segura del Meraki original

Guía actualizada durante la sesión del 15/16 de noviembre de 2026. Se ejecutan el backend y las interfaces del repositorio, no otra aplicación. PostgreSQL se crea desde cero en una base efímera; no se utiliza meraki_db, meraki_demo ni el sandbox del pago histórico. No se modifica .env.

## Preparación

Instalar dependencias con npm ci en backend y disponer de PostgreSQL local. El usuario configurado privadamente necesita crear una base e instalar btree_gist únicamente en ella. No ampliar permisos ni migrar bases históricas para solucionar el arranque. Si el puerto elegido está ocupado, el lanzador termina sin detener el proceso ajeno.

Desde la raíz del repositorio:

~~~powershell
node backend/scripts/demostracion-local-segura.cjs
~~~

Puerto predeterminado: 3002, enlazado solo a 127.0.0.1. Otro puerto puede elegirse con --puerto 3003.

- Front Office: http://127.0.0.1:3002/front-office/
- Back Office: http://127.0.0.1:3002/back-office/
- La consola muestra las cuentas ficticias y la fecha de ejemplo. Utilizar exclusivamente esas credenciales y contactos bajo example.test. No guardar credenciales en navegador ni usarlas en otro entorno.

El lanzador aplica schema y migraciones hasta012 a una base nueva meraki_muestra_…. Los estados iniciales de las cuatro citas son fixtures, no pagos; la nueva reserva del recorrido sí atraviesa el procesamiento original con proveedor simulado.

## Recorrido para el profesor

1. Abrir Front Office; buscar Demostración ficticia1 combinando nombre, comuna o categoría.
2. Ver servicios y seleccionar Manicure, Profesional Uno y la fecha indicada en consola. Consultar horas; escoger10:00 si está libre.
3. Completar contacto ficticio y crear una reserva como invitada. El intento conserva idempotencia del navegador. Guardar el enlace solamente durante el ensayo.
4. Abrir Consultar reserva y pagar abono. Pulsar Continuar al abono.
5. Debe abrirse la pantalla local **Pago simulado**, sin campos de tarjeta. Pulsar Aprobar pago simulado. La navegación no debe salir de 127.0.0.1.
6. El retorno original muestra Abono aprobado y Volver a mi reserva. La cita queda confirmada y se registra una notificación con identificador DEMO-SIN-ENVIO; no se envía correo.
7. Confirmar que asistiré y aceptar el diálogo. Mostrar asistencia independiente del estado confirmado y del pago.
8. Solicitar cancelación y aceptar el diálogo. La cita sigue confirmada y su horario sigue ocupado.
9. Abrir Back Office e ingresar con la cuenta ficticia del negocio1. En Reservas se muestran cita, asistencia, abono aprobado y solicitud pendiente.
10. Registrar respuesta y cerrar la solicitud. Aceptar el diálogo: no cancela la cita ni devuelve dinero. Consultar de nuevo para ver la respuesta.
11. En Notificaciones mostrar un envío simulado y un intento. No usar Reintentar envío real.
12. En Dashboard mostrar los cinco estados, distribución y filtro Confirmada. Los importes son proyecciones contractuales; no presentarlos como ingresos cobrados.

Si ya se creó la reserva, no comenzar de nuevo para repetir una operación: utilizar su consulta o iniciar otra ejecución del lanzador tras cerrar y verificar la limpieza. El ordenamiento por cercanía y el mapa simulado pueden demostrarse por separado; no conceder permisos de ubicación ni configurar Google durante este recorrido.

## Barreras del proceso

- SDK de reservas sustituido por un proveedor sin red; mantiene orden, monto y token solo en memoria. La autorización local permite al backend original procesar el resultado ficticio.
- El proveedor devuelve un destino HTTPS compatible con la validación original. Solo el lanzador traduce la respuesta exitosa a /__demo/pago. El frontend admite ese destino únicamente con cabecera demo, mismo origen y loopback HTTP. No se debilitó el adaptador financiero de uso normal.
- Oneclick, renovaciones, correo real, recuperación y consulta externa de pagos quedan bloqueados. Los transportes originales de correo se sustituyen antes de cargar la aplicación.
- Solicitudes HTTP externas del proceso y recursos externos del navegador se bloquean. La simulación no implica una nueva transacción Transbank Integration ni recepción Gmail.
- La ruta local /__demo/estado muestra únicamente contadores del ensayo, sin enlaces privados ni destinatarios.

## Verificación automática del lanzador

~~~powershell
node backend/scripts/demostracion-local-segura.cjs --verificar
~~~

Comprueba recursos, login, agenda, bloqueos, reserva invitada, pago simulado, notificación, asistencia y cierre de solicitud. Termina y verifica la eliminación de la base. No deja servidor abierto. Evidencia de esta revisión:31comprobaciones aprobadas.

Para regresión general:

~~~powershell
cd backend
npm.cmd run test
npm.cmd run test:aislado
~~~

El primer comando omite las suites SQL si no están habilitadas. El segundo crea bases nuevas, ejecuta todas las suites con proveedores simulados y elimina únicamente sus recursos. No habilitar MERAKI_DB_TEST apuntando a bases históricas. Si se heredan esas variables de otra consola, abrir una consola limpia o desactivarlas antes del primer comando.

## Detener

Mantener abierta la consola del lanzador. Pulsar Ctrl+C una vez y esperar **Base efímera eliminada y ausencia verificada**. Se comprueba nombre y OID antes de eliminar; no se usa FORCE ni se terminan sesiones ajenas. Si la limpieza falla o el computador se apaga, registrar el nombre exacto e investigar; no borrar bases por coincidencia parcial ni eliminar volúmenes Docker.

Las pestañas del ensayo dejarán de responder tras detenerlo. No son un despliegue permanente ni enlaces para enviar por correo. El ensayo visual de esta sesión necesitó que Natalia aceptara manualmente tres diálogos del navegador; ver ENSAYO-SEGURO-2026-11-15.md.

## Diferencia con arranque habitual

npm start desde backend utiliza la conexión de .env y no inyecta estas barreras. Puede escribir sesiones, reservar y contactar proveedores configurados. Requiere una base compatible, permisos y autorización propios. El sandbox histórico conserva su reserva2 aprobada y sus herramientas V3; no se usa como fixture ni se actualiza para esta demostración.
