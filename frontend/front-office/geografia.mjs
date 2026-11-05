// Modelo esférico con radio terrestre medio aproximado de 6371.0088 km.
// Distancias de gran círculo: no representan recorridos por carretera.
export const RADIO_TERRESTRE_KM = 6371.0088;

function numeroDecimal(valor) {
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
    if (typeof valor !== 'string') return null;
    const texto = valor.trim();
    // Acepta decimales PostgreSQL; excluye vacíos, hexadecimal y conversiones implícitas.
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(texto)) return null;
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : null;
}

// Devuelve un par normalizado nuevo o null si falta o es inválida alguna coordenada.
export function validarCoordenadas(latitud, longitud) {
    const lat = numeroDecimal(latitud), lon = numeroDecimal(longitud);
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return {latitud: lat, longitud: lon};
}

// Sin redondeo ni formato visual. null significa distancia desconocida, nunca cero.
export function distanciaKm(latitudOrigen, longitudOrigen, latitudDestino, longitudDestino) {
    const origen = validarCoordenadas(latitudOrigen, longitudOrigen);
    const destino = validarCoordenadas(latitudDestino, longitudDestino);
    if (!origen || !destino) return null;
    const radianes = grados => grados * Math.PI / 180;
    const diferenciaLat = radianes(destino.latitud - origen.latitud);
    const diferenciaLon = radianes(destino.longitud - origen.longitud);
    const a = Math.sin(diferenciaLat / 2) ** 2
        + Math.cos(radianes(origen.latitud)) * Math.cos(radianes(destino.latitud))
        * Math.sin(diferenciaLon / 2) ** 2;
    // Protege los casos antípodas de pequeños errores de punto flotante.
    const limitada = Math.min(1, Math.max(0, a));
    return 2 * RADIO_TERRESTRE_KM * Math.atan2(Math.sqrt(limitada), Math.sqrt(1 - limitada));
}
