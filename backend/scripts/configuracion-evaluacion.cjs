const fs=require('node:fs'),path=require('node:path');
function validar(env){
 if(!/^meraki_evaluacion_[a-z0-9_]{1,48}$/.test(env.DB_NAME||''))throw Error('Usa una base nueva cuyo nombre comience por meraki_evaluacion_. Las bases históricas están protegidas.');
 if(!['127.0.0.1','localhost','::1'].includes(env.DB_HOST))throw Error('La evaluación solo admite PostgreSQL local.');
 if(!env.DB_USER||!Number.isInteger(Number(env.DB_PORT))||Number(env.DB_PORT)<1||Number(env.DB_PORT)>65535)throw Error('Revisa DB_USER y DB_PORT.');
 if(env.MERAKI_PROVEEDORES_EXTERNOS!=='0'||env.MERAKI_SUSCRIPCIONES_AUTOMATICAS!=='0')throw Error('La evaluación requiere proveedores y renovaciones desactivados (0).');
 if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)throw Error('Falta una clave de sesiones de evaluación. Ejecuta --configurar sobre una carpeta sin .env.');
 if(!/^\d+$/.test(env.PORT||'')||Number(env.PORT)<1024||Number(env.PORT)>65535)throw Error('PORT debe estar entre 1024 y 65535.');
 return env;
}
function leer(){return validar(require('dotenv').parse(fs.readFileSync(path.join(__dirname,'../.env'))));}
module.exports={validar,leer};
