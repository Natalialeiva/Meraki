const {test}=require('node:test'),assert=require('node:assert/strict');
const {validarEscenario}=require('./verificar-escenario.cjs');
const base={id_emprendimiento:1,nombre:'Estudio Meraki — DEMO',comuna:'Santiago',latitud:-33.4489,longitud:-70.6693};
const tres=[base,{id_emprendimiento:2,nombre:'Estudio Lavanda — DEMO FICTICIA',comuna:'Providencia',latitud:'-33.4250000',longitud:'-70.6150000'},{id_emprendimiento:3,nombre:'Estudio Marfil — DEMO FICTICIA',comuna:'Maipú',latitud:-33.511,longitud:-70.757}];
test('Verificador admite demo base original sin exigir coordenadas',()=>assert.equal(validarEscenario([{...base,latitud:null,longitud:null}]),'base'));
test('Verificador admite tres negocios exactos con coordenadas PostgreSQL',()=>assert.equal(validarEscenario(tres),'cercania'));
test('Verificador rechaza demo incompleta, inesperada o duplicada',()=>{
    for(const datos of [[],tres.slice(0,2),[tres[1]],[base,base,tres[2]],[base,{...tres[1],nombre:'Otro'},tres[2]]])assert.throws(()=>validarEscenario(datos));
});
test('Verificador rechaza coordenadas faltantes o distintas en escenario ampliado',()=>{
    for(const valor of [null,undefined,'',NaN,91,0])assert.throws(()=>validarEscenario([base,{...tres[1],latitud:valor},tres[2]]));
});
