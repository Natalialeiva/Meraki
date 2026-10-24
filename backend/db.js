// Cargamos las variables privadas del archivo .env.
require("dotenv").config();

// Importamos la herramienta para conectarnos a PostgreSQL.
const { Pool } = require("pg");

// Configuramos la conexión utilizando los datos del archivo .env.
const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

// Exportamos la conexión para utilizarla en otros archivos del Backend.
module.exports = pool;