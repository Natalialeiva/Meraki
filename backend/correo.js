const nodemailer = require('nodemailer');

function enlacePrivado(token, env = process.env) {
    const base = new URL(env.PUBLIC_BASE_URL || 'http://localhost:3000');
    if (base.username || base.password || !['http:', 'https:'].includes(base.protocol) ||
        (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname))) {
        throw new Error('PUBLIC_BASE_URL debe usar HTTPS (HTTP solo en localhost)');
    }
    return new URL('/consulta/#' + encodeURIComponent(token), base).href;
}

function crearTransporteGmail({ env = process.env, mailer = nodemailer } = {}) {
    const requeridas = ['GMAIL_USER', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
    const faltantes = requeridas.filter(nombre => !env[nombre]?.trim());
    if (faltantes.length) {
        const error = new Error('Falta configurar Gmail OAuth: ' + faltantes.join(', '));
        error.code = 'ECONFIG';
        throw error;
    }
    return mailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: env.GMAIL_USER.trim(),
            clientId: env.GOOGLE_CLIENT_ID.trim(),
            clientSecret: env.GOOGLE_CLIENT_SECRET.trim(),
            refreshToken: env.GOOGLE_REFRESH_TOKEN.trim()
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000
    });
}

async function verificarConexionGmail(opciones = {}) {
    const transporte = crearTransporteGmail(opciones);
    try {
        await transporte.verify();
        return { conectado: true, proveedor: 'gmail', autenticacion: 'OAuth2' };
    } finally {
        transporte.close();
    }
}

async function enviarConfirmacionReserva(datos, { env = process.env, mailer = nodemailer } = {}) {
    const proveedor = env.MAIL_PROVIDER || 'ethereal';
    let transporte;
    let from = '"Meraki - Reservas" <reservas@meraki.test>';
    let enlace = 'https://example.com/consulta/ENLACE-DE-PRUEBA';
    if (proveedor === 'gmail') {
        if (!env.PUBLIC_BASE_URL) throw new Error('Falta configurar PUBLIC_BASE_URL');
        const url = new URL(datos.enlaceConsulta);
        if (url.origin !== new URL(enlacePrivado('validacion', env)).origin ||
            !((url.pathname === '/consulta/' && url.hash) || /^\/api\/reservas\/consulta\/[0-9a-f-]{36}$/i.test(url.pathname)) || url.username || url.password) {
            throw new Error('Enlace privado inválido');
        }
        transporte = crearTransporteGmail({ env, mailer });
        from = { name: 'Meraki - Reservas', address: env.GMAIL_USER.trim() };
        enlace = datos.enlaceConsulta;
    } else if (proveedor === 'ethereal') {
        const cuenta = await mailer.createTestAccount();
        transporte = mailer.createTransport({
            host: cuenta.smtp.host, port: cuenta.smtp.port, secure: cuenta.smtp.secure,
            auth: { user: cuenta.user, pass: cuenta.pass },
            connectionTimeout: 15000, socketTimeout: 30000
        });
    } else {
        throw new Error('MAIL_PROVIDER debe ser gmail o ethereal');
    }
    try {
        const resultado = await transporte.sendMail({
            from, to: datos.correo, subject: 'Meraki - Tu reserva está confirmada',
            text: `Hola ${datos.nombreClienta}:\n\nTu reserva ha sido confirmada.\nEmprendimiento: ${datos.emprendimiento}\nServicio: ${datos.servicio}\nFecha: ${datos.fecha}\nHora: ${datos.hora}\n\nConsulta tu reserva en este enlace privado:\n${enlace}\n\nGuárdalo y no lo compartas.`
        });
        if (!resultado.accepted?.length || resultado.rejected?.length) {
            const error = new Error('Destinatario no aceptado');
            error.code = 'EENVELOPE';
            throw error;
        }
        return {
            idMensaje: resultado.messageId,
            vistaPrevia: proveedor === 'ethereal' ? mailer.getTestMessageUrl(resultado) : null
        };
    } finally {
        transporte.close();
    }
}

module.exports = { enviarConfirmacionReserva, enlacePrivado, crearTransporteGmail, verificarConexionGmail };
