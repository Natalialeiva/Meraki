const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const raiz = path.resolve(__dirname, '..');
const backendRequire = createRequire(path.join(raiz, 'backend', 'package.json'));
const archivo = path.join(__dirname, '.env.demo');
function leerConfig() {
    const config = backendRequire('dotenv').parse(fs.readFileSync(archivo));
    if (config.DB_NAME !== 'meraki_demo' || config.DB_USER !== 'meraki_demo_lector' || config.PORT !== '3001' || config.MERAKI_SUSCRIPCIONES_AUTOMATICAS !== '0') {
        throw Error('Configuración demo inválida. No se permite apuntar a otra base, usuario o puerto.');
    }
    return config;
}
module.exports = {raiz, backendRequire, archivo, leerConfig};
