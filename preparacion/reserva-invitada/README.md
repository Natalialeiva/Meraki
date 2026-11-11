# Preparación del Front Office: reserva como invitada

Estado: diseño no conectado a producción. No implementa un endpoint, transporte,
formulario alternativo ni cambios en el Front Office actual.
Base revisada: `944953cbc4d29d5852b09045831629d5ccff5526`, rama `main`.

## Situación actual

- `frontend/front-office/index.html`: nombre obligatorio (100 caracteres), correo
  obligatorio (150), teléfono opcional (20), etiquetas, autocomplete y ayudas.
- `front.js`: trim, formato básico de correo, errores al interactuar/intentar
  continuar; selección explícita de profesional, fecha y hora disponible.
- Durante el envío, `enviando` y el fieldset bloquean acciones duplicadas. Es una
  protección de esta página, no idempotencia entre pestañas o reintentos de red.
- Actualmente se llama primero a `POST /api/clientas` y después a
  `POST /api/reservas` pasando `id_clienta`. No se ha cambiado ese comportamiento.
- El éxito muestra el enlace relativo `/consulta/#<token>` y bloquea una segunda
  creación. El error actual libera los controles y conserva los datos.
- El helper actual convierte respuestas HTTP en mensajes de error: no conserva
  explícitamente código de negocio, estado HTTP ni Retry-After para la interfaz.

## Experiencia propuesta (requiere aprobación del contrato)

Conservar pasos, paleta, resumen y selección actuales. El bloque de contacto se
presentaría como «Reserva como invitada» con nombre, correo y teléfono opcional.
Ayuda: «Puedes reservar sin crear una cuenta. Revisa tu correo: se usará como
contacto de esta reserva. Escribirlo no verifica su propiedad».
No añadir un selector de clientas ni exponer `id_clienta`.

No consultar si el correo existe. La interfaz tendrá idénticos mensajes y pasos
para un correo nuevo o conocido. El backend tampoco debe revelar esa diferencia.
El resumen mantiene servicio, profesional, fecha, hora de Santiago y montos reales.
No mostrar «correo verificado», «identidad confirmada» ni «pago aprobado» al crear.

Entrada ilustrativa, NO contrato activado:

```json
{
  "contacto": {"nombre": "Invitada ficticia", "correo": "invitada@example.test", "telefono": null},
  "id_servicio": 1,
  "id_trabajadora": 1,
  "fecha": "2030-11-04",
  "hora": "11:00"
}
```

Una sola operación de creación. Ruta, cabeceras, cookie invitada, códigos de
negocio y esquema final de respuesta deben acordarse con Natalia. No asumir que
el endpoint actual admite esta entrada. No hacer fallback a `/api/clientas`.

## Validaciones previstas

Mantener provisionalmente los límites actuales: nombre 100, correo 150, teléfono
20 caracteres. Trim exterior; teléfono vacío se representa como null. No restringir
nombres a letras ASCII ni declarar que el formato del correo acredita su control.
La normalización definitiva del correo se acuerda con el servidor; no quitar
puntos, sufijos ni otros componentes del buzón.

Errores de campo después de blur/interacción o intento de envío; `aria-invalid`,
ayuda asociada y foco en el primer campo inválido al intentar continuar. Una única
región de estado anuncia carga/error/éxito sin repetir datos personales ni tokens.
La validación del navegador no sustituye la del servidor ni garantiza disponibilidad.

## Estados, mensajes y reintentos

Matriz de diseño, no estados implementados. «Datos» incluye contacto y selección;
«clave» siempre es la del intento original, vinculada a su contexto invitado.

