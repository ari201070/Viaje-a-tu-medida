import { latLngToCell } from 'h3-js';

const H3_RESOLUTION = 9; // ~170m hexágonos
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días en ms

export interface KnownPlace {
  h3Index: string;
  roundedLat: number;
  roundedLng: number;
  locationName: string;
  placeId?: string;
  source: 'cache' | 'api';
  cachedAt?: number; // timestamp Unix ms — entradas sin este campo se tratan como expiradas
}

// Regla de Truncamiento: Redondeo estricto a 4 decimales (~11m de precisión)
export const roundCoord = (val: number) => Math.round(val * 10000) / 10000;

/**
 * SpatialCache: Implementación del "Cerebro del Puzzle" y la Memoria Colectiva.
 * Simula la tabla `known_places` de PostGIS utilizando LocalStorage para el Nivel 0/1.
 * Reduce el OPEX al evitar llamadas redundantes a APIs externas.
 *
 * TTL de 7 días: Entradas sin `cachedAt` (legacy/corruptas) son tratadas como expiradas
 * y se refrescan automáticamente en la próxima consulta. El usuario nunca necesita borrar
 * el LocalStorage manualmente.
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

  private isExpired(place: KnownPlace): boolean {
    // Entradas sin timestamp (legacy) se tratan como expiradas para forzar refresco
    if (!place.cachedAt) return true;
    return Date.now() - place.cachedAt > CACHE_TTL_MS;
  }

  /**
   * Resuelve una ubicación utilizando la Lógica de Cascada.
   * Prioriza el Índice H3 y las coordenadas redondeadas antes de llamar a la API.
 fix/cache-ttl
   *
   * @param bypassCache - Si es true, ignora el caché H3 y fuerza una llamada a la API.
   *   Usar cuando Vision AI tiene evidencia semántica (OCR/Landmark) que supera el GPS.
   */
  public async resolveLocation(
    lat: number,
    lng: number,
    fetchFromApi: (lat: number, lng: number) => Promise<string>,
    bypassCache = false
=======
   */
  public async resolveLocation(
    lat: number, 
    lng: number, 
    fetchFromApi: (lat: number, lng: number) => Promise<string>
 main
  ): Promise<KnownPlace> {
    const rLat = roundCoord(lat);
    const rLng = roundCoord(lng);
    const h3Index = latLngToCell(rLat, rLng, H3_RESOLUTION);

    const cache = this.getCache();

    // NIVEL 1: Caché Local (H3 + Redondeo a 4 decimales)
 fix/cache-ttl
    // Se salta si:
    //   a) bypassCache=true (Semantic Override activo por Vision AI)
    //   b) La entrada no tiene cachedAt (legacy/corrupta) → auto-expirada
    //   c) La entrada superó el TTL de 7 días
    if (!bypassCache && cache[h3Index]) {
      const existingPlace = cache[h3Index].find(
        p => p.roundedLat === rLat && p.roundedLng === rLng
      );
      if (existingPlace && !this.isExpired(existingPlace)) {
        console.log(`[OPEX SAVED] Cache hit para H3: ${h3Index}. Costo: $0`);
=======
    if (cache[h3Index]) {
      // Buscamos una colisión deliberada en la misma celda H3 y coordenadas truncadas
      const existingPlace = cache[h3Index].find(p => p.roundedLat === rLat && p.roundedLng === rLng);
      if (existingPlace) {
        console.log(`[OPEX SAVED] Cache hit for H3: ${h3Index}. Costo: $0`);
 main
        return { ...existingPlace, source: 'cache' };
      }
      if (existingPlace && this.isExpired(existingPlace)) {
        console.log(`[CACHE EXPIRED] Entrada expirada/legacy para H3: ${h3Index}. Refrescando...`);
      }
    }

 fix/cache-ttl
    if (bypassCache) {
      console.log(`[SEMANTIC OVERRIDE] Cache ignorado para H3: ${h3Index}. Vision AI tiene evidencia semántica prioritaria.`);
    } else {
      console.log(`[API CALL] Cache miss para H3: ${h3Index}. Consultando API externa...`);
    }

=======
    // NIVEL 2: Open Data (OpenCage / OSM) - Fallback
    console.log(`[API CALL] Cache miss for H3: ${h3Index}. Consultando API externa...`);
 main
    const locationName = await fetchFromApi(lat, lng);

    const newPlace: KnownPlace = {
      h3Index,
      roundedLat: rLat,
      roundedLng: rLng,
      locationName,
      source: 'api',
      cachedAt: Date.now() // Siempre guardar el timestamp
    };

 fix/cache-ttl
    // Sobreescribir la "Memoria Colectiva" con el resultado más reciente
    if (!cache[h3Index]) {
      cache[h3Index] = [];
    }
    // Reemplazar entrada existente (evita duplicados y purga las legacy sin timestamp)
    cache[h3Index] = cache[h3Index].filter(
      p => !(p.roundedLat === rLat && p.roundedLng === rLng)
    );
=======
    // Guardar en la "Memoria Colectiva" (Tabla de persistencia)
    if (!cache[h3Index]) {
      cache[h3Index] = [];
    }
 main
    cache[h3Index].push(newPlace);
    this.saveCache(cache);

    return newPlace;
  }
 fix/cache-ttl

  /**
   * Invalida una celda H3 específica del caché local.
   * Útil para correcciones manuales desde la UI.
   */
  public invalidateCell(lat: number, lng: number) {
    const rLat = roundCoord(lat);
    const rLng = roundCoord(lng);
    const h3Index = latLngToCell(rLat, rLng, H3_RESOLUTION);
    const cache = this.getCache();
    if (cache[h3Index]) {
      cache[h3Index] = cache[h3Index].filter(
        p => !(p.roundedLat === rLat && p.roundedLng === rLng)
      );
      this.saveCache(cache);
      console.log(`[CACHE PURGE] Entrada eliminada para H3: ${h3Index} @ ${rLat},${rLng}`);
    }
  }

  /**
   * Purga todas las entradas expiradas o legacy (sin cachedAt) del caché completo.
   * Se puede llamar al iniciar la app para limpiar datos corruptos históricos.
   */
  public purgeExpired() {
    const cache = this.getCache();
    let purgado = 0;
    for (const h3Index in cache) {
      const before = cache[h3Index].length;
      cache[h3Index] = cache[h3Index].filter(p => !this.isExpired(p));
      purgado += before - cache[h3Index].length;
    }
    if (purgado > 0) {
      this.saveCache(cache);
      console.log(`[CACHE PURGE] ${purgado} entradas expiradas/legacy eliminadas.`);
    }
  }
=======
 main
}

export const spatialCacheService = new SpatialCache();
