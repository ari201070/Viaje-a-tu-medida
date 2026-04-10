import React, { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Upload, MapPin, Clock, Info, Loader2, ArrowLeft, Cloud, Search, AlertTriangle, X, FolderInput, AlertCircle } from 'lucide-react';
import { useTripStore } from '../store/useTripStore';
import exifr from 'exifr';
import { latLngToCell } from 'h3-js';
import { analyzeImageWithVision, reconcileLocation } from '../services/visionService';
import { spatialCacheService } from '../services/spatialCacheService';

// Helper to parse EXIF date string if needed, though exifr usually returns a Date object
function parseExifDate(dateStr: string | Date) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr.getTime();
  const parts = dateStr.split(' ');
  if (parts.length !== 2) return null;
  const dateParts = parts[0].split(':');
  const timeParts = parts[1].split(':');
  return new Date(
    parseInt(dateParts[0]),
    parseInt(dateParts[1]) - 1,
    parseInt(dateParts[2]),
    parseInt(timeParts[0]),
    parseInt(timeParts[1]),
    parseInt(timeParts[2])
  ).getTime();
}

interface ProcessedPhoto {
  id: string;
  url: string;
  file: File;
  date: number | null;
  lat: number | null;
  lng: number | null;
  direction?: number | null;
  visionLandmarks?: string[];
  visionTexts?: string[];
  visionLabels?: string[];
  isAnchor: boolean;
  clusterId: string | null;
  locationName: string | null;
  inherited: boolean;
  resolutionSource?: 'cache' | 'api';
  internalScore?: number;
}

interface PhotoCluster {
  id: string;
  anchorPhoto: ProcessedPhoto;
  photos: ProcessedPhoto[];
  locationName: string;
}