| Estado | Mensaje visible | Acciones disponibles | Botón principal | Datos y clave | Foco y anuncio accesible |
| --- | --- | --- | --- | --- | --- |
| inicial | «Reserva como invitada. Completa tus datos de contacto». | Editar contacto y selección; revisar resumen. | «Crear reserva y continuar al abono», deshabilitado hasta cumplir validaciones y disponer de una hora seleccionada. | Conservar en memoria durante la visita; sin envío, sin crear una clave nueva por cada pulsación. | Sin mover foco al cargar; ayudas asociadas, sin errores ni anuncio urgente inicial. |
| validacion | «Revisa los campos indicados antes de continuar». | Corregir campos; consultar disponibilidad si falta hora. | No enviar mientras existan errores; habilitar al corregirlos. | Conservar todos los valores; no consumir un intento por validación local fallida. | Tras intentar continuar, enfocar primer campo inválido; aria-invalid y ayuda asociada; un único resumen anunciado. |
| enviando | «Estamos creando tu reserva…». | Esperar; no cambiar negocio, servicio ni contenido del intento. | «Creando reserva…», deshabilitado para clic y Enter; bloqueo lógico adicional al visual. | Conservar una instantánea inmutable, contexto y clave; una operación en vuelo. | No mover foco a cada cambio; conservar un destino estable y aria-busy; anunciar carga una vez en región polite. |
| creada | «Tu reserva está pendiente de abono. Guarda el enlace privado. Crear la reserva no ha realizado un cobro». | Consultar por enlace validado; comenzar otra reserva solo por acción explícita. | No volver a crear; sustituir por acción de consulta, sin navegación automática ni inicio de pagos. | Conservar confirmación y enlace en memoria; excluir IDs de clientas y campos internos. | Enfocar encabezado de confirmación programáticamente enfocable; anunciar éxito una vez; enlace accesible por Tab. |
| horario_ocupado | «Esa hora ya no está disponible. Elige otra». | Consultar disponibilidad por acción explícita y elegir hora. | Deshabilitado hasta una nueva selección válida. | Conservar contacto, servicio, profesional y fecha; invalidar solo hora. Nueva clave solo tras rechazo terminal inequívoco del intento anterior. | Enfocar aviso asociado al selector de hora; anunciar conflicto una vez. |
| limitado_429 | «Has realizado varios intentos. Espera antes de volver a intentar». | Esperar; consultar estado cuando el contrato lo permita. | «Volver a intentar», deshabilitado durante espera; habilitar después solo si contexto y clave permiten recuperar el intento. | Conservar instantánea y clave; 429 por sí solo no demuestra que la reserva no exista. | Mantener foco estable; anunciar límite y final de espera una vez, sin anunciar cada segundo. |
| conexion_previa | «No hay conexión para enviar la solicitud. Tus datos siguen en esta página». | Revisar conexión; volver a intentar explícitamente. | Sin envío automático al recuperar red; habilitar acción voluntaria cuando corresponda. | Conservar datos y clave si ya existe; solo usar este estado si se sabe que el transporte nunca se invocó. | Mantener foco; anunciar aviso una vez y asociar instrucciones al botón. |
| resultado_incierto | «No pudimos comprobar si la reserva se creó. Reintenta esta misma solicitud para verificarla». | Verificar el mismo intento si contexto y clave siguen válidos; de lo contrario seguir R4/R5. | «Verificar mi solicitud», nunca «Crear otra reserva»; bloquear ediciones que cambien el intento sin resolver. | Conservar exactamente contenido, contexto y clave; no afirmar fallo ni generar otra clave automáticamente. | Aviso de recuperación visible y anunciado una vez; no robar foco por respuestas antiguas. |
| error_temporal | «El servidor no pudo confirmar el resultado. Conservamos tu solicitud para verificarla». | Reintento explícito del mismo intento; esperar si el servidor indica un plazo. | «Verificar mi solicitud», sin bucles automáticos; recuperación supeditada a clave y contexto válidos. | Mantener datos y clave: HTTP 5xx no implica rollback. Pasar a resultado incierto si no hay evidencia terminal. | Anunciar error comprensible una vez; no mostrar respuesta HTML, stack ni detalles internos. |

El horario ocupado requiere un código de negocio acordado y evidencia de rechazo
terminal; HTTP 409 por sí solo no basta. Otro 409 se presenta como «No pudimos
completar esta solicitud. Revisa su estado antes de volver a enviarla» y no permite
editar/recrear mientras el resultado siga incierto. Una respuesta exitosa incompleta
o con token inválido tampoco habilita un enlace: «Recibimos una respuesta incompleta.
Verifica esta solicitud antes de crear otra reserva»; conservar el intento.

