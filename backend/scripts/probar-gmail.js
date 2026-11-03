const path = require('path');
require('dotenv').config({path: process.env.MERAKI_ENV_FILE || path.join(__dirname, '../.env'), quiet: true});
const {crearTransporteGmail, verificarConexionGmail} = require('../correo');

async function main() {
    if (!process.argv.includes('--enviar')) {
        console.log(JSON.stringify(await verificarConexionGmail()));
        return;
    }
    const destino = process.env.MAIL_TEST_TO?.trim();
    if (!destino || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(destino)) {
        const error = new Error('Falta configurar MAIL_TEST_TO con el destinatario autorizado');
        error.code = 'ECONFIG';
        throw error;
    }
    const transporte = crearTransporteGmail();
    try {
        const resultado = await transporte.sendMail({
            from: {name:'Meraki - Pruebas', address:process.env.GMAIL_USER.trim()},
            to: destino,
            subject: 'Meraki - Prueba de conexión Gmail OAuth2',
            text: 'Este es un correo de prueba de Meraki enviado mediante Gmail OAuth2. No confirma una reserva ni un pago. No contiene enlaces privados.'
        });
        if (!resultado.accepted?.length || resultado.rejected?.length) throw Object.assign(new Error(), {code:'EENVELOPE'});
        console.log(JSON.stringify({aceptado:true, idMensaje:resultado.messageId, nota:'Verificar recepción en la bandeja de entrada o spam'}));
    } finally {
        transporte.close();
    }
}
main().catch(error => {
    const diagnostico = [error.message, typeof error.response === 'string' ? error.response : error.response?.error].filter(Boolean).join(' ');
    const motivo = diagnostico.match(/invalid_grant|invalid_client|unauthorized_client|access_denied|invalid_scope|invalid_request/i)?.[0] || null;
    console.error(JSON.stringify({conectado:false,codigo:error.code || 'ERROR',motivo,respuestaSMTP:Number.isInteger(error.responseCode)?error.responseCode:null,
        detalle:error.code === 'ECONFIG' ? error.message : 'No se completó la conexión o envío. Revisar autorización OAuth, red y vigencia del token.'}));
    process.exitCode = 1;
});

