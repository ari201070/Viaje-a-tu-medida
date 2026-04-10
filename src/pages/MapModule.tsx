import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { ArrowLeft, Search, MapPin, Trash2, Loader2 } from 'lucide-react';
import { useTripStore } from '../store/useTripStore';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React Leaflet
import L from 'leaflet';

let DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Component to recenter map when destinations change
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

export default function MapModule() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const trip = useTripStore((state) => state.trips.find((t) => t.id === id));
  const { addDestination, removeDestination } = useTripStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  if (!trip) return null;

  const destinations = trip.destinations || [];
  const mapCenter: [number, number] = destinations.length > 0 
    ? [destinations[0].lat, destinations[0].lng] 
    : [20, 0]; // Default world view

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Error searching location:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddDestination = (result: any) => {
    addDestination(trip.id, {
      name: result.display_name.split(',')[0], // Take the first part as name
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon)
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6">
      {/* Sidebar */}
      <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 mb-2">
          <Link to={`/trip/${trip.id}`} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-xl font-bold text-gray-900">{t('map_module')}</h2>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_location')}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          <button 
            type="submit" 
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-2 top-1.5 p-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </form>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="flex-1 overflow-y-auto border border-gray-100 rounded-lg bg-gray-50 p-2 space-y-2">
            {searchResults.map((result, idx) => (
              <button
                key={idx}
                onClick={() => handleAddDestination(result)}
                className="w-full text-left p-3 bg-white rounded border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all text-sm"
              >
                <div className="font-medium text-gray-900">{result.display_name.split(',')[0]}</div>
                <div className="text-xs text-gray-500 truncate">{result.display_name}</div>
              </button>
            ))}
          </div>
        )}

        {/* Destinations List */}
        {searchResults.length === 0 && (
          <div className="flex-1 overflow-y-auto mt-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('my_destinations')}</h3>
            {destinations.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('no_destinations')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {destinations.map((dest) => (
                  <div key={dest.id} className="flex flex-col p-3 bg-gray-50 rounded-lg border border-gray-100 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <MapPin className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                        <span className="font-medium text-gray-900 truncate">{dest.name}</span>
                      </div>
                      <button
                        onClick={() => removeDestination(trip.id, dest.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {((dest.placesList && dest.placesList.length > 0) || (dest.places && dest.places.length > 0)) && (
                      <ul className="mt-2 pl-8 space-y-1">
                        {(dest.placesList || dest.places?.map((p, i) => ({ id: `legacy-${i}`, name: p })) || []).map(place => (
                          <li key={place.id} className="text-sm text-gray-600 flex items-center gap-2">
                            <span className="w-1 h-1 bg-indigo-300 rounded-full"></span>
                            {place.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map Area */}
      <div className="flex-1 bg-gray-200 rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative z-0">
        <MapContainer 
          center={mapCenter} 
          zoom={destinations.length > 0 ? 5 : 2} 
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {destinations.length > 0 && <MapUpdater center={mapCenter} />}
          {destinations.map((dest) => (
            <React.Fragment key={`group-${dest.id}`}>
              <Marker key={dest.id} position={[dest.lat, dest.lng]}>
                <Popup>
                  <div className="font-medium text-base mb-1">{dest.name}</div>
                  {((dest.placesList && dest.placesList.length > 0) || (dest.places && dest.places.length > 0)) && (
                    <ul className="pl-3 space-y-1 mt-2 border-l-2 border-indigo-200">
                      {(dest.placesList || dest.places?.map((p, i) => ({ id: `legacy-${i}`, name: p })) || []).slice(0, 5).map(place => (
                        <li key={place.id} className="text-xs text-gray-600 list-disc">{place.name}</li>
                      ))}
                      {((dest.placesList?.length || dest.places?.length || 0) > 5) && (
                        <li className="text-xs text-gray-400 italic list-none mt-1">
                          + {(dest.placesList?.length || dest.places?.length || 0) - 5} más
                        </li>
                      )}
                    </ul>
                  )}
                  <Link to={`/trip/${trip.id}/destination/${dest.id}`} className="text-xs text-indigo-600 hover:underline mt-2 block">
                    Ver detalles
                  </Link>
                </Popup>
              </Marker>
              
              {/* Render markers for places that have coordinates */}
              {dest.placesList?.filter(p => p.lat && p.lng).map(place => (
                <Marker 
                  key={`place-${place.id}`} 
                  position={[place.lat!, place.lng!]}
                  icon={L.divIcon({
                    className: 'custom-place-marker',
                    html: `<div style="background-color: #4f46e5; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                  })}
                >
                  <Popup>
                    <div className="font-medium text-sm">{place.name}</div>
                    <div className="text-xs text-gray-500 mt-1">Lugar en {dest.name}</div>
                    {place.url && (
                      <a href={place.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline mt-2 block">
                        Ver en Google Maps
                      </a>
                    )}
                  </Popup>
                </Marker>
              ))}

              {/* Render markers for restaurants that have coordinates */}
              {dest.restaurants?.filter(r => r.lat && r.lng).map(restaurant => (
                <Marker 
                  key={`restaurant-${restaurant.id}`} 
                  position={[restaurant.lat!, restaurant.lng!]}
                  icon={L.divIcon({
                    className: 'custom-restaurant-marker',
                    html: `<div style="background-color: #f97316; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                  })}
                >
                  <Popup>
                    <div className="font-medium text-sm">{restaurant.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{restaurant.type} en {dest.name}</div>
                    {restaurant.url && (
                      <a href={restaurant.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline mt-2 block">
                        Ver en Google Maps
                      </a>
                    )}
                  </Popup>
                </Marker>
              ))}
            </React.Fragment>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
