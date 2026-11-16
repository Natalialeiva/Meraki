# Privacidad de la evidencia histórica de correo

Se revisó `recuperacion-gmail-real.json` sin imprimir sus valores sensibles. Contiene un identificador de mensaje con formato de dirección/dominio, URL local y marcas temporales operativas. No se detectaron contraseñas, claves OAuth o tokens de acceso en ese registro. Un identificador de mensaje no es una credencial de Gmail, pero no es necesario publicarlo para acreditar académicamente el resultado.

La versión de entrega es `recuperacion-gmail-academica.json`: conserva el carácter simulado de Webpay, la existencia del registro de correo, estados e intentos. Omite identificadores, dominios, enlaces y marcas temporales exactas. No acredita una nueva entrega real.

El original no se editó, eliminó ni trasladó. Su SHA-256 al revisar fue:

`4e9bb9c86cc82bf179448187542cd7ceab45d2627133129b47425eeb1eb39582`

## Dependencias que impiden sustituirlo sin revisión

- `backend/scripts/probar-recuperacion-gmail.js`: escribe el resultado y su identificador de mensaje en el original; además imprime el resultado y puede enviar correo real si se ejecuta con autorización explícita. Es una herramienta histórica, no el ejecutor seguro de esta entrega.
- `backend/scripts/cerrar-prueba-recuperacion.js`: lee ese identificador para localizar el esquema temporal correspondiente, puede eliminar ese esquema y actualiza la evidencia. No ejecutarlo como limpieza general ni con el resumen anonimizado.

Estos scripts no se ejecutaron ni se modificaron en esta revisión. Tampoco se debe reemplazar su archivo de entrada por la versión académica: faltan deliberadamente los identificadores operativos.

## Pendiente antes de una entrega pública

La copia anonimizada NO retira el original de Git ni de commits anteriores. Para retirarlo del árbol publicado se necesita autorizar un respaldo privado verificable y adaptar primero las herramientas para leer/escribir una ruta privada explícita. La eliminación del historial exige otra decisión coordinada con Adriana; no se realizó ni se propone hacerla automáticamente.

No subir a Git los respaldos, originales descifrados, herramientas V3, claves ni `.env`. Revisar el alcance de acceso al repositorio antes de compartirlo públicamente. Esta nota documenta el riesgo pendiente, no certifica que el historial completo esté anonimizado.
