
/**
 * MERAKI - Configuración de correos electrónicos.
 *
 * Utilizamos Ethereal para probar el envío de mensajes.
 * Los correos de prueba no llegan a destinatarios reales.
 */

const nodemailer = require("nodemailer");

// Crear una cuenta temporal para las pruebas.
async function crearTransportePrueba() {
    const cuenta = await nodemailer.createTestAccount();

    const transporte = nodemailer.createTransport({
        host: cuenta.smtp.host,
        port: cuenta.smtp.port,
        secure: cuenta.smtp.secure,
        auth: {
            user: cuenta.user,
            pass: cuenta.pass
        }
    });

    return transporte;
}

// Exportar la función para utilizarla desde otros archivos.
module.exports = {
    crearTransportePrueba,
    enviarConfirmacionReserva
};



/**
 * Envía el correo de confirmación de una reserva.
 *
 * Se utilizará cuando el abono esté aprobado.
 * Por ahora, los mensajes se envían a Ethereal.
 */
async function enviarConfirmacionReserva(datos) {
    const {
        correo,
        nombreClienta,
        emprendimiento,
        servicio,
        fecha,
        hora,
        enlaceConsulta
    } = datos;

    // Crear una conexión de prueba con Ethereal.
    const transporte = await crearTransportePrueba();
    // En Ethereal utilizamos un enlace ficticio para proteger
// el token privado real de la reserva.
const enlaceSeguroPrueba =
    "http://localhost:3000/api/reservas/consulta/ENLACE-DE-PRUEBA";

    // Preparar el mensaje.
    const mensaje = {
        from: '"Meraki - Reservas" <reservas@meraki.test>',
        to: correo,
        subject: "Meraki - Tu reserva está confirmada",
        text: `
Hola ${nombreClienta}:

Tu reserva ha sido confirmada correctamente.

Emprendimiento: ${emprendimiento}
Servicio: ${servicio}
Fecha: ${fecha}
Hora: ${hora}

Puedes consultar tu reserva utilizando este enlace privado:
${enlaceSeguroPrueba}

Guarda este enlace y no lo compartas.

Gracias por utilizar Meraki.
        `.trim()
    };

    // Enviar el mensaje al servicio de prueba.
    const resultado = await transporte.sendMail(mensaje);

    // Obtener la dirección donde se puede visualizar el correo.
    const vistaPrevia = nodemailer.getTestMessageUrl(resultado);

    console.log("MERAKI: correo de confirmación enviado a Ethereal");
    console.log("MERAKI: vista previa:", vistaPrevia);

    return {
        idMensaje: resultado.messageId,
        vistaPrevia
    };
}