En HTTP 429, Retry-After puede expresar segundos o una fecha HTTP; validar su
formato y no interpretar un plazo negativo o inválido como permiso inmediato.
Sin plazo válido, proponer espera y acción explícita, sin inventar un contador
exacto. El backend debe definir si el rechazo ocurrió antes de cualquier escritura
y cómo recuperar operaciones ya existentes sin provocar más límites o duplicados.
La indicación de conexión del navegador es orientativa, no prueba entrega ni fallo.

Un reintento tras resultado incierto reutiliza la misma clave de idempotencia y
el mismo contenido. Cambiar los datos no puede convertir silenciosamente ese
reintento en una reserva nueva: antes debe resolverse el intento anterior.
Los límites de espera son de interfaz; no garantizan que el servidor haya abortado.
La resolución del intento y su retención requieren soporte backend; no implementarlas
únicamente con un booleano JavaScript.

## Recuperación segura por escenario

### R1. Se pierde conexión antes de recibir respuesta

Si el transporte ya fue invocado, o no se sabe si lo fue, usar resultado incierto.
No mostrar «la reserva falló». Conservar la misma clave y el mismo contenido;
reintentar solo por acción explícita y con el contexto original válido. AbortController,
timeout o cerrar una conexión no prueban que PostgreSQL haya revertido. Usar
conexion_previa únicamente cuando el envío nunca se intentó de forma demostrable.

### R2. La reserva se creó, pero la respuesta no llegó

La interfaz no puede distinguir este caso de R1 por sí sola. El backend debe
devolver la misma reserva al recuperar el intento: no insertar otra ni repetir
efectos externos. Al recibir evidencia válida, pasar a creada y presentar el enlace
autorizado. Hasta entonces, no liberar una nueva creación con otra clave.

### R3. Varias pulsaciones del botón

Bloqueo sincrónico antes de cualquier espera: ignorar clic/Enter adicionales
mientras haya una operación en vuelo. La clave se mantiene para ese intento;
deshabilitar controles no reemplaza la idempotencia del servidor entre pestañas,
reenvíos HTTP o respuestas perdidas. No reproducir anuncios por cada pulsación.

### R4. Cambia la sesión o el contexto invitado del navegador

No trasladar la clave a otra sesión ni crear un intento sustituto. Mostrar «No
podemos verificar esta solicitud desde el contexto actual. No crees otra reserva
todavía». Deshabilitar creación y recuperación no autorizada; enfocar el aviso
cuando el cambio se confirme, anunciándolo una vez. Los datos siguen solo en la
memoria de la vista original si existe; no persistirlos, fusionarlos ni exponerlos
en otro contexto. Si se cierra la pestaña, no prometer que podrán recuperarse.

Una respuesta antigua no debe revelar el enlace al nuevo contexto. La detección y
recuperación autorizada requieren soporte backend; no inferirlo leyendo una cookie
HttpOnly. Ofrecer consulta si ya se posee el enlace válido; en otro caso la vía de
recuperación con comprobación de autorización queda por acordar con Natalia.

### R5. Vence la clave de idempotencia

No generar una nueva clave automáticamente, tampoco al recargar o tras un 5xx.
Mostrar «Ya no podemos verificar este intento con esta clave. No crees otra reserva
hasta conocer su resultado». Mantener el resultado como no resuelto; deshabilitar
creación y recuperación con clave vencida, conservar aviso y enfocar su encabezado
tras la respuesta explícita. La retención y la recuperación autorizada son acuerdos
backend pendientes: el silencio o un registro expirado no prueban ausencia de reserva.

Solo se puede comenzar otro intento al resolver el anterior con evidencia del
servidor o como reserva adicional intencional después de una confirmación conocida.
No presentar el reemplazo de una clave vencida como recuperación segura.

