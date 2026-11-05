# Continuidad A3.3 — distancias y cercanía

Implementado sin cambios en backend, API, PostgreSQL, demo ni dependencias nuevas.
Se reutilizan geografia.mjs y ubicacion.mjs. El catálogo conserva los resultados
originales de la API en memoria. Calcula distancias al dibujar; no persiste resultados.
Con ubicación válida aparece el selector de orden. El orden habitual sigue siendo
el predeterminado; cercanía ordena distancias numéricas ascendentes, luego los
negocios sin coordenadas válidas. Los empates conservan el orden de respuesta.
Al retirar o actualizar ubicación se eliminan las distancias anteriores. Las
respuestas de búsquedas antiguas conservan la protección de versiones existente.
Filtros manuales y reserva no cambian. No se envían coordenadas de la clienta.

Pruebas focalizadas de A1/A2/A3.1/A3.2/A3.3 y demo: 50 aprobadas, cero fallos,
omisiones o cancelaciones. No se ejecutó la batería PostgreSQL. Sintaxis y diff
comprobados. Capturas de escritorio, tablet y móvil con respuestas y ubicación
ficticias inyectadas únicamente en el navegador; no se alteró meraki_demo.
Sin solicitud de ubicación real, reservas, pagos ni correos. Sin commit ni push.

Limitación: los negocios locales carecen de coordenadas completas; se muestra
«Distancia no disponible» cuando se autoriza ubicación. No se inventan distancias.
Las distancias son aproximadas en línea recta y dependen de precisión del dispositivo.
Se mantiene la limitación A2 del subtítulo pequeño del banner en teléfonos.

A3.4/A3.5: alcance pendiente de definición y autorización con ChatGPT/Natalia;
coordinar obtención y mantenimiento de coordenadas de negocios antes de demostrar
cercanía con datos reales. No se han iniciado mapas, dashboard ni cambios de datos.


## Cierre técnico autorizado

Verificador actualizado para escenarios base (un negocio original, sin exigir
coordenadas) y cercanía (tres nombres y coordenadas exactas), rechazando escenarios
incompletos o duplicados. Servicios reservables, profesionales, nueve horas por
negocio, suscripciones sin tarjeta/Oneclick/renovación y permisos siguen comprobados.
No se crea ni elimina una base para probar el escenario base: se prueba el validador
con datos simulados. El escenario ampliado se verifica contra la demo real.

- Focalizadas: 54 aprobadas, 0 fallidas, omitidas o canceladas.
- Regresión principal completa: 171 aprobadas, 0 fallidas, omitidas o canceladas,
  incluidas integraciones en esquemas temporales y proveedores simulados.
- Demo: 8 pruebas (4 de protección y 4 del verificador), incluidas en las focalizadas.
  Total único entre batería principal y demo: 179; no sumar las 54 focalizadas otra vez.
- Dos ejecuciones consecutivas del preparador: ninguna inserción ni duplicados.
  Todas las tablas de ambas bases coincidieron antes/después, incluyendo reservas,
  abonos y sesiones durante esta ejecución. Principal: 7 reservas, 6 abonos, 2 clientas.
- Verificador real antes y después: tres negocios, tres profesionales, 27 opciones
  horarias para el día siguiente, 14 rutas bloqueadas y cero intentos externos.
- Diferencia histórica de sesion_meraki respecto al respaldo inicial de la demo:
  ya existente; las sesiones pueden cambiar con el Back Office normal. Los datos
  históricos del negocio coinciden y ninguna tabla cambió durante este cierre.
- Chrome con ubicación simulada: tres negocios y orden Meraki, Lavanda, Marfil.

Natalia: preparar configuración privada local siguiendo demo/README.md; si ya existe
la demo, no repetir setup. Ejecutar node demo/preparar-cercania.cjs; luego iniciar
node demo/server.cjs y ejecutar node demo/verify.cjs en otra terminal. El preparador
se puede repetir y no renueva suscripciones vencidas. Instrucciones de datos en
demo/CERCANIA.md. No copiar credenciales ni bases de Adriana. La suscripción ficticia
vence naturalmente y requiere revisión si ya no está vigente.

No se modificó backend compartido, Back Office, pagos, reglas de suscripción,
migraciones ni .env. Sin commit/push. A3.4 y A3.5 no iniciados.
