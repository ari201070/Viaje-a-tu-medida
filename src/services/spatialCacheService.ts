import { latLngToCell } from 'h3-js';

const H3_RESOLUTION = 9; // ~170m hexágonos

export interface KnownPlace {
  h3Index: string;
  roundedLat: number;
  roundedLng: number;
  locationName: string;
  placeId?: string;
  source: 'cache' | 'api';
}

// Regla de Truncamiento: Redondeo estricto a 4 decimales (~11m de precisión)
export const roundCoord = (val: number) => Math.round(val * 10000) / 10000;

/**
 * SpatialCache: Implementación del "Cerebro del Puzzle" y la Memoria Colectiva.
 * Simula la tabla `known_places` de PostGIS utilizando LocalStorage para el Nivel 0/1.
 * Reduce el OPEX al evitar llamadas redundantes a APIs externas.
 */
class SpatialCache {
  private cacheKey = 'spatial_memory_known_places';

  private getCache(): Record<string, KnownPlace[]> {
    try {
      const data = localStorage.getItem(this.cacheKey);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error("Error reading spatial cache", e);
      return {};
    }
  }

  private saveCache(cache: Record<string, KnownPlace[]>) {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(cache));
    } catch (e) {
      console.error("Error saving spatial cache", e);
    }
  }

  /**
   * Resuelve una ubicación utilizando la Lógica de Cascada.
   * Prioriza el Índice H3 y las coordenadas redondeadas antes de llamar a la API.
   * @param bypassCache Si es true, ignora el caché H3 y fuerza una llamada a la API.
   *   Usar cuando Vision AI tiene evidencia semántica (OCR/Landmark) que supera el GPS.
   */
  public async resolveLocation(
    lat: number, 
    lng: number, 
    fetchFromApi: (lat: number, lng: number) => Promise<string>,
    bypassCache = false
  ): Promise<KnownPlace> {
    const rLat = roundCoord(lat);
    const rLng = roundCoord(lng);
    const h3Index = latLngToCell(rLat, rLng, H3_RESOLUTION);

    const cache = this.getCache();
    
    // NIVEL 1: Caché Local (H3 + Redondeo a 4 decimales)
    // Se salta si bypassCache=true (Semantic Override activo por Vision AI)
    if (!bypassCache && cache[h3Index]) {
      const existingPlace = cache[h3Index].find(p => p.roundedLat === rLat && p.roundedLng === rLng);
      if (existingPlace) {
        console.log(`[OPEX SAVED] Cache hit for H3: ${h3Index}. Costo: $0`);
        return { ...existingPlace, source: 'cache' };
      }
    }

    if (bypassCache) {
      console.log(`[SEMANTIC OVERRIDE] Cache ignorado para H3: ${h3Index}. Visión AI tiene evidencia semántica prioritaria.`);
    } else {
      console.log(`[API CALL] Cache miss for H3: ${h3Index}. Consultando API externa...`);
    }

    const locationName = await fetchFromApi(lat, lng);

    const newPlace: KnownPlace = {
      h3Index,
      roundedLat: rLat,
      roundedLng: rLng,
      locationName,
      source: 'api'
    };

    // Sobreescribir la "Memoria Colectiva" con el resultado semántico más preciso
    if (!cache[h3Index]) {
      cache[h3Index] = [];
    }
    // Si bypassCache, reemplazar la entrada existente (no duplicar)
    if (bypassCache) {
      cache[h3Index] = cache[h3Index].filter(p => !(p.roundedLat === rLat && p.roundedLng === rLng));
    }
    cache[h3Index].push(newPlace);
    this.saveCache(cache);

    return newPlace;
  }

  /**
   * Invalida una celda H3 específica del caché local.
   * Útil para limpiar entradas incorrectas detectadas por Vision AI.
   */
  public invalidateCell(lat: number, lng: number) {
    const rLat = roundCoord(lat);
    const rLng = roundCoord(lng);
    const h3Index = latLngToCell(rLat, rLng, H3_RESOLUTION);
    const cache = this.getCache();
    if (cache[h3Index]) {
      cache[h3Index] = cache[h3Index].filter(p => !(p.roundedLat === rLat && p.roundedLng === rLng));
      this.saveCache(cache);
      console.log(`[CACHE PURGE] Entrada eliminada para H3: ${h3Index} @ ${rLat},${rLng}`);
    }
  }
}

export const spatialCacheService = new SpatialCache();
