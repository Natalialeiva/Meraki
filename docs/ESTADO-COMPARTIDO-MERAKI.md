# Estado compartido de Meraki

Actualizado el 9 de noviembre de 2026. Repositorio `Natalialeiva/Meraki`, rama compartida `main`. El último commit de `origin/main` verificado con fetch es `3c5e75fd5e3669200a7cdcdc2c6c280e15ca743a`.

Meraki principal funciona en `localhost:3000`. El backend Express en `backend/` sirve el Front Office, el Back Office y la consulta privada de reservas, con PostgreSQL local. Cada computador mantiene su propia base. La demo ejecutable de `localhost:3001` se retiró en `0a662d8`. Su documentación se conserva como evidencia histórica.

| Área | Estado | Siguiente paso |
| --- | --- | --- |
| Front Office A1–A3.4.4 | Publicado. Incluye búsqueda por nombre y comuna, catálogo, selección de servicio y profesional, disponibilidad, resumen de reserva, cercanía opcional, mapa simulado y mejoras de accesibilidad. | Completar la validación funcional en el sistema principal. |
| «Cómo llegar» | A3.4.4 incorpora el enlace y lo mantiene deshabilitado cuando falta confirmación de la ubicación. | Acordar cómo confirmar y actualizar ubicaciones reales desde el Back Office. |
| Filtro público por categoría | Pendiente. El catálogo muestra categorías de servicios y la búsqueda actual filtra por nombre y comuna. | Definir el filtro y probarlo junto con búsqueda y cercanía. |
| Dashboard A4.1 | Módulo y pruebas publicados en `d9fd750`. Integración visual pendiente. | Integrar A4.1a «Reservas por cerrar» en Reservas. Para A4.1b, resolver el costo del cálculo de la próxima atención en `America/Santiago` antes de integrarlo. |
| Webpay 009 | Publicada y aplicada en el PC actual de Natalia. El inicio de abonos registra el intento antes de llamar al proveedor. | Confirmar el esquema en cada otro computador antes de usar el código. |
| Webpay 010 | Implementada localmente. Pendientes la publicación y la aplicación en la base principal de Natalia. La prueba aislada anterior registró 276 aprobadas, 0 fallidas y 0 omitidas. | Revisar y publicar código y migración juntos. Aplicar la migración por separado, con el backend detenido y respaldo verificado. |
| Oneclick Mall | Adriana reportó una inscripción exitosa en sandbox. La validación integral de mensualidades automáticas sigue pendiente. | Diseñar una prueba aislada y acordar cualquier operación externa antes de ejecutarla. |
| Correos | Existe registro de notificaciones y cobertura con transporte simulado. La prueba completa de entrega queda pendiente. | Validar el recorrido con transporte simulado y acordar una casilla controlada si se requiere entrega real. |
| Presentación académica | Pendientes el cierre de pruebas funcionales, la revisión de seguridad y la consolidación de evidencias. | Relacionar pruebas y resultados con los requisitos académicos, y separar resultados simulados de verificaciones en sandbox. |

En el PC actual de Natalia se comprobó el 9 de noviembre que el backend estaba detenido y que `MERAKI_SUSCRIPCIONES_AUTOMATICAS=0` seguía configurado. La consulta de solo lectura a `meraki_traslado_20261104` confirmó la 009 y la ausencia de la 010. El código local de la 010 requiere su migración antes de iniciarse contra esa base.

Para coordinar cambios entre Natalia y Adriana, revisar Git y el esquema efectivo al cambiar de computador. Compartir el commit, la verificación y los pendientes. El [control de migraciones](CONTROL-MIGRACIONES-MERAKI.md) registra lo comprobado en cada entorno.
