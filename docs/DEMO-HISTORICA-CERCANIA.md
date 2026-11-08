# Demo de cercanía con tres negocios

> Registro histórico. El puerto 3001 fue un entorno temporal de desarrollo. Los comandos y rutas de demo citados aquí se conservan como evidencia y ya no forman parte del proyecto. La plataforma vigente se ejecuta en localhost:3000.

Desde la raíz del repositorio, con dependencias backend instaladas:

1. Si no existe el entorno demo, ejecutar `node demo/setup.cjs` según demo/README.md.
   No ejecutar setup sobre una base existente; no se restaura ni reemplaza.
2. Ejecutar `node demo/preparar-cercania.cjs` de forma local, fuera del servidor HTTP.
3. Iniciar `node demo/server.cjs` y abrir http://localhost:3001/front-office/.

La configuración privada demo/.env.demo se genera localmente, nunca se comparte.
El procedimiento usa credenciales administrativas locales de backend/.env, sin
modificar ese archivo. La conexión de escritura fija meraki_demo y confirma
current_database() antes de cualquier escritura; meraki_db se abre con transacciones
predeterminadas de solo lectura para comparar todas sus tablas antes y después.
No cambia permisos del lector. Opera en una transacción y se detiene ante negocios
inesperados, duplicados o suscripción original no vigente. Puede repetirse sin
crear duplicados. Los negocios nuevos se identifican por nombre y cuentas demo
exclusivas. No restablece automáticamente suscripciones vencidas.

Datos geográficos sintéticos, aproximados dentro de comunas reales; no representan
locales existentes ni direcciones visitables:

- Estudio Meraki — DEMO, Santiago: -33.4489, -70.6693. Negocio existente conservado;
  se agregaron coordenadas y dirección ficticia DEMO Centro 100 (no visitar).
- Estudio Lavanda — DEMO FICTICIA, Providencia: -33.425, -70.615.
  Dirección ficticia DEMO Lavanda 200 (no visitar).
- Estudio Marfil — DEMO FICTICIA, Maipú: -33.511, -70.757.
  Dirección ficticia DEMO Marfil 300 (no visitar).

Cada negocio nuevo tiene una cuenta sin contraseña utilizable, un servicio ficticio
($20.000, 60 minutos, abono $5.000), una profesional ficticia, asignación y siete
horarios semanales 09:00–18:00. Se reutiliza Bienestar demo. Suscripciones de prueba
por un mes calendario, sin renovación automática, tarjetas ni identificadores
Oneclick. Se conserva la suscripción original sin cambios.

Verificaciones realizadas: dos ejecuciones (segunda sin inserciones), tres negocios
reales de la base demo por HTTP, tres servicios reservables y tres profesionales.
HTTP POST/PUT/PATCH/DELETE rechazados con 405. 50 pruebas focalizadas aprobadas,
cero fallos u omisiones. Catálogo en Chrome escritorio/tablet/móvil usando datos
reales de meraki_demo y solo posición de clienta simulada (-33.4489,-70.6693): orden
Meraki, Lavanda, Marfil. No se alteró ubicación real ni se enviaron reservas.
meraki_db conservó todas sus huellas, 7 reservas, 6 abonos y 2 clientas.
Proveedores externos sin intentos, renovaciones apagadas y usuario lector sin
privilegios INSERT/UPDATE/DELETE. No se cambió .env ni backend compartido.

El verificador demo/verify.cjs admite tanto la demo base de un negocio como la
demo ampliada con los tres negocios exactos; valida servicios, profesionales,
horarios, suscripciones sin tarjeta, permisos y conservación de datos.
Las capturas de esta preparación se guardan fuera del repositorio. Para Natalia,
repetir el procedimiento local con su propia configuración, sin copiar datos ni
credenciales de Adriana. Sin commit ni push automáticos.

## Publicación por GitHub

La base PostgreSQL meraki_demo no se transfiere por GitHub. Se comparten únicamente
los scripts y la documentación para crearla y preparar sus datos ficticios en cada
computador. No publicar .env, .env.demo, auditorías privadas, respaldos ni credenciales.
Natalia debe utilizar sus propias conexiones y ejecutar los pasos locales descritos
arriba. Publicar el código no crea ni actualiza automáticamente ninguna base.
