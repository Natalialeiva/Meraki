const assert=require('node:assert/strict');
function validarEscenario(negocios) {
    const nombres=['Estudio Meraki — DEMO','Estudio Lavanda — DEMO FICTICIA','Estudio Marfil — DEMO FICTICIA'];
    assert([1,3].includes(negocios.length),'Solo se admiten demo base o cercanía completa.');
    assert.equal(new Set(negocios.map(n=>n.nombre)).size,negocios.length,'Nombres duplicados.');
    assert.equal(new Set(negocios.map(n=>n.id_emprendimiento)).size,negocios.length,'IDs duplicados.');
    assert(negocios.some(n=>n.nombre===nombres[0]),'Falta negocio original.');
    assert(negocios.every(n=>nombres.includes(n.nombre)),'Negocio inesperado.');
    if(negocios.length===3)for(const n of negocios){
        const datos={
            [nombres[0]]:['Santiago',-33.4489,-70.6693],
            [nombres[1]]:['Providencia',-33.425,-70.615],
            [nombres[2]]:['Maipú',-33.511,-70.757]
        }[n.nombre];
        assert.equal(n.comuna,datos[0]);assert.notEqual(n.latitud,null);assert.notEqual(n.longitud,null);
        assert.equal(Number(n.latitud),datos[1]);assert.equal(Number(n.longitud),datos[2]);
    }
    return negocios.length===1?'base':'cercania';
}
module.exports={validarEscenario};
