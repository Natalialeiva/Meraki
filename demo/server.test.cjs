const {test}=require('node:test');
const assert=require('node:assert/strict');
const {permitida}=require('./server.cjs');
test('Demo permite solo las consultas públicas necesarias',()=>{
    for(const ruta of ['/front-office/','/front-office/front.js','/api/estado-db','/api/emprendimientos','/api/emprendimientos/1/servicios','/api/servicios/1/trabajadoras','/api/categorias','/api/disponibilidad'])assert(permitida('GET',ruta),ruta);
});
test('Demo rechaza toda escritura, aunque la ruta sea de consulta',()=>{
    for(const metodo of ['POST','PUT','PATCH','DELETE','OPTIONS','HEAD']){
        for(const ruta of ['/api/emprendimientos','/api/reservas','/api/clientas','/api/servicios','/api/trabajadoras','/api/horarios','/api/bloqueos','/api/abonos/cliente/iniciar','/api/suscripcion/inscribir','/api/suscripcion/reintentar','/api/notificaciones/1/reintentar'])assert.equal(permitida(metodo,ruta),false);
    }
});
test('Demo bloquea también retornos GET y rutas no incluidas explícitamente',()=>{
    for(const ruta of ['/api/abonos/retorno','/api/abonos/1/estado','/api/suscripcion/retorno','/api/auth/yo','/back-office/','/consulta/','/api/reservas/consulta/token','/api/emprendimientos/1/servicios/otra','/front-office/../back-office/'])assert.equal(permitida('GET',ruta),false,ruta);
});
