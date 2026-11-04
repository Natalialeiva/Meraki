const fs=require('node:fs'),path=require('node:path');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const pool=require('../db');
async function aplicar(){
    const db=await pool.connect();
    try{
        await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'");
        // Compara columnas anteriores a la migración; no toca pagos ni estados históricos.
        const tablas={reserva:['id_reserva','*'],abono:['id_abono','*'],
            suscripcion:['id_suscripcion','id_suscripcion,id_emprendedora,fecha_inicio,fecha_fin_prueba,fecha_proximo_cobro,monto_mensual,estado'],
            pago_suscripcion:['id_pago_suscripcion','id_pago_suscripcion,id_suscripcion,monto,estado,token_transaccion,codigo_autorizacion,fecha_creacion,fecha_pago']};
        async function huellas(){const resultado={};for(const [tabla,[id,columnas]] of Object.entries(tablas)){
            resultado[tabla]=(await db.query(`SELECT md5(COALESCE(jsonb_agg(to_jsonb(d) ORDER BY ${id})::text,'')) AS huella FROM (SELECT ${columnas} FROM ${tabla}) d`)).rows[0].huella;
        }return JSON.stringify(resultado);}
        const antes=await huellas();await db.query(fs.readFileSync(path.join(__dirname,'../../database/008_suscripcion_oneclick.sql'),'utf8'));
        if(antes!==await huellas())throw Error('Cambios históricos detectados');
        await db.query('COMMIT');console.log(JSON.stringify({migracion:'008',aplicada:true,datosAnterioresSinCambios:true}));
    }catch(e){await db.query('ROLLBACK');console.error(JSON.stringify({aplicada:false,codigo:e.code||'ERROR'}));process.exitCode=1;}
    finally{db.release();await pool.end();}
}
aplicar().catch(()=>{console.error('No se pudo conectar para aplicar la migración');process.exitCode=1;pool.end();});
