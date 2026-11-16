const bcrypt=require('bcrypt');
// Datos inventados de apariencia normal. Sin pagos, correos, sesiones ni clientas.
async function cargarDatosAcademicos(c,{clave}={}){
 if((await c.query("SELECT 1 FROM emprendedora WHERE correo='valentina@luna.example.test'")).rowCount)throw Error('La cuenta académica ya existe: no sobrescribir');
 const hash=clave?await bcrypt.hash(clave,12):'!CUENTA_ACADEMICA_SIN_ACTIVAR!';
 const cuenta=(await c.query("INSERT INTO emprendedora(nombre,apellido,rut,correo,password_hash) VALUES('Valentina','Rojas','ACADEMICO-LUNA','valentina@luna.example.test',$1) RETURNING id_emprendedora",[hash])).rows[0].id_emprendedora;
 const negocio=(await c.query("INSERT INTO emprendimiento(id_emprendedora,nombre,descripcion,comuna,direccion,latitud,longitud) VALUES($1,'Luna Estudio','Manicure y cuidado personal con atención personalizada.','Providencia','Providencia, Santiago',-33.4263,-70.6167) RETURNING id_emprendimiento",[cuenta])).rows[0].id_emprendimiento;
 await c.query("INSERT INTO suscripcion(id_emprendedora,fecha_inicio,fecha_fin_prueba,acceso_hasta,estado,monto_mensual,renovacion_automatica) VALUES($1,CURRENT_DATE,(CURRENT_DATE+interval '1 month')::date,(CURRENT_DATE+interval '1 month')::date,'prueba',9990,false)",[cuenta]);
 const servicios=[];
 for(const [nombre,categoria,precio,duracion]of [['Manicure permanente','Manicure',20000,60],['Pedicure spa','Pedicure',25000,60]]){
  await c.query('INSERT INTO categoria(nombre) VALUES($1) ON CONFLICT(nombre) DO NOTHING',[categoria]);
  servicios.push((await c.query('INSERT INTO servicio(id_emprendimiento,id_categoria,nombre,descripcion,precio,duracion_min,monto_abono) VALUES($1,(SELECT id_categoria FROM categoria WHERE nombre=$2),$3,$4,$5,$6,5000) RETURNING id_servicio',[negocio,categoria,nombre,'Atención personalizada con reserva previa.',precio,duracion])).rows[0].id_servicio);
 }
 for(const nombre of ['Sofía','Isidora']){
  const id=(await c.query('INSERT INTO trabajadora(id_emprendimiento,nombre) VALUES($1,$2) RETURNING id_trabajadora',[negocio,nombre])).rows[0].id_trabajadora;
  for(const servicio of servicios)await c.query('INSERT INTO trabajadora_servicio VALUES($1,$2)',[id,servicio]);
  await c.query("INSERT INTO horario_atencion(id_trabajadora,dia_semana,hora_inicio,hora_fin) SELECT $1,dia,'09:00','18:00' FROM unnest(ARRAY['lunes','martes','miercoles','jueves','viernes','sabado']) dia",[id]);
 }
 return {cuenta,negocio,servicios,correo:'valentina@luna.example.test',nombre:'Luna Estudio'};
}
module.exports={cargarDatosAcademicos};
