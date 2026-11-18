# Administración general de Meraki

Acceso privado: `/admin/` redirige a `/admin/login` si no existe sesión administrativa. No se enlaza en el Front Office ni en el Back Office y no admite registro público. Todas las consultas `/api/admin/*` requieren una cuenta administrativa activa comprobada en PostgreSQL en cada solicitud.

## Instalación y cuentas

La migración **014_administradoras.sql** añade exclusivamente `administradora`; no se aplica automáticamente. Antes de aplicarla en una base conservada: identificar instancia y base, disponer de respaldo restaurable, revisar si la tabla ya existe y autorizar explícitamente la ejecución. No se crea ninguna cuenta por defecto ni se altera `schema.sql`. Una segunda ejecución de la migración produce error en lugar de modificar una tabla preexistente.

Después de autorizar y aplicar esa migración, desde una terminal interactiva local en `backend`:

```powershell
node scripts/administradoras.cjs crear --correo responsable@dominio.cl --autorizar
```

El comando indica base y puerto y exige escribir `AUTORIZAR`. Solicita la contraseña dos veces sin eco; requiere al menos 12 caracteres y un máximo de 72 bytes, y guarda únicamente bcrypt con costo 12. No se aceptan contraseñas por argumentos, variables, archivos ni entrada redirigida. No registrar la terminal con herramientas que capturen pulsaciones. El correo no se toma de la cuenta de una emprendedora.

Para un futuro propietario: crear su cuenta con este procedimiento, comprobar su ingreso a `/admin/` y solamente después desactivar las cuentas anteriores:

```powershell
node scripts/administradoras.cjs desactivar --correo anterior@dominio.cl --autorizar
```

No se puede desactivar la última administradora activa. La desactivación invalida su acceso en la siguiente petición, incluidas sesiones previamente abiertas. No existe formulario público, transferencia automática ni edición manual de hashes.

## Separación y datos

Se reutilizan Express Session, PostgreSQL y bcrypt. La cookie `meraki.admin.sid` es independiente de `meraki.sid`; entrar o salir de administración no inicia ni cierra la sesión de emprendedora. La sesión administrativa dura 30 minutos y utiliza HttpOnly y SameSite Strict. En producción exige HTTPS mediante cookie Secure (`NODE_ENV=production`); configurar correctamente HTTPS y proxy antes de desplegar. El almacenamiento de sesiones existente se reutiliza; no se duplica la información comercial.

El panel comercial es de solo lectura. Solo login/logout y el almacenamiento técnico de sesiones escriben estado de autenticación. La creación/desactivación de administradoras se realiza exclusivamente por el comando local, fuera del panel web. No hay endpoints para modificar emprendedoras, negocios, suscripciones o cobros.

Login admite hasta 8 intentos por correo y 30 por IP en una ventana de 15 minutos; las respuestas no revelan si el correo existe o está inactivo. Este límite es local al proceso: para múltiples instancias se necesita un limitador compartido y configuración de proxy revisada. Se regeneran las sesiones al ingresar. Las solicitudes de autenticación requieren cabecera de acción y comprobación de origen. Las páginas no permiten incrustación en marcos y las respuestas administrativas no se almacenan en caché.

Se consultan `emprendimiento`, `emprendedora`, `suscripcion`, `pago_suscripcion` y únicamente el estado de la última `inscripcion_suscripcion`. Se conserva `id_emprendimiento`. No se devuelven RUT, contraseñas, hashes, tokens de consulta, identificadores de tarjeta, tokens OAuth ni credenciales Oneclick.

El estado de cuenta (activa/inactiva), la publicación del negocio, el estado registrado de suscripción y el período vigente se muestran separados. Una renovación cancelada puede conservar acceso hasta el fin del período; la fecha límite `acceso_hasta` es exclusiva, como en el resto de Meraki. El período gratuito depende de las fechas existentes, no de una nueva concesión del beneficio.

## Cobros registrados

Se suman únicamente filas de `pago_suscripcion` con `estado='aprobado'` y `proceso='finalizado'`. Se toma una fila por suscripción y período inicial conocido, evitando duplicados históricos. Si falta el período, no se fusionan filas distintas sin evidencia. Los aprobados sin fecha se incluyen en el acumulado y se informan aparte; no se asignan artificialmente a un mes.

El mes usa `fecha_pago`, almacenada como timestamp sin zona por las operaciones existentes con CURRENT_TIMESTAMP. La instancia revisada usa GMT. Para su lectura se interpreta la zona de la sesión PostgreSQL y se convierte a America/Santiago antes de agrupar por mes o presentar el historial. Los límites son inclusivo al inicio y exclusivo al mes siguiente. No se depende del huso horario del navegador ni se modifican los datos almacenados. Las fechas DATE de los períodos se conservan sin desplazamiento. Si alguna instalación cambió históricamente su zona de escritura, esos timestamps carecen de información para reconstruirla: debe verificarse su procedencia antes de utilizar los totales como informe financiero definitivo. Las sumas de PostgreSQL se devuelven como texto decimal para evitar pérdida de precisión durante la consulta.

No se incluyen `abono` ni pagos de reservas, cobros pendientes, rechazados o sin procesamiento finalizado. No representa liquidaciones bancarias ni contacta Transbank. Toda consulta del resumen es global, independiente de los filtros de la lista.

## Pruebas

```powershell
npm.cmd run test:aislado
```

La migración y las escrituras de las pruebas utilizan exclusivamente la base efímera de ese ejecutor. Los datos y cuentas son ficticios; no validan proveedores reales. No ejecutar manualmente pruebas PostgreSQL con la base principal. Cada instalación requiere autorización para aplicar la migración y crear su propia cuenta; Git no transfiere cuentas, contraseñas ni sesiones.

Verificación del 18-11-2026, incluyendo los ajustes de búsqueda y paginación: pruebas específicas del módulo aprobadas. La regresión completa ejecutó 612 casos: **611 aprobados, 1 fallido, 0 omitidos**. El único fallo pertenece a `test/evaluacion.test.js`: el instalador existente referencia `007_clienta_correo_unico.sql`, que no existe. Se comprobó la misma referencia en HEAD; no se modificó el instalador ni se ocultó su prueba. Sintaxis y `git diff --check` correctos.

En navegador, sobre el backend original y una base temporal propia, se comprobaron login administrativo, listado, búsqueda, filtro sin suscripción, detalle e historial con cobros ficticios, cierre de sesión y denegación de la API a una emprendedora autenticada. Se midieron vistas de 1366×900, 390×844 y 320×568 sin desbordamiento horizontal. No se comprobó un dispositivo físico ni se ejecutaron operaciones financieras. La revisión visual posterior del logo y paginación en Edge quedó bloqueada por la automatización; esos ajustes se comprobaron mediante código y pruebas.

Después, Natalia autorizó aplicar únicamente la migración 014 en su PostgreSQL local, con un respaldo actualizado y restauración verificada. Se conservaron las 23 tablas anteriores y sus registros. La primera administradora se creó interactivamente, sin compartir ni registrar su contraseña. Esto no instala la tabla ni crea cuentas en el computador de Adriana.

La búsqueda del panel usa nombres del emprendimiento y de la responsable; el ID existente se conserva dentro del detalle. Se utiliza el logo original de Meraki. Las listas e historiales muestran controles de página únicamente cuando hacen falta (50 registros por página).