### R6. El servidor devuelve una reserva existente para la misma clave

Tratarla como éxito recuperado, con el mismo mensaje de creada, si coinciden el
contexto autorizado, el contenido y el contrato esperado. No mostrar «correo ya
registrado», IDs internos ni diferencias de perfil. No crear otra reserva, no
iniciar pagos ni enviar notificaciones desde el navegador. Si el servidor indica
un estado actualizado distinto de pendiente de abono, presentarlo fielmente con
texto acordado; no anunciar pendiente de abono por el mero hecho de ser un replay.

Validar el enlace antes de habilitarlo. Si hubo revocación o rotación, no recuperar
el token nuevo mediante una clave antigua ni reutilizar enlaces revocados; exigir
el mecanismo autorizado que defina el backend. Una respuesta incompatible vuelve
a recuperación prudente, no a un segundo POST con otra clave.

## Enlace privado y privacidad

- Construir una ruta relativa fija `/consulta/#` con un token validado del formato
  acordado; no confiar en una URL arbitraria recibida del servidor.
- No mostrar IDs de clientas ni datos adicionales de la respuesta. Renderizar los
  textos mediante textContent, no innerHTML.
- Mostrar el enlace solo tras una respuesta exitosa válida y conservarlo durante
  la vista de confirmación. No navegar a pagos ni copiarlo automáticamente.
- No incluir tokens/contactos en logs, analítica, query string o mensajes de error.
- No añadir almacenamiento persistente de contacto, claves o enlaces en esta fase.
  La recuperación tras recargar/cerrar pestaña sigue pendiente de diseño backend.
- Si se abre en otra pestaña, usar las protecciones de referencia correspondientes.
- Una respuesta antigua no debe sustituir el negocio visible ni perder una reserva
  efectivamente creada: bloquear cambios durante el intento y resolver su estado.

## Dependencias y coordinación

Natalia debe acordar: operación atómica contacto-reserva, identidad no verificada,
rechazo de IDs impuestos, cierre/restricción de rutas antiguas, idempotencia y su
recuperación segura, límites antiabuso, códigos HTTP/negocio y rotación del enlace.
La interfaz no corrige por sí sola las vulnerabilidades actuales.

No cambiar Webpay, retornos, notificaciones, Oneclick, esquema ni registros
históricos desde esta preparación. La adaptación de agenda/contactos/correos y sus
joins pertenece al trabajo compartido posterior. La confirmación de creación no
demuestra identidad ni pago. No desplegar cliente nuevo contra contrato antiguo.

## Pruebas y uso

```text
node --test preparacion/reserva-invitada/reserva-invitada.test.cjs
node --test backend/test/front.test.js backend/test/consulta.test.js backend/test/agenda.test.js
```

Las pruebas ejecutables de esta carpeta inspeccionan archivos actuales y la
estructura y consistencia de esta especificación,
sin HTTP, PostgreSQL, proveedores ni escrituras. Los casos `todo` son criterios de
aceptación futuros, NO pruebas aprobadas del flujo seguro. Sustituirlos por pruebas
de comportamiento con transporte simulado cuando se autorice un controlador
aislado y exista contrato aprobado; más tarde validar con PostgreSQL temporal.

Resultado de esta preparación: 10 comprobaciones de estructura/documentación aprobadas, 0 fallos
y 16 criterios futuros TODO (no ejecutados). Regresión actual de Front Office,
consulta privada y agenda: 63 pruebas aprobadas, 0 fallos y 0 omitidas. No se
ejecutaron pruebas financieras ni se conectó a PostgreSQL o proveedores externos.

Estas comprobaciones no ejecutan un controlador del flujo futuro ni validan su
accesibilidad práctica, la recuperación real o su seguridad de servidor.
Siguiente trabajo independiente sugerido: revisar esta matriz mediante escenarios
de escritorio en papel y preparar ejemplos ficticios de respuestas para acordarlos
con Natalia, manteniéndolos desconectados de producción. No habilitar transporte
ni persistencia hasta aprobar contrato, identidad y recuperación.
