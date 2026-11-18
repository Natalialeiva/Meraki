const {test}=require('node:test'),assert=require('node:assert/strict');
test('Coordenadas demo aparecen en el Front Office local sin parámetros; no mutan registros',async()=>{
 const {aplicarDemoMapa}=await import('../../frontend/front-office/mapa-demo.mjs');
 const origen=[{id_emprendimiento:1,nombre:'Belleza Camila',latitud:null,longitud:null},{id_emprendimiento:2,nombre:'Belleza Daniela'},{id_emprendimiento:3,nombre:'Luna Estudio',latitud:-33.4,longitud:-70.6}];
 for(const url of ['https://meraki.example/','https://meraki.example/?mapa_demo=1'])assert.equal(aplicarDemoMapa(origen,url),origen);
 const demo=aplicarDemoMapa(origen,'http://localhost/front-office/');assert.equal(demo[0].comuna,'Maipú');assert.equal(demo[1].comuna,'Las Condes');assert.equal(demo[2],origen[2]);assert.equal(origen[0].latitud,null);assert.match(demo[0].nombre,/demostración/);assert.equal(demo[0].id_emprendimiento,1);
 const real={...origen[0],latitud:-34,longitud:-71};assert.equal(aplicarDemoMapa([real],'http://localhost/front-office/')[0],real);
});
