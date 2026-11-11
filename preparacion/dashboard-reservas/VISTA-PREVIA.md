# Vista previa local del resumen de Reservas

Abrir `vista-previa.html` desde el explorador de archivos con Chrome o Edge.
No necesita servidor, autenticación ni conexión al backend. Los únicos recursos
son HTML, CSS y JavaScript relativos de esta carpeta. No contiene fetch, llamadas
API, bibliotecas externas, fuentes remotas ni recursos del Back Office real.
La CSP prohíbe conexiones, formularios y recursos externos. No relajar estas
protecciones si una política corporativa impide abrir archivos locales.

## Cómo revisarla

1. La vista inicial es Actualización exitosa con dos registros ficticios.
2. Elegir cada uno de los ocho botones de estado. Los mensajes proceden de
   `presentacion.js`, sin reimplementar sus reglas.
3. En Agenda sin reservas debe verse cero; en errores o carga, un guion.
4. En Filtros sin coincidencias el total debe seguir en dos y los visibles en cero.
5. En Actualización fallida debe conservarse la marca 18/11/2026, 15:04:12, hora de
   Santiago, acompañada de advertencia; las tarjetas anteriores quedan ocultas.
6. Cambiar de Negocio ficticio A a B: desaparecen marca y datos de A de inmediato.
   Elegir Actualización exitosa para ver solo el escenario ficticio de B.
7. Sesión vencida muestra acceso simulado, sin formulario de credenciales.
8. Actualizar, reintentar y limpiar filtros solo seleccionan otro escenario local;
   no son acciones del sistema real ni prueban una recuperación HTTP.

Usar Tab, Shift+Tab y Enter: selector y botones tienen nombres y foco visible.
La región de estado está fuera del área marcada aria-busy para no retener el
anuncio de carga. No hay navegación ni enfoque automático al abrir la página.
La expiración simulada y el cambio de negocio aplican las pautas declarativas del
módulo; ninguna acción ejecuta pagos, notificaciones ni autenticación.

## Validación automatizada

```text
node --test preparacion/dashboard-reservas/*.test.cjs
```

Las pruebas cubren los ocho escenarios, render con DOM simulado, acciones locales,
cero frente a error, filtros, negocio, marca fallida, CSP, etiquetas, ausencia de
red/almacenamiento/temporizadores y contraste de pares de colores seleccionados.
El cálculo de contraste es estático: no demuestra todos los estilos computados,
zoom, foco real ni compatibilidad con lectores de pantalla.
Los 12 TODO de integración permanecen pendientes: esta vista NO está conectada.

## Revisión visual pendiente

El navegador integrado rechazó file:// por política de seguridad. No se abrió un
servidor ni se buscó eludir ese bloqueo. No hay capturas ni validación visual real
de esta etapa. Revisar manualmente en navegador instalado:

| Ancho | Revisión pendiente |
| --- | --- |
| 360 px | Controles, mensajes largos, foco, ausencia de desbordamiento horizontal. |
| 768 px | Composición en dos columnas de selectores y tarjetas; espacio de lectura. |
| 1440 px | Espaciado, jerarquía, contraste percibido y recorrido de los ocho estados. |

Comprobar además consola sin errores y lectura de anuncios con tecnología de
asistencia. La marca usa un instante ficticio fijo; no es una actualización del
servidor ni una modificación de PostgreSQL.
