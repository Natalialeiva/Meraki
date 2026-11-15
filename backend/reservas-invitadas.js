const {createHash}=require('node:crypto');
const {crearServicioInvitada}=require('./reserva-invitada-servicio');
const TURNO=`SELECT
                s.id_emprendimiento,
                s.id_servicio,
                s.precio,
                s.monto_abono,
                horas.hora AS fecha_hora_inicio,
                horas.hora
                    + s.duracion_min * INTERVAL '1 minute'
                    AS fecha_hora_fin

            FROM trabajadora t

            INNER JOIN horario_atencion h
                ON t.id_trabajadora = h.id_trabajadora

            INNER JOIN trabajadora_servicio ts
                ON t.id_trabajadora = ts.id_trabajadora

            INNER JOIN servicio s
                ON ts.id_servicio = s.id_servicio

            INNER JOIN emprendimiento e
                ON s.id_emprendimiento = e.id_emprendimiento

            CROSS JOIN LATERAL generate_series(
                $1::DATE + h.hora_inicio,
                $1::DATE + h.hora_fin
                    - s.duracion_min * INTERVAL '1 minute',
                s.duracion_min * INTERVAL '1 minute'
            ) AS horas(hora)

            WHERE t.id_trabajadora = $3
              AND s.id_servicio = $4
              AND h.dia_semana = $2
              AND horas.hora = $1::DATE + $5::TIME
              AND EXISTS (
                  SELECT 1 FROM suscripcion plan
                  WHERE plan.id_emprendedora=e.id_emprendedora
                    AND plan.acceso_hasta>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date
              )
              AND t.id_emprendimiento = e.id_emprendimiento
              AND t.activa = TRUE
              AND h.activo = TRUE
              AND s.activo = TRUE
              AND e.estado = TRUE

              -- Rechazamos horas bloqueadas.
              AND NOT EXISTS (
                  SELECT 1
                  FROM bloqueo_horario b
                  WHERE b.id_trabajadora = t.id_trabajadora
                    AND horas.hora < b.fecha_fin
                    AND horas.hora
                        + s.duracion_min * INTERVAL '1 minute'
                        > b.fecha_inicio
              )

              -- Rechazamos horas ocupadas por otras reservas.
              AND NOT EXISTS (
                  SELECT 1
                  FROM reserva r
                  WHERE r.id_trabajadora = t.id_trabajadora
                    AND r.estado IN (
                        'pendiente_abono',
                        'confirmada'
                    )
                    AND horas.hora < r.fecha_hora_fin
                    AND horas.hora
                        + s.duracion_min * INTERVAL '1 minute'
                        > r.fecha_hora_inicio
              )

            LIMIT 1;`;

function montar(app,pool,secreto){
 const servicio=crearServicioInvitada({pool,secreto:createHash('sha256').update(secreto).digest('hex'),consultarTurno:async(db,d)=>{
  const dia=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][new Date(d.fecha+'T00:00:00Z').getUTCDay()];
  if(!(await db.query("SELECT $1::date+$2::time > CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' AS futura",[d.fecha,d.hora])).rows[0].futura)return null;
  return (await db.query(TURNO,[d.fecha,dia,d.id_trabajadora,d.id_servicio,d.hora])).rows[0];
 }});
 const cookie=req=>{const matches=(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('meraki.invitada='));return matches.length===1?matches[0].slice('meraki.invitada='.length):'';};
 const limites=new Map();
 const limitar=(req,res,next)=>{const now=Date.now(),ip=req.ip;for(const [k,v] of limites)if(v.vence<=now)limites.delete(k);let valor=limites.get(ip);if(!valor){if(limites.size>=5000)return res.status(429).json({mensaje:'Intenta más tarde'});valor={n:0,vence:now+15*60000};limites.set(ip,valor);}if(++valor.n>60)return res.status(429).json({mensaje:'Demasiados intentos. Espera antes de continuar.'});next();};
 const headers=res=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');};
 app.get('/api/reservas/invitada/contexto',(req,res)=>{headers(res);if(!servicio.contextoValido(cookie(req)))res.cookie('meraki.invitada',servicio.emitirContexto(),{httpOnly:true,sameSite:'strict',secure:process.env.PUBLIC_BASE_URL?.startsWith('https:')===true,path:'/api/reservas/invitada',maxAge:7*86400000});res.json({disponible:true});});
 app.post('/api/reservas/invitada',limitar,async(req,res)=>{
  headers(res);
  if(req.get('X-Meraki-Action')!=='1'||req.get('Sec-Fetch-Site')==='cross-site'||(req.get('Origin')&&req.get('Origin')!==req.protocol+'://'+req.get('Host')))return res.status(403).json({mensaje:'Solicitud no autorizada'});
  try{const r=await servicio.crear({contexto:cookie(req),clave:req.get('Idempotency-Key'),body:req.body});res.status(r.http).json({...r.cuerpo,mensaje:r.http<300?'Reserva registrada correctamente':'El horario no está disponible'});}
  catch(e){res.status(e.http||503).json({codigo:e.codigo||'NO_DISPONIBLE',mensaje:e.http===410?'Este intento venció. Revisa tu reserva antes de volver a intentar.':e.http===429?'Demasiados intentos. Espera antes de continuar.':e.http===409?'El intento no puede completarse. Revisa los datos y la disponibilidad.':'No se pudo crear la reserva. Revisa los datos o intenta más tarde.'});}
 });
}
module.exports={montar,TURNO};
