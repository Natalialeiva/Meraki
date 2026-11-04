const fs = require('fs');
const path = require('path');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const {Pool} = require('pg');
async function aplicar() {
    const pool=new Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
    let db;
    try {
        db=await pool.connect();
        await db.query('BEGIN');
        await db.query("SET LOCAL lock_timeout='5s'");
        const huella=async()=> (await db.query(`SELECT
          (SELECT md5(COALESCE(jsonb_agg((to_jsonb(r)-'correo_confirmacion'-'nombre_clienta') ORDER BY id_reserva)::text,'')) FROM reserva r) AS reservas,
          (SELECT md5(COALESCE(jsonb_agg(to_jsonb(a) ORDER BY id_abono)::text,'')) FROM abono a) AS abonos`)).rows[0];
        const antes=await huella();
        for(const archivo of ['003_notificaciones_correo.sql','004_fecha_inicio_envio.sql','005_revision_notificaciones.sql','006_correccion_correo_reserva.sql','007_nombre_reserva.sql']) {
            await db.query(fs.readFileSync(path.join(__dirname,'../../database',archivo),'utf8'));
        }
        const despues=await huella();
        if(antes.reservas!==despues.reservas||antes.abonos!==despues.abonos)throw new Error('Se detectó un cambio de reservas o abonos; migración revertida');
        await db.query('COMMIT');
        console.log(JSON.stringify({migracionesAplicadas:['003','004','005','006','007'],reservasSinCambios:true,abonosSinCambios:true}));
    } catch(error) {
        if(db)await db.query('ROLLBACK').catch(()=>{});
        console.error(JSON.stringify({migracionAplicada:false,codigo:error.code||'ERROR'}));
        process.exitCode=1;
    } finally {if(db)db.release();await pool.end();}
}
aplicar();
