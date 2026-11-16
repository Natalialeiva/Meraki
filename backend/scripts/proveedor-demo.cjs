// Exclusivo del lanzador efímero. Nunca importa el SDK ni realiza llamadas de red.
const {randomBytes}=require('node:crypto');
function crearProveedorDemo(origen){
 const base=new URL(origen);
 if(base.protocol!=='http:'||base.hostname!=='127.0.0.1'||base.pathname!=='/'||base.username||base.password||base.search||base.hash)throw Error('Solo loopback');
 const pagos=new Map();
 return {
  async create(orden,sesion,monto,retorno){
   const url=new URL(retorno);
   if(url.origin!==base.origin||url.pathname!=='/api/abonos/retorno/navegador'||!Number.isSafeInteger(monto)||monto<=0)throw Error('Prueba fuera de alcance');
   const token=randomBytes(32).toString('hex');
   pagos.set(token,{token,orden,monto,retorno,aprobado:false});
   return {token,url:'https://webpay3gint.transbank.cl/webpayserver/initTransaction'};
  },
  leer(token){const p=typeof token==='string'?pagos.get(token):null;return p?{token:p.token,monto:p.monto}:null;},
  aprobar(token){const p=pagos.get(token);if(!p)throw Error('Prueba inexistente');p.aprobado=true;const url=new URL(p.retorno);url.searchParams.set('token_ws',token);return url.href;},
  async commit(token){return this.status(token);},
  async status(token){const p=pagos.get(token);if(!p)throw Error('Prueba inexistente');return {status:p.aprobado?'AUTHORIZED':'INITIALIZED',response_code:p.aprobado?0:undefined,amount:p.monto,buy_order:p.orden,authorization_code:p.aprobado?'DEMO-SIN-COBRO':undefined};}
 };
}
module.exports={crearProveedorDemo};
