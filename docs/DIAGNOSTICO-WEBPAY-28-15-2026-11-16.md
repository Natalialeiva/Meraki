# Diagnóstico local de reserva 28 y abono 15

## Conclusión

La transacción se creó en Webpay Plus Integration con el monto esperado y llegó al formulario oficial. No hay aprobación registrada. El fallo se manifestó en la pantalla de Transbank; los registros conservados no permiten atribuir su causa exacta a expiración, autenticación bancaria, navegador o incidencia del ambiente Integration.

Se encontró y corrigió un problema independiente del regreso al comercio: la consulta se abrió con `127.0.0.1:3000`, pero la URL de retorno configurada usaba `localhost:3000`. Esos orígenes tienen distinto sessionStorage. El resultado podía leerse, pero perderse el enlace de regreso a la reserva guardado en la pestaña. Esa diferencia NO demuestra la causa del error previo mostrado por Transbank.

## Evidencias conservadas y límites

| Comprobación | Evidencia / resultado |
| --- | --- |
| Base y conexión | `meraki_db` local; revisión SQL READ ONLY. |
| Reserva 28 | `pendiente_abono`. |
| Abono 15 | `pendiente`, monto 5000, fase `pendiente_respuesta_pago`. |
| Creación | Campo civil sin zona: 2026-11-16 03:35:15.638100. No interpretarlo como instante UTC sin más información. |
| Token persistido | Fase guardada a las 03:35:16.045309 UTC; longitud 64. No se extrajo ni reutilizó el token en este diagnóstico. |
| Identificadores | Orden de 26 caracteres y sesión de 43; no se publican sus valores. |
| Procesamiento local | Sin tipo/proceso de confirmación, sin reclamación durable de commit. Esto demuestra ausencia de procesamiento durable, no ausencia absoluta de cualquier petición HTTP. |
| Notificaciones | Cero para esta reserva; correcto mientras no exista pago aprobado. |
| Pantalla conservada | Error de operación no completada y aviso de que no hubo cargo. No aporta identificador de causa. |
| Consultas externas anteriores | Evidencia histórica: INITIALIZED, primero sin código y después -2; monto/orden/sesión coincidieron. No se repitieron en este diagnóstico. |
| Registros HTTP | No hay HAR ni access log correlacionado conservado para reconstruir el fallo o demostrar si se intentó un retorno inválido/rechazado antes del procesamiento. |

La creación usa un `timestamp without time zone`; el instante de fase usa `timestamptz`. Una serialización Node anterior mostró una diferencia aparente de tres horas. Se consultaron componentes civiles e instante UTC por separado; no se usó esa diferencia como prueba de expiración ni se alteraron columnas o datos.

## Configuración y rutas examinadas

- `backend/index.js`: instancia `WebpayPlus.Transaction` con `IntegrationCommerceCodes.WEBPAY_PLUS`, `IntegrationApiKeys.WEBPAY` y `Environment.Integration`. No utiliza Webpay Mall para este flujo. Se comprobó el ambiente sin imprimir claves ni códigos.
- `WEBPAY_RETURN_URL`: URL local de `/api/abonos/retorno`. El flujo clienta la transforma en `/api/abonos/retorno/navegador`. El inicio privado de Back Office conserva su ruta JSON existente.
- `backend/inicio-webpay.js`: registra el intento antes de la llamada, valida monto, conserva orden y sesión, exige respuesta HTTPS/token válido y bloquea un segundo intento si existe un abono pendiente o aprobado. No se modificó esa lógica.
- `frontend/consulta/consulta.js`: envía el token a Webpay mediante POST, guarda una correlación y enlace de consulta en sessionStorage de su origen. No se imprime el token ni se incorpora al informe.
- `backend/index.js`: parsers JSON y URL-encoded anteriores a las rutas. La sesión de emprendedora no es requisito del retorno público.
- `backend/procesamiento-webpay.js`: ambas rutas de retorno admiten GET y POST. Token normal válido entra a procesamiento durable; abandono/timeouts con TBK_* no se convierten en aprobación. Parámetros incoherentes se rechazan. La ruta visual genera una referencia opaca y redirige con 303; la heredada conserva JSON.
- `backend/resultado-webpay.js`: referencia autenticada/cifrada, vencimiento y correlación con el abono. Lectura sin sesión de emprendedora y cabeceras no-store/no-referrer.
- Recuperación: consulta con sesión/propiedad, identidad/monto y control durable. Solo un resultado autorizado válido confirma la reserva y registra la notificación. INITIALIZED, aun con -2, no se trata como rechazo final ni habilita otro intento. No se ejecutó recuperación.

