# Demostración segura del Meraki original

Se utiliza el código de este repositorio, sin copiar la aplicación ni crear otra
interfaz. El comando crea PostgreSQL temporal para permitir login, reservas y
gestión sin escribir en `meraki_db` o `meraki_demo`. No modifica `.env`.

## Iniciar

Abrir PowerShell y ejecutar:

```powershell
cd C:\Users\adria\Documents\GitHub\Meraki
node .\backend\scripts\demostracion-local-segura.cjs
```

Mantener esa consola abierta. El proceso debe confirmar la base efímera y mostrar
que escucha en el puerto 3000. Si ya está ocupado, se detiene sin reemplazar al
servidor existente. No abrir directamente archivos HTML desde Windows.

- Front Office: http://localhost:3000/front-office/
- Back Office: http://localhost:3000/back-office/
- Cuenta ficticia: `demo1@example.test`
- Contraseña exclusivamente ficticia: `Meraki-Demo-Local!`
- Segunda cuenta ficticia: `demo2@example.test`, misma contraseña; tiene otro negocio.

Solo admite PostgreSQL local y necesita permisos de creación de base e instalación
de `btree_gist` en la base nueva. No instala dependencias. Si aparece un error,
no aplicar migraciones ni cambiar permisos de las bases históricas para resolverlo.

## Recorrido recomendado

1. Buscar «Demostración ficticia 1» y combinar comuna/categoría. Mostrar quitar
   filtros y Ver todos. Elegir servicio y profesional.
2. Seleccionar la fecha de ejemplo indicada en la consola, consultar disponibilidad
   y elegir una hora libre. Los datos y horarios son ficticios, en hora de Santiago.
3. Completar el contacto con un correo de ejemplo, como `invitada@example.test`.
   Crear la reserva y abrir su enlace privado. No iniciar un pago. Puede cancelarse
   si no tiene abonos, tal como exige el backend original.
4. Iniciar sesión en Back Office con la cuenta ficticia. Abrir Reservas y pulsar
   Actualizar agenda después de crear o cancelar desde otra pestaña.
5. Mostrar los seis indicadores, la distribución por servicio/profesional y los
   filtros existentes de fecha/estado. Los filtros cambian la lista, no los totales.
   Las canceladas aparecen en el filtro y en los desgloses de distribución.
6. Hay una reserva confirmada pasada que habilita «Marcar atendida/no atendida» y
   una confirmada futura para Próxima atención. Los estados son fixtures, no pagos.
   Si el navegador no dispone de Temporal, esa tarjeta avisa indisponibilidad.
7. Revisar Perfil, Servicios, Equipo y Horarios/bloqueos. Los cambios que se hagan
   aquí solo afectan la base temporal. Mantener las comprobaciones de vigencia.
8. Cerrar sesión y, opcionalmente, entrar como demo2 para ver el otro emprendimiento
   sin mezclar sus reservas. No confundir el espacio Reservas con un Dashboard nuevo.

No utilizar nombres, correos, tarjetas ni otros datos reales. La reserva invitada
conserva su contrato anterior: esta demostración no corrige sus riesgos de identidad
ni idempotencia. El laboratorio de diseño permanece desconectado.

## Bloqueos y límites

- La misma aplicación Express se monta detrás de un bloqueo de rutas financieras
  y de envío/reintento de notificaciones, exclusivo del proceso de demostración.
- Las renovaciones están apagadas, Oneclick y envío de correo se sustituyen por
  funciones de rechazo y las solicitudes HTTP externas se bloquean en el proceso.
- No se modifican los archivos financieros originales. El arranque normal mediante
  `npm.cmd start` no incluye estas protecciones adicionales.
- No hay indicador de ingresos implementado. Los precios de reservas y abonos
  pendientes NO son ingresos y no se presentan como tales.
- Webpay externo no se demuestra como terminado; depende de la confirmación de Natalia.
- Google Maps real y ubicaciones confirmadas siguen fuera de este recorrido.
- Los filtros visuales de servicio/profesional aún no existen; sí existe distribución
  por sus identificadores. No se añadieron funcionalidades secundarias.
- Esta revisión no sustituye la comprobación visual final en el navegador elegido.

## Detener

En la misma consola, pulsar **Ctrl+C** una vez y esperar el mensaje:
«Base efímera eliminada y ausencia verificada».
El puerto 3000 queda libre. Todos los cambios ficticios desaparecen.
No cerrar a la fuerza la consola ni finalizar Node desde el Administrador de tareas:
eso puede impedir la limpieza. Si el equipo se apaga inesperadamente, informar el
nombre `meraki_muestra_…`; no borrar bases por coincidencias parciales de nombre.

Para comprobar arranque y limpieza automáticamente, sin dejar servidor abierto:

```powershell
node .\backend\scripts\demostracion-local-segura.cjs --verificar
```

## Base habitual y restricciones

El `.env` principal continúa apuntando a `meraki_db`. Un arranque normal desde
`backend` con `npm.cmd start` usaría esa base: login/logout guardan/eliminan sesiones
y connect-pg-simple puede limpiar sesiones vencidas. Crear o gestionar reservas
también escribe. Por eso no se usó ese arranque contra las bases conservadas bajo
la restricción actual de cero modificaciones.

El comando seguro sobrescribe conexión y secreto solo en su propio proceso y
carga directamente `backend/index.js`. No integra el prototipo invitado ni altera
contratos de producción. Al terminar se cierra el servidor, la tienda de sesiones,
los pools y la base creada, comprobando previamente su nombre y OID.
