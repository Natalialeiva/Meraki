// Preparación exclusivamente de lectura. No importa ni ejecuta el servidor.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(raiz, 'frontend/front-office/index.html'), 'utf8');
const js = fs.readFileSync(path.join(raiz, 'frontend/front-office/front.js'), 'utf8');
const formulario = html.match(/<form id="formReserva">[\s\S]*?<\/form>/)?.[0];
const documento = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');

test('Base actual: nombre y correo obligatorios, teléfono opcional y límites explícitos', () => {
    for (const [nombre, limite, obligatorio] of [['nombre',100,true],['correo',150,true],['telefono',20,false]]) {
        const etiqueta = formulario?.match(new RegExp('<input[^>]*name="' + nombre + '"[^>]*>'))?.[0];
        assert(etiqueta, nombre);
        assert.match(etiqueta, new RegExp('maxlength="' + limite + '"'));
        assert.equal(/\brequired\b/.test(etiqueta), obligatorio);
    }
});
test('Base actual: ayudas de campo y tipos de contacto accesibles', () => {
    assert.match(html, /name="correo"[^>]*type="email"/);
    assert.match(html, /name="telefono"[^>]*type="tel"/);
    for (const id of ['errorNombre','errorCorreo','errorTelefono']) {
        assert(html.includes('aria-describedby="' + id + '"'));
        assert(html.includes('id="' + id + '"'));
    }
});
test('Base actual: enlace de consulta comienza oculto y usa ruta relativa con fragmento', () => {
    assert.match(html, /<a\s+id="consulta"\s+hidden>/);
    assert(js.includes("'/consulta/#' + encodeURIComponent(d.reserva.token_consulta)"));
});
test('Base actual: bloqueo local de doble envío y errores diferidos siguen presentes', () => {
    assert(js.includes('if (enviando || creada) return;'));
    assert(js.includes('enviando = true;'));
    assert(js.includes('camposInteractuados.has(campo)'));
});
test('Base actual: formulario no pide identificador de clienta ni anuncia identidad verificada', () => {
    assert.doesNotMatch(html, /name=["']id_clienta["']/);
    assert.doesNotMatch(html, /correo verificado|identidad confirmada/i);
});
test('Preparación no está referenciada por los recursos de producción', () => {
    for (const archivo of ['index.html','front.js','styles.css']) {
        const texto = fs.readFileSync(path.join(raiz,'frontend/front-office',archivo),'utf8');
        assert(!texto.includes('preparacion/reserva-invitada'));
        assert(!texto.includes('reserva-invitada.test.cjs'));
    }
});

// Solo consistencia del diseño escrito: no ejecuta el comportamiento futuro.
test('Documento: nueve estados con mensaje, acciones, botón, datos y accesibilidad', () => {
    const estados = ['inicial','validacion','enviando','creada','horario_ocupado',
        'limitado_429','conexion_previa','resultado_incierto','error_temporal'];
    const filas = documento.split(/\r?\n/).filter(linea => /^\| [a-z_0-9]+ \|/.test(linea));
    assert.equal(filas.length, estados.length);
    for (const estado of estados) {
        const fila = filas.find(linea => linea.startsWith('| ' + estado + ' |'));
        assert(fila, estado);
        const columnas = fila.split('|').slice(1,-1).map(s => s.trim());
        assert.equal(columnas.length, 6, estado);
        assert(columnas.every(Boolean), estado);
    }
});
test('Documento: seis escenarios de recuperación diferenciados', () => {
    const escenarios = [...documento.matchAll(/^### R([1-6])\. (.+)$/gm)];
    assert.deepEqual(escenarios.map(m => m[1]), ['1','2','3','4','5','6']);
    for (let i = 0; i < escenarios.length; i++) {
        const inicio = escenarios[i].index + escenarios[i][0].length;
        const fin = escenarios[i+1]?.index ?? documento.indexOf('\n## Enlace privado', inicio);
        assert(documento.slice(inicio, fin).trim().length > 150);
    }
});
test('Documento: incertidumbre no autoriza reemplazar clave o trasladarla de sesión', () => {
    const r1 = documento.split('### R1.')[1].split('### R2.')[0];
    const r4 = documento.split('### R4.')[1].split('### R5.')[0];
    const r5 = documento.split('### R5.')[1].split('### R6.')[0];
    assert.match(r1, /misma clave y el mismo contenido/);
    assert.match(r1, /No mostrar «la reserva falló»/);
    assert.match(r4, /No trasladar la clave a otra sesión/);
    assert.match(r5, /No generar una nueva clave automáticamente/);
    assert.match(r5, /no prueban ausencia de reserva/);
});
test('Documento: replay respeta estado real, revocación y ausencia de efectos automáticos', () => {
    const replay = documento.split('### R6.')[1].split('## Enlace privado')[0];
    assert.match(replay, /estado actualizado distinto de pendiente de abono/);
    assert.match(replay, /no recuperar\s+el token nuevo mediante una clave antigua/);
    assert.match(replay, /no\s+iniciar pagos ni enviar notificaciones/);
    assert.match(documento, /no ejecutan un controlador del flujo futuro/);
});

// Sin endpoint ni controlador nuevo: no fingir pruebas funcionales aprobadas.
for (const criterio of [
    'nombre vacío o demasiado largo impide envío y devuelve foco al campo',
    'correo vacío o inválido impide envío; teléfono vacío se admite',
    'payload invitada no contiene id_clienta ni otros campos internos',
    'correo nuevo y existente producen la misma experiencia sin consultar identidad',
    'doble clic y Enter durante carga emiten una sola operación',
    'horario ocupado identificado invalida solo la hora y conserva contacto',
    'HTTP 409 no reconocido no se presenta automáticamente como horario ocupado',
    'HTTP 429 respeta Retry-After y no provoca reintentos automáticos',
    'error de conexión conserva clave y contenido y no asegura ausencia de reserva',
    'reintento explícito reutiliza clave y datos; edición exige resolver intento incierto',
    'confirmación muestra pendiente de abono sin iniciar pagos ni correos',
    'token inválido o URL externa no habilitan enlace ni navegación',
    'respuesta incompleta y respuesta antigua no provocan otra creación ni pierden el resultado',
    'enlace privado no aparece en logs, almacenamiento persistente ni query string',
    'errores no renderizan HTML del servidor ni datos internos',
    'teclado y región accesible anuncian estados una sola vez'
]) test.todo('Contrato futuro NO implementado: ' + criterio);
