const {test}=require('node:test'),assert=require('node:assert/strict');
const {validar}=require('../scripts/configuracion-evaluacion.cjs');
const {migraciones}=require('../scripts/preparar-evaluacion.cjs');
const correcto={DB_HOST:'127.0.0.1',DB_PORT:'5432',DB_USER:'ficticio',DB_NAME:'meraki_evaluacion_prueba',SESSION_SECRET:'x'.repeat(64),PORT:'3000',MERAKI_PROVEEDORES_EXTERNOS:'0',MERAKI_SUSCRIPCIONES_AUTOMATICAS:'0'};
test('Configuración local ficticia válida',()=>assert.equal(validar(correcto),correcto));
for(const nombre of ['meraki_db','meraki_demo','postgres','meraki_evaluacion_','meraki_evaluacion_x;DROP DATABASE x'])test('Protege destino '+nombre,()=>assert.throws(()=>validar({...correcto,DB_NAME:nombre})));
for(const k of ['MERAKI_PROVEEDORES_EXTERNOS','MERAKI_SUSCRIPCIONES_AUTOMATICAS'])test('Bloquea '+k,()=>assert.throws(()=>validar({...correcto,[k]:'1'})));
test('No admite PostgreSQL remoto',()=>assert.throws(()=>validar({...correcto,DB_HOST:'servidor.example.test'})));
test('Todas las migraciones hasta 013 existen y tienen orden explícito',()=>{const fs=require('node:fs'),path=require('node:path');assert.equal(migraciones[0],'schema.sql');assert.equal(migraciones.at(-1),'013_servicio_abono_clp.sql');for(const m of migraciones)assert(fs.existsSync(path.join(__dirname,'../../database',m)));});

test('Instalador restaura el esquema original sin tablas de aplicación adicionales',()=>{const fs=require('node:fs'),path=require('node:path');const s=fs.readFileSync(path.join(__dirname,'../scripts/preparar-evaluacion.cjs'),'utf8');assert.match(s,/entrega-esquema\.sql/);assert.doesNotMatch(s,/CREATE TABLE evaluacion_meraki|ALTER TABLE servicio VALIDATE/);const sql=fs.readFileSync(path.join(__dirname,'../../database/entrega-esquema.sql'),'utf8');assert.match(sql,/CREATE TABLE public.reserva/);assert.match(sql,/CREATE TABLE public.abono/);assert.doesNotMatch(sql,/^COPY |^INSERT INTO /m);});

test('Barrera de pruebas rechaza proveedores externos antes de abrir una conexión',()=>{const {spawnSync}=require('node:child_process'),path=require('node:path');const r=spawnSync(process.execPath,['--require',path.join(__dirname,'../scripts/red-aislada-pruebas.cjs'),'-e',"require('node:assert/strict').throws(()=>require('node:https').get('https://proveedor.example.test'),/no permiten red externa/)"],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);});
