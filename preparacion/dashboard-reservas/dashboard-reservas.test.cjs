// Pruebas de estructura documental: NO ejecutan un componente de dashboard.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '../..');
const documento = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
const filas = documento.split(/\r?\n/).filter(l => l.startsWith('| '));
const estado = id => filas.find(l => l.startsWith('| ' + id + ' |'));

test('Diseño: seis indicadores documentados sin cambiar sus cálculos', () => {
    for (const nombre of ['Reservas en agenda','Para hoy','Confirmadas','Pendientes de abono','Reservas por cerrar','Próxima atención']) {
        assert(filas.some(l => l.startsWith('| ' + nombre + ' |')), nombre);
    }
    assert.match(documento, /puede_cerrar === true/);
    assert.match(documento, /fechas pasadas o futuras/);
    assert.match(documento, /no montos, cobros recibidos/);
});
test('Diseño: ocho estados tienen seis dimensiones de presentación completas', () => {
    const ids = ['cargando','agenda_vacia','filtros_sin_coincidencias','error_carga',
        'sesion_vencida','actualizada','error_actualizacion','cambio_emprendimiento'];
    for (const id of ids) {
        const fila = estado(id);
        assert(fila, id);
        const columnas = fila.split('|').slice(1,-1).map(s => s.trim());
        assert.equal(columnas.length, 7, id);
        assert(columnas.every(Boolean), id);
    }
});
test('Diseño: vacío válido se distingue de error y de filtros sin coincidencias', () => {
    assert.match(estado('agenda_vacia'), /respuesta válida \[\]/);
    assert.match(estado('error_carga'), /No mostrar lista ni ceros/);
    assert.match(estado('filtros_sin_coincidencias'), /agenda completa en memoria/);
    assert.match(documento, /JSON ilegible.*error, no \[\]/);
});
test('Diseño: cambios rápidos invalidan mensajes, foco y marcas de respuestas antiguas', () => {
    assert.match(estado('cambio_emprendimiento'), /Limpiar inmediatamente/);
    assert.match(documento, /A → B → A/);
    assert.match(documento, /también\s+debe coincidir la versión/);
    assert.match(documento, /respuesta vieja no cambia lista, indicadores, mensajes, foco ni última carga/);
    assert.match(estado('sesion_vencida'), /metadatos privados/);
});
test('Diseño: última carga solo tras éxito válido y fallo no sustituye su marca', () => {
    assert.match(documento, /HTTP exitoso, respuesta estructuralmente válida/);
    assert.match(estado('error_actualizacion'), /Conservar valor previo sin alterarlo/);
    assert.match(estado('filtros_sin_coincidencias'), /filtrar localmente no es una carga nueva/);
    assert.match(documento, /NO fecha de modificación/);
    assert.match(documento, /timeZone:\s+America\/Santiago/);
});
test('Diseño: estados accesibles y métricas independientes de filtros sin tráfico adicional', () => {
    assert.match(estado('cargando'), /role=status.*aria-live polite/);
    assert.match(documento, /Evitar duplicar sus anuncios/);
    assert.match(documento, /agenda completa autorizada, antes de filtrar/);
    assert.match(documento, /solicitudes HTTP adicionales solo por cambiar filtros/);
});
test('Aislamiento: recursos actuales no referencian esta preparación', () => {
    for (const archivo of ['back.js','index.html','gestion.css','agenda.js','resumen.js']) {
        const texto = fs.readFileSync(path.join(raiz,'frontend/back-office',archivo), 'utf8');
        assert(!texto.includes('preparacion/dashboard-reservas'), archivo);
        assert(!texto.includes('dashboard-reservas.test.cjs'), archivo);
    }
});

for (const caso of [
    'carga válida vacía muestra cero; carga fallida muestra indisponibilidad',
    'filtros sin coincidencias conservan contadores y marca de agenda completa',
    'A → B → A descarta éxitos y errores antiguos aunque coincida el ID',
    '401 antiguo no invalida sesión nueva; 401 vigente limpia datos privados',
    'recarga fallida conserva marca previa con advertencia sin mostrar agenda antigua',
    'última actualización cambia solo al aceptar respuesta válida del contexto actual',
    'marca se formatea en Santiago independientemente de zona del equipo y cambio de año',
    'cambio de negocio oculta inmediatamente datos y marca anteriores',
    'Temporal ausente o revisión temporal no impiden confirmar carga válida de agenda',
    'teclado y lector de pantalla conservan foco y no duplican anuncios',
    'indicadores mantienen cálculo actual y no generan solicitudes por filtrar',
    'actualizar agenda no inicia pagos, Oneclick ni notificaciones'
]) test.todo('Componente NO integrado: ' + caso);
