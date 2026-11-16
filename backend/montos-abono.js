// Las API reciben números JSON. PostgreSQL NUMERIC se convierte explícitamente al leer.
const MAX_ABONO_CLP=99999999;
function abonoCLPValido(monto,precio=MAX_ABONO_CLP){
    return Number.isSafeInteger(monto)&&monto>0&&monto<=MAX_ABONO_CLP&&
        typeof precio==='number'&&Number.isFinite(precio)&&precio>0&&monto<=precio;
}
module.exports={abonoCLPValido,MAX_ABONO_CLP};