export default function PhotosModule() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const trip = useTripStore((state) => state.trips.find((t) => t.id === id));
  const addDestinationPhotos = useTripStore((state) => state.addDestinationPhotos);
  
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([]);
  const [clusters, setClusters] = useState<PhotoCluster[]>([]);
  const [selectedDestinations, setSelectedDestinations] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(false);
  const [fileLimitWarning, setFileLimitWarning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!trip) return null;

  const handleSaveAll = () => {
    if (!trip.id) return;
    
    // Group photos by selected destination
    const photosByDestination: Record<string, ProcessedPhoto[]> = {};
    
    clusters.forEach(cluster => {
      const destId = selectedDestinations[cluster.id];
      if (destId) {
        if (!photosByDestination[destId]) {
          photosByDestination[destId] = [];
        }
        photosByDestination[destId].push(...cluster.photos);
      }
    });

    // Save to store
    Object.entries(photosByDestination).forEach(([destId, destPhotos]) => {
      addDestinationPhotos(trip.id, destId, destPhotos);
    });

    // Navigate back to trip
    navigate(`/trip/${trip.id}`);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const processFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    
    setIsProcessing(true);
    setRateLimitError(false);
    const newPhotos: ProcessedPhoto[] = [];

    // Safeguard helper para evitar que la UI se congele
    const withTimeout = <T,>(promise: Promise<T>, ms: number, fallbackValue: T, operationName: string): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => {
          console.warn(`[TIMEOUT] La operación '${operationName}' superó los ${ms}ms en colgarse. Usando esquema de emergencia.`);
          resolve(fallbackValue);
        }, ms))
      ]);
    };

    // 1. Extract EXIF data from all photos (NO Vision API yet)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`[PROGRESO] Etapa 1: Procesando foto ${i + 1}/${files.length} - ${file.name}`);
      let url = '';
      try {
        url = await withTimeout(compressImage(file), 5000, URL.createObjectURL(file), 'compressImage');
      } catch (e) {
        console.error("Error compressing image", e);
        url = URL.createObjectURL(file); // Fallback
      }
      
      let lat = null;
      let lng = null;
      let direction = null;
      let date = file.lastModified;

      try {
        console.log(`[PROGRESO] Etapa 1: Extrayendo metadata EXIF de ${file.name}...`);
        const exifData = await withTimeout(exifr.parse(file), 3000, null, 'exifr.parse');
        if (exifData) {
          if (exifData.latitude && exifData.longitude) {
            lat = exifData.latitude;
            lng = exifData.longitude;
          }
          if (exifData.DateTimeOriginal) {
            date = parseExifDate(exifData.DateTimeOriginal) || file.lastModified;
          }
          if (exifData.GPSImgDirection !== undefined) {
            direction = Math.round(exifData.GPSImgDirection * 100) / 100;
          }
        }
      } catch (error) {
        console.error("Error parsing EXIF:", error);
      }
      
      newPhotos.push({
        id: Math.random().toString(36).substring(7),
        url,
        file,
        date,
        lat,
        lng,
        direction,
        visionLandmarks: [],
        visionTexts: [],
        visionLabels: [],
        isAnchor: lat !== null && lng !== null,
        clusterId: null,
        locationName: null,
        inherited: false
      });
    }

    // Sort photos by date
    newPhotos.sort((a, b) => (a.date || 0) - (b.date || 0));

    // Función para calcular distancia en metros (Haversine)
    const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3;
      const p1 = lat1 * Math.PI/180;
      const p2 = lat2 * Math.PI/180;
      const dp = (lat2-lat1) * Math.PI/180;
      const dl = (lon2-lon1) * Math.PI/180;
      const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    // 2. Modo Puzzle: Clustering Espacial (Distancia) y Temporal (20 min)
    const TIME_WINDOW_MS = 20 * 60 * 1000; // 20 minutos (Ruptura por cambio de actividad)
    const INHERIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
    const DISTANCE_THRESHOLD_M = 100; // 100 metros de tolerancia (Una cuadra real)

    const rawClusters: ProcessedPhoto[][] = [];
    let currentCluster: ProcessedPhoto[] = [newPhotos[0]];

    for (let i = 1; i < newPhotos.length; i++) {
      const photo = newPhotos[i];
      const prev = newPhotos[i - 1];
      const timeDiff = Math.abs((photo.date || 0) - (prev.date || 0));

      // Ruptura temporal (60 min)
      if (timeDiff > TIME_WINDOW_MS) {
        rawClusters.push(currentCluster);
        currentCluster = [photo];
        continue;
      }

      // Ruptura espacial (Distancia > 300m respecto a la última foto con GPS del clúster)
      let lastLat = null;
      let lastLng = null;
      for (let j = currentCluster.length - 1; j >= 0; j--) {
        if (currentCluster[j].lat != null && currentCluster[j].lng != null) {
          lastLat = currentCluster[j].lat;
          lastLng = currentCluster[j].lng;
          break;
        }
      }

      if (photo.lat != null && photo.lng != null && lastLat != null && lastLng != null) {
        const distance = getDistanceMeters(photo.lat, photo.lng, lastLat, lastLng);
        if (distance > DISTANCE_THRESHOLD_M) {
          rawClusters.push(currentCluster);
          currentCluster = [photo];
          continue;
        }
      }

      currentCluster.push(photo);
    }

    if (currentCluster.length > 0) {
      rawClusters.push(currentCluster);
    }

    // 3. Pick anchor and inherit coordinates, THEN call Vision API ONLY for Anchors
    let skipVisionForRest = false;
    let rateLimitHit = false;

    for (const clusterPhotos of rawClusters) {
      // Pick anchor: Prioritize photos with GPS, then pick the MEDIAN (center of the activity)
      const photosWithGps = clusterPhotos.filter(p => p.lat != null && p.lng != null);
      const candidates = photosWithGps.length > 0 ? photosWithGps : clusterPhotos;
      
      // Asegurar orden cronológico de los candidatos
      const sortedCandidates = [...candidates].sort((a, b) => (a.date || 0) - (b.date || 0));
      
      // Elegir la foto central del evento
      const medianIndex = Math.floor(sortedCandidates.length / 2);
      const bestAnchor = sortedCandidates[medianIndex];
      const anchor = clusterPhotos.find(p => p.id === bestAnchor.id);

      if (anchor) {
        anchor.isAnchor = true;
        
        // Propagate cluster ID and inherit coordinates
        clusterPhotos.forEach(p => {
          p.clusterId = anchor.id;
          if (p.id !== anchor.id) {
            p.isAnchor = false;
          }
          
          if (p.lat == null && p.lng == null && p.date && anchor.date) {
            const diff = Math.abs(p.date - anchor.date);
            if (diff <= INHERIT_WINDOW_MS) {
              p.inherited = true;
              p.lat = anchor.lat;
              p.lng = anchor.lng;
            }
          }
        });

        // NOW call Vision API ONLY for this Anchor photo to save quota
        if (!skipVisionForRest) {
          try {
            console.log(`[PROGRESO] Etapa 3: Analizando ancla con Vision AI (${anchor.file.name})...`);
            const visionData = await withTimeout(
              analyzeImageWithVision(anchor.file),
              10000, // 10 segundos máximo para la IA
              { landmarks: [], texts: [], labels: [] },
              'analyzeImageWithVision'
            );
            anchor.visionLandmarks = visionData.landmarks;
            anchor.visionTexts = visionData.texts;
            anchor.visionLabels = visionData.labels;
            
            // Recalculate anchor score with new vision data
            if (anchor.visionLandmarks && anchor.visionLandmarks.length > 0) anchor.internalScore! += 100;
            if (anchor.visionTexts && anchor.visionTexts.length > 0 && anchor.visionTexts[0].length < 60) anchor.internalScore! += 50;

            // Delay to respect rate limits (15 RPM = 4s)
            await new Promise(resolve => setTimeout(resolve, 4000));
          } catch (error: any) {
            if (error?.message === 'RATE_LIMIT_EXCEEDED') {
              skipVisionForRest = true;
              rateLimitHit = true;
            } else {
              console.error("Error analyzing image with Vision:", error);
            }
          }
        }

        // 4. Reverse Geocoding & Semantic Reconciliation for the Anchor
        if (anchor.lat && anchor.lng) {
          try {
            console.log(`[PROGRESO] Etapa 4: Obteniendo ubicación real para las coordenadas de ancla...`);
            const resolvedPlace = await withTimeout(
              spatialCacheService.resolveLocation(
                anchor.lat, 
                anchor.lng, 
                async (lat, lng) => {
                const googleMapsKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;
                if (!googleMapsKey) {
                  return "Error: Falta VITE_GOOGLE_MAPS_API_KEY";
                }

                try {
                  // Integración nativa con Google Places API (New)
                  const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Goog-Api-Key': googleMapsKey,
                      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.types'
                    },
                    body: JSON.stringify({
                      includedPrimaryTypes: [],
                      maxResultCount: 1,
                      locationRestriction: {
                        circle: {
                          center: { latitude: lat, longitude: lng },
                          radius: 50.0 // Búsqueda de alta precisión (~50 metros)
                        }
                      }
                    })
                  });

                  if (!response.ok) {
                    throw new Error(`Google Places API Error: ${response.status}`);
                  }

                  const data = await response.json();

                  if (data.places && data.places.length > 0) {
                    const place = data.places[0];
                    const placeName = place.displayName?.text;
                    const address = place.formattedAddress;
                    
                    let baseLocation = placeName || address || "Ubicación sin nombre";

                    if (!skipVisionForRest && (anchor.visionLandmarks?.length || anchor.visionTexts?.length || anchor.visionLabels?.length)) {
                      try {
                        const reconciled = await reconcileLocation(lat, lng, baseLocation, {
                          landmarks: anchor.visionLandmarks || [],
                          texts: anchor.visionTexts || [],
                          labels: anchor.visionLabels || []
                        });
                        if (reconciled && reconciled !== baseLocation) {
                          baseLocation = `${reconciled} (${address || baseLocation})`;
                        }
                        await new Promise(resolve => setTimeout(resolve, 4000));
                      } catch (error: any) {
                        if (error?.message === 'RATE_LIMIT_EXCEEDED') {
                          skipVisionForRest = true;
                          rateLimitHit = true;
                        }
                      }
                    }
                    return baseLocation;
                  }
                  return "Ubicación no encontrada";
                } catch (error) {
                  console.error("Google Places fetch error:", error);
                  return "Error en API de lugares";
                }
              }
            ), 10000, { h3Index: '', roundedLat: 0, roundedLng: 0, locationName: "Excedió tiempo de búsqueda", source: 'api' }, 'resolveLocation');
            
            clusterPhotos.forEach(p => {
              p.locationName = resolvedPlace.locationName;
              p.resolutionSource = resolvedPlace.source;
            });
          } catch (error) {
            console.error("Reverse geocoding error:", error);
            clusterPhotos.forEach(p => {
              p.locationName = `Coordenadas: ${anchor.lat?.toFixed(4)}, ${anchor.lng?.toFixed(4)}`;
            });
          }
        } else if (anchor.visionLandmarks?.length || anchor.visionTexts?.length) {
          try {
            const searchQuery = anchor.visionLandmarks?.length ? anchor.visionLandmarks[0] : anchor.visionTexts![0];
            let locationName = `Ubicación inferida: ${searchQuery}`;
            
            clusterPhotos.forEach(p => {
              p.locationName = locationName;
            });
          } catch (error) {
            console.error("Error in Semantic Reconciliation:", error);
            clusterPhotos.forEach(p => {
              p.locationName = "Ubicación Desconocida";
            });
          }
        } else {
          clusterPhotos.forEach(p => {
            p.locationName = "Ubicación Desconocida";
          });
        }
      }
    }

    if (rateLimitHit) {
      setRateLimitError(true);
    }

    // Build clusters for UI
    const newClusters: Record<string, PhotoCluster> = {};
    const newSelectedDestinations: Record<string, string> = {};

    newPhotos.forEach(photo => {
      if (photo.clusterId) {
        if (!newClusters[photo.clusterId]) {
          const anchor = newPhotos.find(p => p.id === photo.clusterId)!;
          const locationName = photo.locationName || "Ubicación Desconocida";
          newClusters[photo.clusterId] = {
            id: photo.clusterId,
            anchorPhoto: anchor,
            photos: [],
            locationName: locationName
          };

          // Auto-match destination
          if (trip.destinations) {
            const matchedDest = trip.destinations.find(d => 
              locationName.toLowerCase().includes(d.name.toLowerCase()) ||
              d.name.toLowerCase().includes(locationName.toLowerCase())
            );
            if (matchedDest) {
              newSelectedDestinations[photo.clusterId] = matchedDest.id;
            }
          }
        }
        newClusters[photo.clusterId].photos.push(photo);
      }
    });

    setPhotos(prev => [...prev, ...newPhotos]);
    setClusters(Object.values(newClusters));
    setSelectedDestinations(prev => ({ ...prev, ...newSelectedDestinations }));
    setIsProcessing(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    let files = Array.from(e.target.files) as File[];
    if (files.length > 50) {
      setFileLimitWarning(true);
      files = files.slice(0, 50);
    } else {
      setFileLimitWarning(false);
    }
    
    await processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      let imageFiles = (Array.from(e.dataTransfer.files) as File[]).filter(file => 
        file.type.startsWith('image/')
      );
      
      if (imageFiles.length > 50) {
        setFileLimitWarning(true);
        imageFiles = imageFiles.slice(0, 50);
      } else {
        setFileLimitWarning(false);
      }
      
      if (imageFiles.length > 0) {
        await processFiles(imageFiles);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <h2 className="text-xl font-semibold text-white">Importar Múltiples Fotos</h2>
          <Link to={`/trip/${trip.id}`} className="text-gray-500 hover:text-white">
            <X className="w-6 h-6" />
          </Link>
        </div>

        {/* Drag & Drop */}
        <div 
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 hover:border-gray-500'}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Cloud className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-white font-medium text-lg">Arrastra fotos aquí o haz clic para seleccionar</p>
          <p className="text-gray-500 text-sm mt-2 max-w-lg mx-auto">
            (Se extraerán automáticamente fecha, ubicación y lugar. Puede tardar varios minutos pero el resultado valdrá la pena, ten paciencia por favor)
          </p>
          <input 
            type="file" 
            multiple 
            accept="image/jpeg, image/png, image/heic" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>

        {isProcessing && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-4" />
            <p className="text-gray-400">Procesando fotos y extrayendo metadatos...</p>
          </div>
        )}

        {fileLimitWarning && (
          <div className="bg-blue-500/10 border border-blue-500/50 text-blue-200 p-4 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium">Límite de fotos alcanzado</h3>
              <p className="text-sm opacity-80 mt-1">
                Para garantizar un buen rendimiento y no exceder la cuota, solo se procesarán las primeras 50 fotos seleccionadas.
              </p>
            </div>
          </div>
        )}

        {rateLimitError && (
          <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-200 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium">Límite de cuota de IA excedido</h3>
              <p className="text-sm opacity-80 mt-1">
                Se ha alcanzado el límite de análisis inteligente. Algunas fotos se han subido sin detección automática de lugares (Landmarks).
              </p>
            </div>
          </div>
        )}

        {/* Clusters / Smart Location */}
        {!isProcessing && clusters.length > 0 && (
          <div className="space-y-8">
            {clusters.map(cluster => (
              <div key={cluster.id} className="space-y-4">
                {/* Ubicación Inteligente Box */}
                <div className="bg-white rounded-xl p-4 shadow-lg">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-blue-600 text-xs font-bold tracking-wider uppercase mb-1">Ubicación Inteligente</p>
                      <h3 className="text-2xl font-bold text-gray-900">{cluster.locationName}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md flex items-center gap-2 text-sm font-medium">
                        <AlertTriangle className="w-4 h-4" />
                        Confianza: {(cluster.anchorPhoto.internalScore || 0) >= 100 ? 'Alta' : 'Media'}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <FolderInput className="w-4 h-4 text-gray-500" />
                        <select
                          value={selectedDestinations[cluster.id] || ''}
                          onChange={(e) => setSelectedDestinations(prev => ({ ...prev, [cluster.id]: e.target.value }))}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">No exportar</option>
                          {trip.destinations?.map(d => (
                            <option key={d.id} value={d.id}>Exportar a {d.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {cluster.photos.map(p => (
                      <div key={p.id} className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-gray-200">
                        <img src={p.url} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=400&auto=format&fit=crop'; }} />
                        {p.isAnchor && (
                          <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white text-[8px] font-bold text-center py-0.5">
                            ANCLA
                          </div>
                        )}
                        <div className="absolute bottom-0.5 right-0.5">
                          <MapPin className="w-3 h-3 text-blue-500 drop-shadow-md" />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2 text-sm text-yellow-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p><strong>Sugerencia:</strong> El sistema tiene dudas. Revisa las fotos sin "Ancla" o agrega una manualmente.</p>
                  </div>
                </div>

                {/* Photo List */}
                <div className="space-y-2">
                  {cluster.photos.map(photo => (
                    <div key={photo.id} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 flex gap-4 items-center">
                      <img src={photo.url} className="w-16 h-16 rounded-md object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=400&auto=format&fit=crop'; }} />
                      
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        {/* Left Col: File Info */}
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-200 truncate">{photo.file.name}</p>
                          <p className="text-xs text-gray-400">
                            {photo.date ? new Date(photo.date).toLocaleString() : 'Fecha desconocida'}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            {photo.lat ? `${photo.lat.toFixed(6)}, ${photo.lng?.toFixed(6)}` : 'Sin GPS'}
                          </p>
                        </div>
                        
                        {/* Right Col: Location Info */}
                        <div className="space-y-2">
                          <div className="bg-[#2a2a2a] border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 truncate flex justify-between items-center">
                            <span className="truncate">{photo.locationName}</span>
                            <Search className="w-4 h-4 text-gray-500 shrink-0 ml-2 cursor-pointer hover:text-white" />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {photo.isAnchor && (
                              <span className="bg-blue-900/50 text-blue-400 border border-blue-800/50 text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Ancla
                              </span>
                            )}
                            {photo.lat && !photo.inherited && (
                              <span className="bg-green-900/50 text-green-400 border border-green-800/50 text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> GPS
                              </span>
                            )}
                            {photo.inherited && (
                              <span className="bg-purple-900/50 text-purple-400 border border-purple-800/50 text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Heredada
                              </span>
                            )}
                            {photo.resolutionSource === 'cache' && (
                              <span className="text-xs text-green-500 flex items-center gap-1 ml-2">
                                ✓ Resolviendo lote... (Caché)
                              </span>
                            )}
                            {photo.resolutionSource === 'api' && (
                              <span className="text-xs text-blue-500 flex items-center gap-1 ml-2">
                                ✓ Resolviendo lote... (API)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {!isProcessing && clusters.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <label className="text-sm text-gray-400 whitespace-nowrap">Descripción Común (Opcional):</label>
              <input 
                type="text" 
                placeholder="Ej: Cena en Mendoza" 
                className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => { setPhotos([]); setClusters([]); }}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveAll}
                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Guardar Todo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
