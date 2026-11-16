# Ensayo visual y funcional de incorporación

## Entorno y alcance

Se ejecutó el Backend y Back Office originales en el navegador integrado, puerto local 3002, con una base efímera propia. No se usó meraki_db ni el sandbox financiero. Proveedores bloqueados y renovaciones desactivadas; el contador del ensayo terminó con cero notificaciones y cero abonos aprobados. No se realizaron operaciones de pago ni se usaron credenciales personales.

La base visual fue `meraki_muestra_1794861169897_3220fa67`. Al detener el proceso no apareció confirmación de limpieza; se verificaron su nombre exacto, OID, propietaria, fixtures de esta ejecución y ausencia de conexiones antes de eliminar exclusivamente ese recurso. Se comprobó su ausencia. La base de regresión también se eliminó al terminar sus pruebas. No quedan datos de esta incorporación en bases conservadas.

## Problemas observados y correcciones

- El registro desplegado heredaba un fieldset sin separación visual: campos y leyenda demasiado juntos. Se incorporó una cuadrícula con espaciado, dos columnas de escritorio y una en móvil, conservando colores y tipografía de Meraki.
- El login y el registro abiertos simultáneamente alargaban/confundían la pantalla. Mientras el registro está abierto se oculta el login; al crearse la cuenta se cierra el registro y se devuelve el foco al correo de ingreso.
- El mensaje global fijo podía superponerse a controles en pantallas angostas. En acceso/alta se presenta en flujo normal; errores del registro y del negocio tienen mensajes inline propios. Al terminar el alta se limpia el aviso de sesión para no dejarlo flotando sobre el panel.
- Se ajustó el ancho de tarjeta, el reflujo de campos, botones y controles móviles. El botón de mostrar contraseña quedó de al menos 44 por 44 píxeles en la comprobación móvil.

Los estilos nuevos están limitados a acceso/alta. No se modificaron Front Office, mapas, Dashboard ni cálculos de agenda. Se conservaron el bloque CLP y la migración 013.

## Comprobaciones reales de navegador

| Paso | Resultado observado |
| --- | --- |
| Registro vacío | Validación nativa «Completa este campo» y foco en Nombre. |
| Contraseñas distintas | Mensaje inline «Las contraseñas deben coincidir», sin alta. |
| Registro ficticio | Cuenta creada; se cerró el formulario y el correo quedó preparado para iniciar sesión. |
| Credenciales incorrectas | «Correo o contraseña incorrectos»; no se accedió al panel. |
| Login correcto | Presentó el alta de negocio, sin mostrar datos de negocios ajenos. |
| Coordenadas incompletas | Rechazo con mensaje; conservó el nombre/comuna escritos. |
| Coordenadas opcionales | Creó el negocio al dejar ambas vacías, sin geocodificación. |
| Negocio nuevo | Estudio Aurora Visual, completamente inventado; acceso al panel y perfil con los datos guardados. |
| Servicios | Lista inicialmente vacía y formulario habilitado. Se creó Manicure Aurora por $20.000, duración 60 min y abono entero de $5.000. |
| Aislamiento visual | El selector mostró únicamente Estudio Aurora Visual, sin los negocios de otras dos cuentas ficticias del fixture. |
| Logout | Regresó al acceso. |
| Cuenta duplicada | Segundo registro rechazado: «El correo o RUT ya está registrado»; conservó los campos para corregir. |

El rechazo de edición/consulta privada de otra propietaria y la concurrencia del alta también se validan mediante las pruebas HTTP automatizadas existentes. No se presenta esa parte como una interacción manual de navegador: la interfaz solo ofrece los recursos propios.

## Resoluciones comprobadas

- Escritorio 1366×900: registro y alta en dos columnas; panel y servicio creado. Sin desbordamiento horizontal.
- Móvil 390×844: registro, errores de contraseña, alta y panel de servicios. Una columna, sin controles fuera del ancho ni superposición de mensajes del alta.
- Móvil 320×568: registro, alta y login; controles contenidos en el ancho y disponibles mediante desplazamiento vertical. Se alcanzaron los botones de formularios largos; no se cortaron por un contenedor de altura fija.

Se compararon scrollWidth y clientWidth del documento y límites de los controles; coincidieron los anchos de contenido/cliente, considerando la barra de desplazamiento. Las capturas muestran el resultado visual. El override de viewport se restableció al finalizar.

Son resoluciones emuladas en el navegador integrado, NO teléfonos físicos ni pruebas en Safari/Firefox/otros navegadores. No se realizó una auditoría completa de accesibilidad.

## Archivos de este ajuste

- `frontend/back-office/gestion.css`: estilos scoped del acceso/alta, responsive y mensajes.
- `frontend/back-office/index.html`: estados inline accesibles del registro y del alta.
- `frontend/back-office/incorporacion.js`: feedback local, cierre/foco y limpieza del aviso al acceder al panel.
- `frontend/back-office/back.js`: conexión de los dos estados locales al módulo.
- `backend/test/incorporacion.test.js`: regresión de mensajes locales y foco.
- Este informe, `PRUEBAS-VISUAL-INCORPORACION-2026-11-16.txt` y capturas.

Capturas con datos inventados:

- `alta-registro-escritorio-2026-11-16.jpg`
- `alta-registro-movil-2026-11-16.jpg`
- `alta-login-movil-2026-11-16.jpg`
- `alta-servicios-escritorio-2026-11-16.jpg`
- `alta-servicios-movil-2026-11-16.jpg`

## Regresión y cierre

`npm.cmd run test:aislado`: **542 entradas aprobadas, cero fallidas y cero omitidas**. Las suites financieras usan proveedores simulados. Sintaxis de los scripts modificados y git diff --check correctos. No se crearon nuevas migraciones en este bloque ni se aplicaron migraciones a la principal.

El entorno visual quedó detenido y eliminado. No hubo commit ni push. Los cambios previos permanecen conservados. La activación futura del código del backend en la principal requiere su reinicio controlado; este ensayo no creó cuentas reales ni ejecutó ese flujo allí.
