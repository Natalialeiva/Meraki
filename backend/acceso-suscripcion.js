// El estado de renovación y el acceso son independientes: cancelar no recorta un período vigente.
async function tieneAcceso(pool,cuenta){
    const r=await pool.query(`SELECT EXISTS(SELECT 1 FROM suscripcion WHERE id_emprendedora=$1
     AND acceso_hasta>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date) AS vigente`,[cuenta]);
    return r.rows[0].vigente;
}
function montarRestricciones(app,pool,verificarSesion){
    app.use(async(req,res,next)=>{
        const configuracion=['POST','PATCH','DELETE'].includes(req.method)&&/^\/api\/(servicios|trabajadoras|horarios|bloqueos)(\/|$)/.test(req.path);
        if(configuracion){
            return verificarSesion(req,res,async()=>{
                try{
                    if(await tieneAcceso(pool,req.session.idEmprendedora))return next();
                    res.status(402).json({codigo:'SUSCRIPCION_REQUERIDA',mensaje:'Activa o renueva tu suscripción para modificar servicios, trabajadoras u horarios. Tu agenda y citas existentes siguen disponibles.'});
                }catch(e){res.status(503).json({mensaje:'No se pudo verificar la vigencia de la suscripción'});}
            });
        }
        const nuevaReserva=req.method==='POST'&&req.path==='/api/reservas';
        const disponibilidad=req.method==='GET'&&req.path==='/api/disponibilidad';
        if(!nuevaReserva&&!disponibilidad)return next();
        const id=Number(nuevaReserva?req.body?.id_servicio:req.query.id_servicio);
        if(!Number.isSafeInteger(id)||id<=0)return next();
        try{
            const r=await pool.query(`SELECT e.id_emprendedora FROM servicio s JOIN emprendimiento e USING(id_emprendimiento) WHERE s.id_servicio=$1`,[id]);
            if(!r.rows.length||await tieneAcceso(pool,r.rows[0].id_emprendedora))return next();
            res.set('Cache-Control','no-store');
            if(disponibilidad)return res.json([]);
            // La clienta no necesita conocer el estado de facturación del negocio.
            res.status(409).json({codigo:'RESERVAS_NO_DISPONIBLES',mensaje:'Este emprendimiento no está recibiendo nuevas reservas por el momento'});
        }catch(e){res.status(503).json({mensaje:'No se pudo verificar la disponibilidad del emprendimiento'});}
    });
}
module.exports={tieneAcceso,montarRestricciones};
