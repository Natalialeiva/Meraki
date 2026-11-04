const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../../frontend/front-office/index.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '../../frontend/front-office/front.js'), 'utf8');
class Elemento {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.hidden = false; this.disabled = false; this.dataset = {}; this.attributes = {}; this.textContent = ''; }
    set value(v) { this._value = String(v); }
    get value() { return this._value ?? (this.tag === 'select' ? this.children.find(c => !c.disabled)?.value || '' : ''); }
    get selectedOptions() { return this.children.filter(c => c.value === this.value); }
    append(...hijos) {
        for(const hijo of hijos){
            if(hijo.parentElement)hijo.parentElement.children=hijo.parentElement.children.filter(c=>c!==hijo);
            hijo.parentElement=this;this.children.push(hijo);
        }
    }
    replaceChildren() { for(const hijo of this.children)hijo.parentElement=null; this.children = []; if (this.tag === 'select') this._value = undefined; }
    setAttribute(k, v) { this.attributes[k] = v; }
    focus() { this.focused = true; }
    requestSubmit() { return this.onsubmit({preventDefault() {}, target:this}); }
    reset() { for (const c of this.campos || []) c.value = ''; }
}
const pausa = () => new Promise(setImmediate);
const diferida = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
const textos = el => [el.textContent, ...el.children.map(textos)].join(' ');
const servicio = (id, reservable = true) => ({id_servicio:id, servicio:'Servicio ' + id, precio:20000, monto_abono:5000, duracion_min:60, categoria:'Belleza', descripcion:'Descripción real', reservable});
function iniciar(config = {}) {
    const elementos = {};
    for (const match of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"/g)) elementos['#' + match[2]] = new Elemento(match[1]);
    for (const el of ['servicio','profesional','hora']) elementos['#' + el].tag = 'select';
    const nombre = new Elemento('input'), correo = new Elemento('input'), telefono = new Elemento('input');
    for (const [clave,campo] of Object.entries({nombre,correo,telefono})) { campo.name = clave; elementos['#formReserva input[name="' + clave + '"]'] = campo; }
    elementos['#formReserva'].campos = [nombre,correo,telefono,elementos['#fecha'],elementos['#servicio'],elementos['#profesional'],elementos['#hora']];
    const filtroNombre = new Elemento('input'), comuna = new Elemento('input'); filtroNombre.name = 'nombre'; comuna.name = 'comuna';
    elementos['#buscar'].campos = [filtroNombre,comuna];
    const peticiones = []; let reservasCreadas = 0;
    const contexto = vm.createContext({Intl,Date,URLSearchParams,console,
        document:{querySelector:s => { assert(elementos[s], 'Selector existente: ' + s); return elementos[s]; }, createElement:tag => new Elemento(tag)},
        FormData:class { constructor(form) { this.form = form; } *[Symbol.iterator]() { for (const c of this.form.campos || []) if (c.name) yield [c.name,c.value]; } },
        fetch:async (url, opciones) => {
            peticiones.push({url, method:opciones.method, body:opciones.body ? JSON.parse(opciones.body) : undefined});
            let datos;
            if (url.startsWith('/api/emprendimientos?')) datos = config.buscar ? await config.buscar(url) : [{id_emprendimiento:1,nombre:'Belleza Camila',comuna:'Santiago'}];
            else if (/^\/api\/emprendimientos\/\d+\/servicios$/.test(url)) datos = config.servicios || [servicio(1,false),servicio(2)];
            else if (url.startsWith('/api/servicios/')) datos = config.profesionales ? await config.profesionales(url) : [{id_trabajadora:3,nombre:'Camila'},{id_trabajadora:8,nombre:'Profesional dos'}];
            else if (url.startsWith('/api/disponibilidad?')) datos = config.disponibilidad ? await config.disponibilidad(url) : [{hora_inicio:'11:00:00'},{hora_inicio:'12:00:00'}];
            else if (url === '/api/clientas') datos = {id_clienta:11};
            else if (url === '/api/reservas') {
                if (config.reservar) await config.reservar();
                reservasCreadas++; datos = {reserva:{id_reserva:21,token_consulta:'11111111-1111-4111-8111-111111111111'}};
            } else throw Error('Ruta inesperada: ' + url);
            return {ok:true,status:200,text:async () => JSON.stringify(datos)};
        }
    });
    vm.runInContext(script, contexto);
    const p = {elementos,peticiones,nombre,correo,telefono,filtroNombre,comuna,creadas:() => reservasCreadas,
        async seleccionar() { await pausa(); return elementos['#resultados'].children[0].children[2].onclick(); },
        async preparar() {
            await p.seleccionar(); elementos['#profesional'].value = '3'; elementos['#profesional'].onchange();
            elementos['#fecha'].value = '2030-11-04'; elementos['#fecha'].onchange(); await elementos['#disponibilidad'].onclick();
            elementos['#hora'].value = '11:00:00'; elementos['#hora'].onchange();
            nombre.value = ' Clienta prueba '; correo.value = ' prueba@example.com '; nombre.oninput(); correo.oninput();
        }
    };
    return p;
}

test('Front Office usa mensajes neutrales para todos los servicios no reservables', async () => {
    const p = iniciar({servicios:[servicio(1,false)]}); await p.seleccionar();
    assert.match(textos(p.elementos['#listaServicios']), /Este servicio no está disponible para reservar por el momento/);
    assert.doesNotMatch(textos(p.elementos['#listaServicios']) + p.elementos['#estado'].textContent + p.elementos['#avisoServicio'].textContent, /suscrip|deuda|sin profesionales|no tiene profesionales/i);
    assert.equal(p.elementos['#crearReserva'].disabled,true);
    assert(!p.peticiones.some(r => r.url.startsWith('/api/servicios/')));
});
test('Tarjetas muestran datos reales y distinguen servicios reservables', async () => {
    const p = iniciar(); await p.seleccionar(); const tarjetas = p.elementos['#listaServicios'].children;
    assert.equal(tarjetas[0].children.at(-1).disabled,true); assert.equal(tarjetas[1].children.at(-1).disabled,false);
    for (const texto of ['Servicio 2','Belleza Camila','Santiago','Belleza','Descripción real','60 minutos','20.000','5.000','Disponible para reservar']) assert(textos(tarjetas[1]).includes(texto));
    assert.equal(p.elementos['#servicio'].value,'2'); assert.equal(p.elementos['#servicio'].children[1].disabled,true);
});
test('Profesional y hora requieren selección explícita, sin elegir la primera automáticamente', async () => {
    const p = iniciar(); await p.seleccionar(); assert.equal(p.elementos['#profesional'].value,'');
    assert.equal(p.elementos['#disponibilidad'].disabled,true); assert.match(p.elementos['#seleccionProfesional'].textContent,/Selecciona/);
    p.elementos['#profesional'].value='3'; p.elementos['#profesional'].onchange();
    assert.match(p.elementos['#seleccionProfesional'].textContent,/Camila/); assert.equal(p.elementos['#disponibilidad'].disabled,false);
    p.elementos['#fecha'].value='2030-11-04'; await p.elementos['#disponibilidad'].onclick(); assert.equal(p.elementos['#hora'].value,'');
});
test('Lista vacía de profesionales no inventa una causa interna', async () => {
    const p=iniciar({profesionales:async()=>[]}); await p.seleccionar();
    assert.equal(p.elementos['#avisoServicio'].textContent,'Este servicio no está disponible para reservar por el momento'); assert.equal(p.elementos['#disponibilidad'].disabled,true);
});
test('Ver todos borra ambos filtros', async () => {
    const p=iniciar(); await pausa(); p.filtroNombre.value='Otra'; p.comuna.value='Otra'; p.elementos['#limpiarBusqueda'].onclick(); await pausa();
    assert.equal(p.filtroNombre.value,''); assert.equal(p.comuna.value,''); assert.match(p.peticiones.at(-1).url,/nombre=&comuna=/);
});
test('Disponibilidad exige profesional y fecha y rechaza fechas pasadas', async () => {
    const p=iniciar(); await p.seleccionar(); await p.elementos['#disponibilidad'].onclick();
    p.elementos['#profesional'].value='3'; p.elementos['#profesional'].onchange(); await p.elementos['#disponibilidad'].onclick();
    assert.match(p.elementos['#errorFecha'].textContent,/Selecciona una fecha/);
    p.elementos['#fecha'].value='2000-01-01'; await p.elementos['#disponibilidad'].onclick();
    assert(!p.peticiones.some(r=>r.url.startsWith('/api/disponibilidad')));
});
test('Cambiar fecha o profesional invalida horas y actualiza el resumen', async () => {
    const p=iniciar(); await p.preparar(); assert.equal(p.elementos['#crearReserva'].disabled,false);
    p.elementos['#fecha'].value='2030-11-05'; p.elementos['#fecha'].onchange(); assert.equal(p.elementos['#hora'].value,''); assert.equal(p.elementos['#crearReserva'].disabled,true);
    await p.elementos['#disponibilidad'].onclick(); p.elementos['#hora'].value='11:00:00'; p.elementos['#hora'].onchange();
    p.elementos['#profesional'].value='8'; p.elementos['#profesional'].onchange(); assert.equal(p.elementos['#hora'].value,''); assert.match(textos(p.elementos['#resumen']),/Profesional dos/);
});
test('Respuesta antigua de profesionales no reemplaza la nueva selección', async () => {
    const antigua=diferida(); const p=iniciar({servicios:[servicio(1),servicio(2)],profesionales:async url=>url.includes('/1/')?antigua.promise:[{id_trabajadora:8,nombre:'Actual'}]});
    await pausa(); const pendiente=p.elementos['#resultados'].children[0].children[2].onclick(); await pausa();
    p.elementos['#servicio'].value='2'; await p.elementos['#servicio'].onchange(); antigua.resolve([{id_trabajadora:7,nombre:'Anterior'}]); await pendiente;
    assert.equal(p.elementos['#profesional'].children[1].textContent,'Actual'); assert.equal(p.elementos['#profesional'].value,'');
});
test('Cambiar servicio limpia profesional, hora y resumen anteriores', async () => {
    const p=iniciar({servicios:[servicio(2),servicio(3)]}); await p.preparar(); p.elementos['#servicio'].value='3'; await p.elementos['#servicio'].onchange();
    assert.equal(p.elementos['#profesional'].value,''); assert.equal(p.elementos['#hora'].value,''); assert.equal(p.elementos['#crearReserva'].disabled,true); assert.match(textos(p.elementos['#resumen']),/Servicio 3/);
});
test('Respuesta antigua de disponibilidad no sustituye horas de la fecha actual', async () => {
    const antigua=diferida(); const p=iniciar({disponibilidad:async url=>url.includes('2030-11-04')?antigua.promise:[{hora_inicio:'15:00:00'}]});
    await p.seleccionar(); p.elementos['#profesional'].value='3'; p.elementos['#profesional'].onchange(); p.elementos['#fecha'].value='2030-11-04';
    const pendiente=p.elementos['#disponibilidad'].onclick(); p.elementos['#fecha'].value='2030-11-05'; p.elementos['#fecha'].onchange(); await p.elementos['#disponibilidad'].onclick();
    antigua.resolve([{hora_inicio:'11:00:00'}]); await pendiente;
    assert.equal(p.elementos['#hora'].children[1].value,'15:00:00'); assert.equal(p.elementos['#hora'].children.length,2);
});
test('Errores antiguos de disponibilidad no reemplazan el estado actual', async () => {
    const antigua=diferida(); const p=iniciar({disponibilidad:async url=>url.includes('2030-11-04')?antigua.promise:[]});
    await p.seleccionar(); p.elementos['#profesional'].value='3'; p.elementos['#profesional'].onchange(); p.elementos['#fecha'].value='2030-11-04'; const pendiente=p.elementos['#disponibilidad'].onclick();
    p.elementos['#fecha'].value='2030-11-05'; p.elementos['#fecha'].onchange(); await p.elementos['#disponibilidad'].onclick(); antigua.reject(Error('Error antiguo')); await pendiente;
    assert.match(p.elementos['#estado'].textContent,/No hay horas/); assert.equal(p.elementos['#hora'].attributes['aria-busy'],'false');
});
test('Sin horas se explica cómo continuar y no se inventan opciones', async () => {
    const p=iniciar({disponibilidad:async()=>[]}); await p.preparar(); assert.equal(p.elementos['#hora'].children.length,1); assert.match(p.elementos['#ayudaHora'].textContent,/otra fecha o profesional/);
    await p.elementos['#formReserva'].requestSubmit(); assert.equal(p.creadas(),0);
});
test('Resumen incluye todos los datos y se actualiza al editar correo y hora', async () => {
    const p=iniciar(); await p.preparar(); let texto=textos(p.elementos['#resumen']);
    for(const valor of ['Belleza Camila','Servicio 2','Camila','4 de noviembre de 2030','11:00','Precio total','20.000','Abono requerido','5.000','prueba@example.com']) assert(texto.includes(valor));
    p.correo.value='otro@example.com'; p.correo.oninput(); p.elementos['#hora'].value='12:00:00'; p.elementos['#hora'].onchange(); texto=textos(p.elementos['#resumen']); assert(texto.includes('otro@example.com')); assert(texto.includes('12:00'));
});
test('Validación bloquea nombre vacío, correo inválido y teléfono demasiado largo', async () => {
    const p=iniciar(); await p.preparar();
    for(const [campo,valor,id] of [[p.nombre,'   ','#errorNombre'],[p.correo,'no-es-correo','#errorCorreo'],[p.telefono,'1'.repeat(21),'#errorTelefono']]) {
        const anterior=campo.value; campo.value=valor; campo.oninput(); assert.equal(p.elementos['#crearReserva'].disabled,true); assert(p.elementos[id].textContent);
        await p.elementos['#formReserva'].requestSubmit(); assert.equal(p.creadas(),0); campo.value=anterior; campo.oninput();
    }
    assert.equal(p.elementos['#crearReserva'].disabled,false);
});
test('Datos completos habilitan reserva sin casilla y evitan doble envío', async () => {
    const p=iniciar(); await p.preparar(); assert(!html.includes('confirmarDatos')); assert.equal(p.elementos['#crearReserva'].disabled,false);
    await Promise.all([p.elementos['#formReserva'].requestSubmit(),p.elementos['#formReserva'].requestSubmit()]); assert.equal(p.creadas(),1);
    const envio=p.peticiones.find(r=>r.url==='/api/reservas'); assert.deepEqual(envio.body,{id_servicio:2,id_trabajadora:3,fecha:'2030-11-04',hora:'11:00',id_clienta:11,nombre_clienta:'Clienta prueba'});
    assert.equal(p.elementos['#camposReserva'].disabled,true); assert.equal(p.elementos['#consulta'].hidden,false); assert.match(p.elementos['#consulta'].href,/^\/consulta\/#/); assert.match(p.elementos['#estado'].textContent,/pendiente de abono/); assert.equal(p.elementos['#estado'].dataset.tipo,'exito');
    await p.elementos['#formReserva'].requestSubmit(); assert.equal(p.creadas(),1); assert(!p.peticiones.some(r=>/abonos|suscripcion/.test(r.url)));
});
test('Fallo al reservar conserva datos, libera controles y permite reintentar', async () => {
    let falla=true; const p=iniciar({reservar:async()=>{if(falla)throw Error('El horario ya no está disponible');}}); await p.preparar(); await p.elementos['#formReserva'].requestSubmit();
    assert.equal(p.creadas(),0); assert.equal(p.elementos['#camposReserva'].disabled,false); assert.equal(p.elementos['#estado'].dataset.tipo,'error'); assert.equal(p.nombre.value,' Clienta prueba ');
    falla=false; await p.elementos['#formReserva'].requestSubmit(); assert.equal(p.creadas(),1);
});
test('Comenzar otra reserva limpia datos y vuelve a exigir profesional y hora', async () => {
    const p=iniciar(); await p.preparar(); await p.elementos['#formReserva'].requestSubmit(); await p.elementos['#nuevaReserva'].onclick();
    assert.equal(p.elementos['#consulta'].hidden,true); assert.equal(p.nombre.value,''); assert.equal(p.elementos['#profesional'].value,''); assert.equal(p.elementos['#hora'].value,''); assert.equal(p.elementos['#crearReserva'].disabled,true);
});
test('Elegir una tarjeta actualiza el servicio y conserva el foco de teclado', async () => {
    const p=iniciar({servicios:[servicio(2),servicio(3)]}); await p.seleccionar();
    await p.elementos['#listaServicios'].children[1].children.at(-1).onclick();
    assert.equal(p.elementos['#servicio'].value,'3'); assert.equal(p.elementos['#servicio'].focused,true);
    assert.equal(p.elementos['#listaServicios'].children[1].dataset.seleccionado,'true');
});
test('Una búsqueda antigua no reemplaza resultados nuevos ni sus errores', async () => {
    const antigua=diferida(); let veces=0;
    const p=iniciar({buscar:async()=>++veces===1?antigua.promise:[{id_emprendimiento:2,nombre:'Resultado actual'}]});
    await p.elementos['#buscar'].requestSubmit(); antigua.reject(Error('Fallo de búsqueda anterior')); await pausa();
    assert.match(textos(p.elementos['#resultados']),/Resultado actual/); assert.doesNotMatch(p.elementos['#estado'].textContent,/Fallo/);
});
test('Un error actual de profesionales se muestra y bloquea la disponibilidad', async () => {
    const p=iniciar({profesionales:async()=>{throw Error('No se pudieron consultar profesionales');}}); await p.seleccionar();
    assert.equal(p.elementos['#estado'].dataset.tipo,'error'); assert.match(p.elementos['#avisoServicio'].textContent,/No se pudieron consultar/);
    assert.equal(p.elementos['#disponibilidad'].disabled,true); assert.equal(p.elementos['#crearReserva'].disabled,true);
});
test('Identidad visual conserva los archivos oficiales byte por byte', () => {
    const {createHash}=require('node:crypto');
    const originales={
        'banner-meraki.png':'0c7372461c90e55a55c9a3466c1b1efec4fda9f38e435cc2e4b7ac46b159c568',
        'logo-meraki.png':'cd4ffd031131710d20a45ee590d67d25428223a582a7c3e55e807ae2b49b29cd',
        'banner-meraki-nuevo.png':'26bf7e8ecd8790ce0ac47b2d187011ecbe22300ea008134da07f12b3ea373b70',
        'logo-meraki-transparente.png':'bb9e55a3e6eb37013fe497a8975e2f02705c074271f0b5303c1b48b56e7fc99d'
    };
    for(const [archivo,huella] of Object.entries(originales)){
        const bytes=fs.readFileSync(path.join(__dirname,'../../frontend/front-office/assets',archivo));
        assert.equal(createHash('sha256').update(bytes).digest('hex'),huella);
    }
});
test('Banner y logo usan rutas relativas, texto accesible y no duplican las frases visibles', () => {
    assert.match(html,/<img[^>]*src="assets\/logo-meraki-transparente\.png"[^>]*alt="Logo oficial de Meraki"/);
    assert.match(html,/<img[^>]*src="assets\/banner-meraki-nuevo\.png"[^>]*alt="Encuentra el cuidado que buscas, cerca de ti\. Descubre servicios de cuidado personal ofrecidos por emprendedoras"/);
    assert(!html.includes('hero-arte'));
    const visible=html.replace(/<[^>]*>/g,'');
    assert(!visible.includes('Encuentra el cuidado que buscas, cerca de ti'));
    assert(!visible.includes('Descubre servicios de cuidado personal ofrecidos por emprendedoras'));
    assert.match(html,/href="styles\.css\?v=/);
});
test('Navegación y etiquetas de campos conservan destinos y ayudas accesibles', () => {
    const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
    for(const match of html.matchAll(/href="#([^"]+)"/g))assert(ids.has(match[1]),match[1]);
    for(const match of html.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g))for(const id of match[1].split(' '))assert(ids.has(id),id);
    assert.match(html,/href="\/back-office\/"/);assert(!html.includes('confirmarDatos'));
});
test('La fecha del resumen se presenta en español sin modificar la fecha de la API',async()=>{
    const p=iniciar();await p.preparar();
    assert.match(textos(p.elementos['#resumen']),/lunes, 4 de noviembre de 2030/);
    assert.equal(p.elementos['#fecha'].value,'2030-11-04');
    await p.elementos['#formReserva'].requestSubmit();
    assert.equal(p.peticiones.find(r=>r.url==='/api/reservas').body.fecha,'2030-11-04');
});
test('Los mensajes de reserva permanecen dentro de la reserva y los de búsqueda en el catálogo',async()=>{
    const p=iniciar();await pausa();assert.equal(p.elementos['#estado'].parentElement,p.elementos['#estadoCatalogo']);
    await p.preparar();assert.equal(p.elementos['#estado'].parentElement,p.elementos['#estadoReserva']);
    await p.elementos['#formReserva'].requestSubmit();assert.equal(p.elementos['#estado'].parentElement,p.elementos['#estadoReserva']);
    assert.match(p.elementos['#estado'].textContent,/pendiente de abono/);
    await p.elementos['#buscar'].requestSubmit();assert.equal(p.elementos['#estado'].parentElement,p.elementos['#estadoCatalogo']);
    assert.doesNotMatch(p.elementos['#estado'].textContent,/pendiente de abono/);
});


test('Errores aparecen solo en campos interactuados o al intentar continuar', async () => {
    const p = iniciar(); await p.seleccionar();
    for (const id of ['#errorNombre', '#errorCorreo', '#errorTelefono', '#errorFecha']) assert.equal(p.elementos[id].textContent, '');
    p.nombre.value = 'Clienta'; p.nombre.oninput();
    assert.equal(p.elementos['#errorCorreo'].textContent, '');
    assert.equal(p.elementos['#errorFecha'].textContent, '');
    p.correo.onblur(); assert.match(p.elementos['#errorCorreo'].textContent, /Escribe tu correo/);
    p.correo.value = 'clienta@example.com'; p.correo.oninput(); assert.equal(p.elementos['#errorCorreo'].textContent, '');
    await p.elementos['#formReserva'].requestSubmit(); assert.match(p.elementos['#errorFecha'].textContent, /Selecciona una fecha/);
    assert.equal(p.creadas(), 0);
});
