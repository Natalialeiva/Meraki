const {test} = require('node:test');
const assert = require('node:assert/strict');
const modulo = import('../../frontend/front-office/geografia.mjs');

test('Coordenadas acepta decimales PostgreSQL, negativos y ceros explícitos', async () => {
    const {validarCoordenadas} = await modulo;
    assert.deepEqual(validarCoordenadas(' -33.4489000 ', '-70.6693000'), {latitud:-33.4489,longitud:-70.6693});
    assert.deepEqual(validarCoordenadas('0.0000000', 0), {latitud:0,longitud:0});
    assert.deepEqual(validarCoordenadas(-90, -180), {latitud:-90,longitud:-180});
    assert.deepEqual(validarCoordenadas(90, 180), {latitud:90,longitud:180});
});

test('Coordenadas rechaza ausencias, pares incompletos y conversiones implícitas', async () => {
    const {validarCoordenadas, distanciaKm} = await modulo;
    for (const invalido of [null, undefined, '', '   ', 'texto', 'NaN', 'Infinity', NaN, Infinity, -Infinity, false, true, [], {}, '0x10', '1,5']) {
        assert.equal(validarCoordenadas(invalido, 0), null);
        assert.equal(validarCoordenadas(0, invalido), null);
        for (let posicion = 0; posicion < 4; posicion++) {
            const datos = [0, 0, 0, 0]; datos[posicion] = invalido;
            assert.equal(distanciaKm(...datos), null);
        }
    }
    assert.equal(validarCoordenadas(), null);
    assert.equal(validarCoordenadas(0), null);
    assert.equal(distanciaKm(null, null, 0, 0), null);
});

test('Coordenadas rechaza rangos inválidos en ambos extremos del cálculo', async () => {
    const {validarCoordenadas, distanciaKm} = await modulo;
    for (const [lat, lon] of [[90.0001,0],[-90.0001,0],[0,180.0001],[0,-180.0001]]) {
        assert.equal(validarCoordenadas(lat,lon), null);
        assert.equal(distanciaKm(lat,lon,0,0), null);
        assert.equal(distanciaKm(0,0,lat,lon), null);
    }
});

test('Haversine devuelve cero para coordenadas idénticas, incluido el origen', async () => {
    const {distanciaKm} = await modulo;
    assert.equal(distanciaKm(0,0,0,0), 0);
    assert.equal(distanciaKm(-33.4489,-70.6693,'-33.4489000','-70.6693000'), 0);
});

test('Haversine calcula distancias conocidas con tolerancia razonable', async () => {
    const {distanciaKm} = await modulo;
    // Referencias aproximadas de gran círculo, no rutas de transporte.
    assert(Math.abs(distanciaKm(0,0,0,1) - 111.195) < 0.01);
    assert(Math.abs(distanciaKm(51.5074,-0.1278,40.7128,-74.006) - 5570.2) < 1);
    assert(Math.abs(distanciaKm(-33.4489,-70.6693,-34.6037,-58.3816) - 1139) < 2);
});

test('Haversine conserva precisión para distancias pequeñas y textos decimales', async () => {
    const {distanciaKm} = await modulo;
    const pequena = distanciaKm('0','0','0','0.0000001');
    assert(pequena > 0);
    assert(Math.abs(pequena - 0.000011119508) < 1e-10);
});

test('Haversine es simétrica, consistente y finita en antípodas y cambio de fecha', async () => {
    const {distanciaKm, RADIO_TERRESTRE_KM} = await modulo;
    const d = distanciaKm(-33,-70,40,20);
    assert(Math.abs(d - distanciaKm(40,20,-33,-70)) < 1e-9);
    for (let i=0; i<100; i++) assert.equal(distanciaKm(-33,-70,40,20), d);
    assert.equal(distanciaKm(0,0,0,180), Math.PI * RADIO_TERRESTRE_KM);
    assert(distanciaKm(0,179.999,0,-179.999) < 0.223);
    assert(distanciaKm(90,0,90,180) < 1e-9);
});
