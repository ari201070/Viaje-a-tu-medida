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
   */
  public async resolveLocation(
    lat: number, 
    lng: number, 
    fetchFromApi: (lat: number, lng: number) => Promise<string>
  ): Promise<KnownPlace> {
    const rLat = roundCoord(lat);
    const rLng = roundCoord(lng);
    const h3Index = latLngToCell(rLat, rLng, H3_RESOLUTION);

    const cache = this.getCache();
    
    // NIVEL 1: Caché Local (H3 + Redondeo a 4 decimales)
    if (cache[h3Index]) {
      // Buscamos una colisión deliberada en la misma celda H3 y coordenadas truncadas
      const existingPlace = cache[h3Index].find(p => p.roundedLat === rLat && p.roundedLng === rLng);
      if (existingPlace) {
        console.log(`[OPEX SAVED] Cache hit for H3: ${h3Index}. Costo: $0`);
        return { ...existingPlace, source: 'cache' };
      }
    }

    // NIVEL 2: Open Data (OpenCage / OSM) - Fallback
    console.log(`[API CALL] Cache miss for H3: ${h3Index}. Consultando API externa...`);
    const locationName = await fetchFromApi(lat, lng);

    const newPlace: KnownPlace = {
      h3Index,
      roundedLat: rLat,
      roundedLng: rLng,
      locationName,
      source: 'api'
    };

    // Guardar en la "Memoria Colectiva" (Tabla de persistencia)
    if (!cache[h3Index]) {
      cache[h3Index] = [];
    }
    cache[h3Index].push(newPlace);
    this.saveCache(cache);

    return newPlace;
  }
}

export const spatialCacheService = new SpatialCache();