Los navegadores pueden regresar mediante navegación a una URL loopback de la misma máquina. El callback no necesita que el servidor de Transbank acceda directamente a PostgreSQL ni a localhost. Esto solo sirve para una demostración en el mismo computador; no es una URL pública de despliegue.

## Corrección mínima implementada

`urlRetornoVisual` admite ahora el origen observado de la solicitud. Únicamente cuando configuración y visita son loopback, tienen el mismo protocolo y puerto y el origen no incluye credenciales/ruta/query/fragmento, conserva el alias de la visita. No refleja dominios externos ni modifica retornos públicos. El endpoint de inicio de clienta pasa ese origen; no admite un returnUrl arbitrario del cuerpo.

Archivos de esta corrección:

- `backend/resultado-webpay.js`
- `backend/index.js`
- `backend/test/resultado-webpay.test.js`
- `backend/test/integracion.test.js`
- Este informe y `PRUEBAS-DIAGNOSTICO-WEBPAY-2026-11-16.txt`.

Los demás cambios locales anteriores se conservaron. No hubo commit ni push ni cambios en `.env`.

## Verificación

- Prueba específica del resultado: cinco casos aprobados.
- Regresión aislada completa: 482 entradas aprobadas, cero fallidas y cero omitidas. Incluye grupos de subpruebas; no equivale a 482 pagos reales.
- Nuevos casos: equivalencia de alias local con rechazo de Host externo/puerto diferente; retorno GET y POST de formulario sin cookie; INITIALIZED/-2 sin escritura al consultar ni habilitación de otro intento.
- SDK Webpay y correo simulados; PostgreSQL en una base efímera nueva, eliminada al terminar. No se ejecutaron migraciones en bases conservadas.
- Navegador: catálogo original abrió tanto en `http://localhost:3000/front-office/` como en `http://127.0.0.1:3000/front-office/`, sin abrir enlaces de pagos ni reutilizar tokens.
- Las huellas SQL antes/después coincidieron: reserva 28 y abono 15 íntegramente sin cambios. El backend se reinició para cargar la corrección, con proveedores externos bloqueados y renovaciones desactivadas.

## Información pendiente para determinar la causa exacta

1. Momento preciso del error frente al momento de entrada al formulario y aprobación; no se guardó una traza de navegación de ese tramo.
2. Código técnico de Webpay/autenticador o detalle de red, si el proveedor lo dispone. La pantalla genérica y INITIALIZED/-2 no bastan.
3. Si hubo intento HTTP de retorno, método, host, ruta, resultado HTTP y presencia de nombres de parámetros, sin registrar sus valores privados.
4. En un futuro ensayo expresamente autorizado, completar el recorrido de forma continua, antes de la ventana de cinco minutos descrita por Transbank, y registrar únicamente metadatos sanitizados. No capturar tarjetas, cookies, claves, tokens ni correos en un HAR publicable.

Referencia del plazo: https://transbankdevelopers.com/documentacion/webpay-plus . El plazo documentado es una hipótesis compatible, no una causa probada en este caso.

No crear otro pago para resolver por fuerza este registro. No marcarlo manualmente como rechazado o aprobado y no debilitar la prevención de duplicados. Una nueva consulta u operación externa necesita autorización independiente de este diagnóstico.
