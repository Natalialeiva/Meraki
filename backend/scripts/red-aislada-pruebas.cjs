// Barrera de red exclusiva del proceso de pruebas. Nunca se carga al iniciar Meraki.
const locales=new Set(['localhost','127.0.0.1','::1','[::1]']);
function verificar(host){if(!locales.has(String(host||'localhost').toLowerCase()))throw Error('Las pruebas aisladas no permiten red externa.');}
function destino(primero,segundo){
 const opciones=typeof primero==='string'||primero instanceof URL?{hostname:new URL(primero).hostname}:primero||{};
 const extra=segundo&&typeof segundo==='object'?segundo:{};
 verificar(extra.hostname||extra.host||opciones.hostname||opciones.host||'localhost');
}
for(const nombre of ['node:http','node:https']){
 const modulo=require(nombre);
 for(const metodo of ['request','get']){const original=modulo[metodo];modulo[metodo]=function(...args){destino(args[0],args[1]);return original.apply(this,args);};}
}
const net=require('node:net'),conectar=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){
 const opciones=Array.isArray(args[0])?args[0][0]:args[0];
 if(typeof opciones==='object')verificar(opciones.host||opciones.hostname||'localhost');
 else if(typeof args[1]==='string')verificar(args[1]);
 return conectar.apply(this,args);
};
if(global.fetch){const original=global.fetch;global.fetch=function(input,...args){verificar(new URL(typeof input==='string'||input instanceof URL?input:input.url).hostname);return original.call(this,input,...args);};}
