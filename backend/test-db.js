// Importamos la conexión configurada en db.js.
const pool = require("./db");

// Función para comprobar la conexión con PostgreSQL.
async function probarConexion() {
    try {
        // Consultamos el nombre de la base de datos conectada.
       // Consultamos las tablas del esquema public de Meraki.
const resultado = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
`);

        // Mostramos el resultado en la terminal.
        // Mostramos los nombres de las tablas encontradas.
console.log("Tablas encontradas en Meraki:");

resultado.rows.forEach((tabla) => {
    console.log("-", tabla.table_name);
});

console.log("Total de tablas:", resultado.rowCount);
    } catch (error) {
        // Mostramos el error si la conexión falla.
        console.error("Error al conectar con PostgreSQL:", error.message);
    } finally {
        // Cerramos las conexiones para finalizar la prueba.
        await pool.end();
    }
}

// Ejecutamos la función de prueba.
probarConexion();