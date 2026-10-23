// Primer mensaje de prueba del Backend de Meraki
const express = require("express");
// Creamos la aplicación que utilizará Express.
const app = express();
// Ruta principal para comprobar el funcionamiento del Backend.
app.get("/", (req, res) => {
    res.send("Bienvenida al Backend de Meraki");
});
// Iniciamos el servidor en el puerto 3000.
app.listen(3000, () => {
    console.log("Servidor de Meraki funcionando en http://localhost:3000");
});
console.log("Iniciando Backend de Meraki");