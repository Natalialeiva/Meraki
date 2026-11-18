import {configurarGoogle} from './mapa-google.mjs';
// Archivo de navegador: nunca debe contener secretos de backend.
// Lectura diferida al abrir el panel con coordenadas válidas; sin persistencia personal.
export function crearLectorConfiguracion({mundo=globalThis,solicitar=mundo.fetch?.bind(mundo)}={}) {
    let pendiente;
    return async () => {
        if (mundo.MERAKI_MAPAS_CONFIG !== undefined) return configurarGoogle(mundo.MERAKI_MAPAS_CONFIG);
        if (!pendiente) pendiente=(async()=>{
            try {
                if (!solicitar) return null;
                const respuesta=await solicitar(new URL('/api/mapas/configuracion',import.meta.url),{cache:'no-store',credentials:'omit'});
                if (!respuesta.ok) return null;
                return configurarGoogle(await respuesta.json());
            } catch { return null; }
        })();
        return pendiente;
    };
}
