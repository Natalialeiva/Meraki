# Incorporación de emprendedoras — Backend y Back Office

## Flujo entregado

En `/back-office/`, abrir «¿Aún no tienes cuenta? Regístrate», completar los datos y confirmar la contraseña. Se reutiliza POST `/api/auth/registro`: conserva su respuesta 201 sin iniciar sesión automáticamente. Luego se utiliza el login existente. Una sesión sin emprendimiento muestra el formulario inicial del negocio; al guardarlo se carga el panel habitual con acceso al perfil, servicios, equipo, horarios, agenda y suscripción.

El nuevo POST `/api/emprendimientos` era necesario porque no existía una ruta de creación. GET `/api/mis-emprendimientos` y PATCH `/api/emprendimientos/:id` se reutilizan. No se crearon rutas de autenticación alternativas. Los formularios no permiten elegir propietaria ni identificadores.

## PostgreSQL y permisos

No fue necesaria una migración nueva: emprendimiento ya tiene FK a emprendedora y UNIQUE sobre id_emprendedora. El MVP permite un negocio por cuenta. La base resuelve incluso dos solicitudes concurrentes con un alta y un conflicto 409. El nombre comercial no es globalmente único: negocios de distintas dueñas pueden tener nombres iguales.

Creación toma siempre la propietaria desde la sesión. El perfil conserva su filtro de propiedad; no se permite leer listas privadas ni editar negocios ajenos. Los campos protegidos en el alta se rechazan. Nombre y comuna son obligatorios para el nuevo negocio; descripción, dirección y teléfono son opcionales. Coordenadas manuales opcionales en pareja, dentro de rango; no se agregó geocodificación ni se modificaron mapas.

El registro normaliza correo y RUT, comprueba duplicados normalizados bajo un candado transaccional y conserva las restricciones UNIQUE. La contraseña continúa protegida con bcrypt; no se devuelve el hash. RUT valida formato y normaliza puntos/mayúsculas; la verificación completa del dígito verificador sigue pendiente. Tampoco se agregó verificación de posesión de correo.

## Suscripción

Cuenta y suscripción gratuita se crean en una sola transacción. Se reutiliza PLAN: $9.990 CLP mensual y un mes gratuito, contado desde el registro de la cuenta con fecha de Santiago. La renovación automática queda false, sin tarjeta ni consentimiento de cargo. Si falla la suscripción, se revierte la cuenta completa. Crear el negocio no regala otra prueba ni modifica planes históricos. Las capacidades existentes permiten administrar servicios durante la vigencia y restringen configuración cuando vence.

## Cambios de este bloque

- Backend: `incorporacion.js` y su montaje en `index.js`; creación del negocio, normalizador compartido con el perfil y registro transaccional con mes gratuito.
- Back Office: `incorporacion.js`, formularios en `index.html` y coordinación de sesión/alta en `back.js`.
- Pruebas: `incorporacion.test.js`, casos añadidos en `integracion.test.js` y declaración de la dependencia en `mvp-lectura.test.js`.
- Se actualizaron únicamente los fixtures de montaje de `mvp-postgres-aislado.test.js` y `reservas-activas-ui.test.js` para reconocer el módulo nuevo. Esas pruebas ejecutan back.js con módulos simulados: sin esa declaración fallaban por dependencia ausente. No se modificaron sus cálculos/aserciones de Dashboard ni módulos de Adriana.
- Este informe y `PRUEBAS-INCORPORACION-2026-11-16.txt`.

Se conservaron los cambios anteriores del bloque de abonos CLP. No atribuirlos de nuevo a este trabajo.

## Verificación

`npm.cmd run test:aislado`: 541 entradas aprobadas, cero fallidas y cero omitidas. Las primeras pruebas detectaron fixtures sin el nuevo módulo; se corrigieron y la regresión final pasó completa. El registro distingue entradas y grupos, no transacciones reales.

Se comprobó registro válido/inválido, login correcto/incorrecto, sesión/logout, datos protegidos, correo/RUT duplicados, creación de negocio, duplicidad concurrente, listas propias, edición de perfil con coordenadas, denegación de acceso cruzado, primer servicio y reversión por fallo del mes gratuito. Pruebas de interfaz comprueban contraseñas coincidentes, uso de rutas existentes, bloqueo de doble envío y manejo de errores/recarga posterior.

Sintaxis Node y git diff --check correctos. Se ejecutó sobre PostgreSQL aislado y proveedores simulados; la base temporal propia se eliminó. No hubo cuentas ni cambios de esquema/datos en meraki_db, contactos con proveedores, renovaciones, commit ni push.

## Límites y siguiente paso

Los cambios están en archivos y requieren reinicio controlado del backend para cargarse. No se creó una cuenta real ni se hizo un ensayo visual nuevo sobre la base principal. La validación de esta entrega es automatizada, incluyendo el flujo HTTP original y los formularios en memoria.

Próximo bloque recomendado: ensayo visual de incorporación con datos ficticios en un destino aislado autorizado. La revisión de RUT completo, prueba de correo y decisiones de producción se mantienen separadas. No se avanza a ellas automáticamente.
