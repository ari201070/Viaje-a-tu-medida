import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Calendar, MapPin, Activity, Utensils, Home, Bot, Plus, Trash2, Image as ImageIcon, ExternalLink, Check, X, Upload, Loader2, Plane, Pencil, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { useTripStore } from '../store/useTripStore';
import { Place, Restaurant, Lodging, Transport } from '../types';
import { extractLodgingReservation, extractTransportReservation } from '../services/visionService';

// Fix for default marker icons in React Leaflet
import L from 'leaflet';

let DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper component for list sections (Legacy)
const ListSection = ({ title, icon: Icon, iconColor, items, onUpdate, placeholder }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    if (newItem.trim()) {
      onUpdate([...(items || []), newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemove = (index: number) => {
    const newItems = [...(items || [])];
    newItems.splice(index, 1);
    onUpdate(newItems);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Icon className={`w-6 h-6 ${iconColor}`} />
          {title}
        </h3>
        <button onClick={() => setIsEditing(!isEditing)} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          {isEditing ? 'Hecho' : 'Editar'}
        </button>
      </div>
      
      <ul className="space-y-3 text-gray-600 mb-4">
        {(!items || items.length === 0) && !isEditing && (
          <li className="text-gray-400 italic">{placeholder}</li>
        )}
        {items?.map((item: string, idx: number) => (
          <li key={idx} className="flex items-start justify-between group">
            <span className="flex gap-2"><span className="text-indigo-400">•</span> {item}</span>
            {isEditing && (
              <button onClick={() => handleRemove(idx)} className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {isEditing && (
        <div className="flex gap-2 mt-4">
          <input 
            type="text" 
            value={newItem} 
            onChange={e => setNewItem(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Agregar nuevo..." 
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button onClick={handleAdd} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors flex items-center gap-1">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
      )}
    </div>
  );
};

// Helper component for text sections
const TextSection = ({ title, icon: Icon, iconColor, text, onUpdate, placeholder }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(text || '');

  const handleSave = () => {
    onUpdate(value);
    setIsEditing(false);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Icon className={`w-6 h-6 ${iconColor}`} />
          {title}
        </h3>
        <button onClick={() => setIsEditing(!isEditing)} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          {isEditing ? 'Cancelar' : 'Editar'}
        </button>
      </div>
      
      {isEditing ? (
        <div className="space-y-3">
          <textarea 
            value={value} 
            onChange={e => setValue(e.target.value)} 
            className="w-full border border-gray-300 rounded-lg p-3 text-sm min-h-[120px] focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
            placeholder={placeholder}
          />
          <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            Guardar
          </button>
        </div>
      ) : (
        <div className="text-gray-600 whitespace-pre-wrap leading-relaxed">
          {text ? text : <span className="text-gray-400 italic">{placeholder}</span>}
        </div>
      )}
    </div>
  );
};

const PlacesSection = ({ title, icon: Icon, iconColor, destination, tripId, updateDestinationDetails }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newLat, setNewLat] = useState<number | undefined>(undefined);
  const [newLng, setNewLng] = useState<number | undefined>(undefined);

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const items: Place[] = destination.placesList || (destination.places ? destination.places.map((p: string, i: number) => ({ id: `legacy-${i}`, name: p })) : []);

  const handleSearch = (query: string) => {
    setNewName(query);
    setNewLat(undefined);
    setNewLng(undefined);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', ' + destination.name)}&limit=5`);
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error("Error searching place:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const handleSelectResult = (result: any) => {
    setNewName(result.display_name.split(',')[0]);
    setNewLat(parseFloat(result.lat));
    setNewLng(parseFloat(result.lon));
    setNewUrl(`https://www.google.com/maps/search/?api=1&query=${result.lat},${result.lon}`);
    setSearchResults([]);
  };

  const handleAdd = () => {
    if (newName.trim()) {
      const newItem: Place = { 
        id: Date.now().toString(), 
        name: newName.trim(), 
        url: newUrl.trim(),
        lat: newLat,
        lng: newLng
      };
      updateDestinationDetails(tripId, destination.id, { placesList: [...items, newItem] });
      setNewName('');
      setNewUrl('');
      setNewLat(undefined);
      setNewLng(undefined);
      setSearchResults([]);
    }
  };

  const handleRemove = (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    updateDestinationDetails(tripId, destination.id, { placesList: newItems });
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Icon className={`w-6 h-6 ${iconColor}`} />
          {title}
        </h3>
        <button onClick={() => setIsEditing(!isEditing)} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          {isEditing ? 'Hecho' : 'Editar'}
        </button>
      </div>
      
      <ul className="space-y-3 text-gray-600 mb-4">
        {items.length === 0 && !isEditing && (
          <li className="text-gray-400 italic">Agrega lugares que no te puedes perder...</li>
        )}
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between group py-1">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-indigo-400 flex-shrink-0">•</span>
              <a 
                href={item.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${destination.name}`)}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-indigo-600 hover:underline flex items-center gap-1 truncate"
                title={item.name}
              >
                <span className="truncate">{item.name}</span> <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
            {isEditing && (
              <button onClick={() => handleRemove(item.id)} className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {isEditing && (
        <div className="flex flex-col gap-2 mt-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
          <div className="relative">
            <input 
              type="text" 
              value={newName} 
              onChange={e => handleSearch(e.target.value)} 
              placeholder="Nombre del lugar..." 
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none pr-8"
            />
            {isSearching && (
              <div className="absolute right-2 top-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectResult(result)}
                    className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm border-b border-gray-100 last:border-0"
                  >
                    <div className="font-medium text-gray-900">{result.display_name.split(',')[0]}</div>
                    <div className="text-xs text-gray-500 truncate">{result.display_name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input 
            type="url" 
            value={newUrl} 
            onChange={e => setNewUrl(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="URL (opcional)..." 
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button onClick={handleAdd} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1 mt-1">
            <Plus className="w-4 h-4" /> Agregar Lugar
          </button>
        </div>
      )}
    </div>
  );
};

const RestaurantsSection = ({ title, icon: Icon, iconColor, destination, tripId, updateDestinationDetails }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [glutenFree, setGlutenFree] = useState(false);
  const [sugarFree, setSugarFree] = useState(false);
  const [newLat, setNewLat] = useState<number | undefined>(undefined);
  const [newLng, setNewLng] = useState<number | undefined>(undefined);
  
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const items: Restaurant[] = destination.restaurants || [];

  const handleEditClick = (item: Restaurant) => {
    setEditingId(item.id);
    setNewName(item.name);
    setNewType(item.type);
    setNewUrl(item.url || '');
    setGlutenFree(item.glutenFree);
    setSugarFree(item.sugarFree);
    setNewLat(item.lat);
    setNewLng(item.lng);
    setSearchResults([]);
  };

  const handleSearch = (query: string) => {
    setNewName(query);
    setNewLat(undefined);
    setNewLng(undefined);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', ' + destination.name)}&limit=5`);
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error("Error searching restaurant:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const handleSelectResult = (result: any) => {
    setNewName(result.display_name.split(',')[0]);
    if (result.type && result.type !== 'yes') {
      const typeMap: Record<string, string> = {
        'restaurant': 'Restaurante',
        'cafe': 'Cafetería',
        'fast_food': 'Comida Rápida',
        'bar': 'Bar',
        'pub': 'Pub',
        'ice_cream': 'Heladería'
      };
      setNewType(typeMap[result.type] || result.type);
    }
    setNewLat(parseFloat(result.lat));
    setNewLng(parseFloat(result.lon));
    setNewUrl(`https://www.google.com/maps/search/?api=1&query=${result.lat},${result.lon}`);
    setSearchResults([]);
  };

  const handleAdd = () => {
    if (newName.trim()) {
      const newItem: Restaurant = { 
        id: editingId || Date.now().toString(), 
        name: newName.trim(), 
        type: newType.trim() || 'Restaurante',
        url: newUrl.trim(),
        glutenFree,
        sugarFree,
        lat: newLat,
        lng: newLng
      };
      
      let newItems;
      if (editingId) {
        newItems = items.map(item => item.id === editingId ? newItem : item);
      } else {
        newItems = [...items, newItem];
      }
      
      updateDestinationDetails(tripId, destination.id, { restaurants: newItems });
      setNewName('');
      setNewType('');
      setNewUrl('');
      setGlutenFree(false);
      setSugarFree(false);
      setNewLat(undefined);
      setNewLng(undefined);
      setSearchResults([]);
      setEditingId(null);
    }
  };

  const handleRemove = (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    updateDestinationDetails(tripId, destination.id, { restaurants: newItems });
    if (editingId === id) {
      setEditingId(null);
      setNewName('');
      setNewType('');
      setNewUrl('');
      setGlutenFree(false);
      setSugarFree(false);
      setNewLat(undefined);
      setNewLng(undefined);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Icon className={`w-6 h-6 ${iconColor}`} />
          {title}
        </h3>
        <button onClick={() => {
          setIsEditing(!isEditing);
          if (isEditing) {
            setEditingId(null);
            setNewName('');
            setNewType('');
            setNewUrl('');
            setGlutenFree(false);
            setSugarFree(false);
            setNewLat(undefined);
            setNewLng(undefined);
          }
        }} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          {isEditing ? 'Hecho' : 'Editar'}
        </button>
      </div>
      
      {destination.gastronomy && !isEditing && items.length === 0 && (
        <div className="text-gray-600 whitespace-pre-wrap leading-relaxed mb-4">
          {destination.gastronomy}
        </div>
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-indigo-700 uppercase bg-indigo-50/50">
              <tr>
                <th className="px-3 py-3 rounded-tl-lg">Restaurante</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-2 py-3 text-center">Sin Gluten</th>
                <th className="px-2 py-3 text-center">Sin Azúcar</th>
                {isEditing && <th className="px-3 py-3 rounded-tr-lg text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={`bg-white border-b border-gray-100 hover:bg-gray-50 ${editingId === item.id ? 'bg-indigo-50/30' : ''}`}>
                  <td className="px-3 py-3 font-medium text-indigo-600 max-w-[150px] sm:max-w-[200px]">
                    {item.url ? (
                      <a href={item.url.startsWith('http') ? item.url : `https://${item.url}`} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1 truncate" title={item.name}>
                        <span className="truncate">{item.name}</span> <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="truncate block" title={item.name}>{item.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-600 truncate max-w-[100px]" title={item.type}>{item.type}</td>
                  <td className="px-2 py-3 text-center">
                    {item.glutenFree ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <X className="w-4 h-4 text-red-400 mx-auto" />}
                  </td>
                  <td className="px-2 py-3 text-center">
                    {item.sugarFree ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <X className="w-4 h-4 text-red-400 mx-auto" />}
                  </td>
                  {isEditing && (
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEditClick(item)} className="text-gray-400 hover:text-indigo-600 p-1 rounded transition-colors" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleRemove(item.id)} className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && !isEditing && !destination.gastronomy && (
        <p className="text-gray-400 italic">Agrega restaurantes recomendados...</p>
      )}

      {isEditing && (
        <div className="flex flex-col gap-3 mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
            <div className="relative">
              <input 
                type="text" 
                value={newName} 
                onChange={e => handleSearch(e.target.value)} 
                placeholder="Nombre del restaurante..." 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none pr-8"
              />
              {isSearching && (
                <div className="absolute right-2 top-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectResult(result)}
                      className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm border-b border-gray-100 last:border-0"
                    >
                      <div className="font-medium text-gray-900">{result.display_name.split(',')[0]}</div>
                      <div className="text-xs text-gray-500 truncate">{result.display_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input 
              type="text" 
              value={newType} 
              onChange={e => setNewType(e.target.value)} 
              placeholder="Tipo (ej. Parrilla, Vegano)..." 
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <input 
            type="text" 
            value={newUrl} 
            onChange={e => setNewUrl(e.target.value)} 
            placeholder="URL o sitio web (opcional)..." 
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <div className="flex items-center gap-6 px-1">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={glutenFree} onChange={e => setGlutenFree(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
              Sin Gluten
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={sugarFree} onChange={e => setSugarFree(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
              Sin Azúcar
            </label>
          </div>
          <button onClick={handleAdd} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1 mt-1">
            {editingId ? (
              <>
                <Check className="w-4 h-4" /> Guardar Cambios
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Agregar Restaurante
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

const LodgingsSection = ({ title, icon: Icon, iconColor, destination, tripId, updateDestinationDetails }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCheckIn, setNewCheckIn] = useState('');
  const [newCheckOut, setNewCheckOut] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const items: Lodging[] = destination.lodgings || (destination.lodging ? destination.lodging.map((l: string, i: number) => ({ id: `legacy-${i}`, name: l })) : []);

  const handleAdd = () => {
    if (newName.trim()) {
      const newItem: Lodging = { 
        id: Date.now().toString(), 
        name: newName.trim(),
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        address: newAddress
      };
      updateDestinationDetails(tripId, destination.id, { lodgings: [...items, newItem] });
      setNewName('');
      setNewCheckIn('');
      setNewCheckOut('');
      setNewAddress('');
      setIsEditing(false);
    }
  };

  const handleRemove = (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    updateDestinationDetails(tripId, destination.id, { lodgings: newItems });
  };

  const handleFileUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newItems = items.map(item => 
          item.id === id ? { ...item, documentUrl: reader.result as string } : item
        );
        updateDestinationDetails(tripId, destination.id, { lodgings: newItems });
      };
      reader.readAsDataURL(file);
    }
  };

  const [isExtracting, setIsExtracting] = useState(false);

  const handleAutoFill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const result = await extractLodgingReservation(file);
      if (result) {
        if (result.name) setNewName(result.name);
        if (result.checkIn) {
          const match = result.checkIn.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
          setNewCheckIn(match ? match[1] : result.checkIn);
        }
        if (result.checkOut) {
          const match = result.checkOut.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
          setNewCheckOut(match ? match[1] : result.checkOut);
        }
        if (result.address) setNewAddress(result.address);
      } else {
        alert("No se pudo extraer la información de la reserva. Por favor, revisa el archivo e intenta de nuevo.");
      }
    } catch (error) {
      console.error("Error auto-filling:", error);
      alert("Ocurrió un error al procesar la reserva.");
    } finally {
      setIsExtracting(false);
      e.target.value = ''; // Reset input so the same file can be selected again
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Icon className={`w-6 h-6 ${iconColor}`} />
          {title}
        </h3>
        <button onClick={() => setIsEditing(!isEditing)} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          {isEditing ? 'Cancelar' : 'Editar'}
        </button>
      </div>
      
      <div className="space-y-4 mb-4">
        {items.length === 0 && !isEditing && (
          <p className="text-gray-400 italic">Agrega hoteles, hostales o alojamientos...</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 relative group">
            {isEditing && (
              <button onClick={() => handleRemove(item.id)} className="absolute top-3 right-3 text-gray-400 hover:text-red-500 p-1 rounded transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <h4 className="font-bold text-lg text-gray-900 mb-2 pr-8">{item.name}</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Check in</p>
                <p className="font-medium text-gray-900">{item.checkIn ? new Date(item.checkIn).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'No especificado'}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Check out</p>
                <p className="font-medium text-gray-900">{item.checkOut ? new Date(item.checkOut).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'No especificado'}</p>
              </div>
              {item.address && (
                <div className="sm:col-span-2 flex items-start gap-2 mt-2">
                  <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-blue-600 hover:underline cursor-pointer">{item.address}</p>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2">
              {item.documentUrl ? (
                <div className="flex items-center gap-2">
                  <a href={item.documentUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-green-600 hover:text-green-700 flex items-center gap-1">
                    <Check className="w-4 h-4" /> Reserva subida (Ver)
                  </a>
                  <label className="text-sm font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer ml-2">
                    Cambiar
                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(item.id, e)} accept="image/*,.pdf" />
                  </label>
                </div>
              ) : (
                <label className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer">
                  <Upload className="w-4 h-4" /> Sube tu reserva (PDF/Foto)
                  <input type="file" className="hidden" onChange={(e) => handleFileUpload(item.id, e)} accept="image/*,.pdf" />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      {isEditing && (
        <div className="flex flex-col gap-3 mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-gray-700">Agregar Alojamiento</h4>
            <label className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 transition-colors">
              {isExtracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
              {isExtracting ? 'Extrayendo...' : 'Autocompletar con reserva'}
              <input type="file" className="hidden" onChange={handleAutoFill} accept="image/*,.pdf" disabled={isExtracting} />
            </label>
          </div>
          <input 
            type="text" 
            value={newName} 
            onChange={e => setNewName(e.target.value)} 
            placeholder="Nombre del alojamiento..." 
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Check-in</label>
              <input 
                type="datetime-local" 
                value={newCheckIn} 
                onChange={e => setNewCheckIn(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Check-out</label>
              <input 
                type="datetime-local" 
                value={newCheckOut} 
                onChange={e => setNewCheckOut(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          <input 
            type="text" 
            value={newAddress} 
            onChange={e => setNewAddress(e.target.value)} 
            placeholder="Dirección..." 
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button onClick={handleAdd} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1 mt-2">
            <Plus className="w-4 h-4" /> Guardar Alojamiento
          </button>
        </div>
      )}
    </div>
  );
};

const TransportsSection = ({ title, icon: Icon, iconColor, destination, tripId, updateDestinationDetails }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newType, setNewType] = useState<'flight' | 'train' | 'bus' | 'car' | 'other'>('flight');
  const [newProvider, setNewProvider] = useState('');
  const [newDepartureTime, setNewDepartureTime] = useState('');
  const [newArrivalTime, setNewArrivalTime] = useState('');
  const [newDepartureLocation, setNewDepartureLocation] = useState('');
  const [newArrivalLocation, setNewArrivalLocation] = useState('');
  const [newReservationCode, setNewReservationCode] = useState('');

  const items: Transport[] = destination.transports || [];

  const handleAdd = () => {
    if (newProvider.trim()) {
      const newItem: Transport = { 
        id: Date.now().toString(), 
        type: newType,
        provider: newProvider.trim(),
        departureTime: newDepartureTime,
        arrivalTime: newArrivalTime,
        departureLocation: newDepartureLocation,
        arrivalLocation: newArrivalLocation,
        reservationCode: newReservationCode
      };
      updateDestinationDetails(tripId, destination.id, { transports: [...items, newItem] });
      setNewProvider('');
      setNewDepartureTime('');
      setNewArrivalTime('');
      setNewDepartureLocation('');
      setNewArrivalLocation('');
      setNewReservationCode('');
      setIsEditing(false);
    }
  };

  const handleRemove = (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    updateDestinationDetails(tripId, destination.id, { transports: newItems });
  };

  const handleFileUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newItems = items.map(item => 
          item.id === id ? { ...item, documentUrl: reader.result as string } : item
        );
        updateDestinationDetails(tripId, destination.id, { transports: newItems });
      };
      reader.readAsDataURL(file);
    }
  };

  const [isExtracting, setIsExtracting] = useState(false);

  const handleAutoFill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const result = await extractTransportReservation(file);
      if (result) {
        if (result.type) setNewType(result.type);
        if (result.provider) setNewProvider(result.provider);
        if (result.departureTime) {
          const match = result.departureTime.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
          setNewDepartureTime(match ? match[1] : result.departureTime);
        }
        if (result.arrivalTime) {
          const match = result.arrivalTime.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
          setNewArrivalTime(match ? match[1] : result.arrivalTime);
        }
        if (result.departureLocation) setNewDepartureLocation(result.departureLocation);
        if (result.arrivalLocation) setNewArrivalLocation(result.arrivalLocation);
        if (result.reservationCode) setNewReservationCode(result.reservationCode);
      } else {
        alert("No se pudo extraer la información del ticket. Por favor, revisa el archivo e intenta de nuevo.");
      }
    } catch (error) {
      console.error("Error auto-filling:", error);
      alert("Ocurrió un error al procesar el ticket.");
    } finally {
      setIsExtracting(false);
      e.target.value = ''; // Reset input so the same file can be selected again
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Icon className={`w-6 h-6 ${iconColor}`} />
          {title}
        </h3>
        <button onClick={() => setIsEditing(!isEditing)} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          {isEditing ? 'Cancelar' : 'Editar'}
        </button>
      </div>
      
      <div className="space-y-4 mb-4">
        {items.length === 0 && !isEditing && (
          <p className="text-gray-400 italic">Agrega vuelos, trenes o transporte...</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 relative group">
            {isEditing && (
              <button onClick={() => handleRemove(item.id)} className="absolute top-3 right-3 text-gray-400 hover:text-red-500 p-1 rounded transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded uppercase">{item.type}</span>
              <h4 className="font-bold text-lg text-gray-900 pr-8">{item.provider}</h4>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mt-3">
              <div>
                <p className="text-gray-500 mb-1">Salida {item.departureLocation && `(${item.departureLocation})`}</p>
                <p className="font-medium text-gray-900">{item.departureTime ? new Date(item.departureTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'No especificado'}</p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Llegada {item.arrivalLocation && `(${item.arrivalLocation})`}</p>
                <p className="font-medium text-gray-900">{item.arrivalTime ? new Date(item.arrivalTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'No especificado'}</p>
              </div>
              {item.reservationCode && (
                <div className="sm:col-span-2 flex items-center gap-2 mt-1">
                  <span className="text-gray-500">Reserva / PNR:</span>
                  <span className="font-mono font-bold text-gray-800 bg-gray-200 px-2 py-0.5 rounded">{item.reservationCode}</span>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-2">
              {item.documentUrl ? (
                <div className="flex items-center gap-2">
                  <a href={item.documentUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-green-600 hover:text-green-700 flex items-center gap-1">
                    <Check className="w-4 h-4" /> Ticket subido (Ver)
                  </a>
                  <label className="text-sm font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer ml-2">
                    Cambiar
                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(item.id, e)} accept="image/*,.pdf" />
                  </label>
                </div>
              ) : (
                <label className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer">
                  <Upload className="w-4 h-4" /> Sube tu ticket (PDF/Foto)
                  <input type="file" className="hidden" onChange={(e) => handleFileUpload(item.id, e)} accept="image/*,.pdf" />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      {isEditing && (
        <div className="flex flex-col gap-3 mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-gray-700">Agregar Transporte</h4>
            <label className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 transition-colors">
              {isExtracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
              {isExtracting ? 'Extrayendo...' : 'Autocompletar con ticket'}
              <input type="file" className="hidden" onChange={handleAutoFill} accept="image/*,.pdf" disabled={isExtracting} />
            </label>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select 
              value={newType} 
              onChange={e => setNewType(e.target.value as any)} 
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="flight">Vuelo</option>
              <option value="train">Tren</option>
              <option value="bus">Bus</option>
              <option value="car">Auto / Alquiler</option>
              <option value="other">Otro</option>
            </select>
            <input 
              type="text" 
              value={newProvider} 
              onChange={e => setNewProvider(e.target.value)} 
              placeholder="Aerolínea o Empresa..." 
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Salida</label>
              <input 
                type="datetime-local" 
                value={newDepartureTime} 
                onChange={e => setNewDepartureTime(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Llegada</label>
              <input 
                type="datetime-local" 
                value={newArrivalTime} 
                onChange={e => setNewArrivalTime(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input 
              type="text" 
              value={newDepartureLocation} 
              onChange={e => setNewDepartureLocation(e.target.value)} 
              placeholder="Origen (ej. EZE, Retiro)..." 
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <input 
              type="text" 
              value={newArrivalLocation} 
              onChange={e => setNewArrivalLocation(e.target.value)} 
              placeholder="Destino (ej. BRC)..." 
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <input 
            type="text" 
            value={newReservationCode} 
            onChange={e => setNewReservationCode(e.target.value)} 
            placeholder="Código de Reserva / PNR..." 
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          
          <button onClick={handleAdd} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1 mt-2">
            <Plus className="w-4 h-4" /> Guardar Transporte
          </button>
        </div>
      )}
    </div>
  );
};

export default function DestinationDetails() {
  const { id, destId } = useParams<{ id: string; destId: string }>();
  const { t } = useTranslation();
  const trip = useTripStore((state) => state.trips.find((t) => t.id === id));
  const updateDestinationDetails = useTripStore((state) => state.updateDestinationDetails);
  
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [isEditingPhotos, setIsEditingPhotos] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(false);
  
  const removeDestinationPhoto = useTripStore(state => state.removeDestinationPhoto);

  const destination = trip?.destinations?.find(d => d.id === destId);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSlideshowPlaying && lightboxIndex !== null && destination?.photos?.length) {
      interval = setInterval(() => {
        setLightboxIndex((prev) => {
          if (prev === null || !destination.photos) return null;
          return (prev + 1) % destination.photos.length;
        });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isSlideshowPlaying, lightboxIndex, destination?.photos]);

  if (!trip) return null;
  
  if (!destination) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Destino no encontrado</h2>
        <Link to={`/trip/${trip.id}`} className="text-indigo-600 hover:underline flex items-center justify-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Volver al Viaje
        </Link>
      </div>
    );
  }

  const handleSaveDates = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateDestinationDetails(trip.id, destination.id, {
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
    });
    setIsEditingDates(false);
  };

  // Calculate duration
  let durationText = '(Por definir)';
  if (destination.startDate && destination.endDate) {
    const start = new Date(destination.startDate);
    const end = new Date(destination.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    durationText = `${diffDays} día${diffDays !== 1 ? 's' : ''}`;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header & Cover Image */}
      <div className="relative h-64 sm:h-80 rounded-3xl overflow-hidden shadow-lg">
        {destination.coverImage ? (
          <img 
            src={destination.coverImage} 
            alt={destination.name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <img 
            src={`https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=1200&auto=format&fit=crop`} 
            alt={destination.name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6 sm:p-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to={`/trip/${trip.id}`} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full backdrop-blur-sm transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2">{destination.name}</h1>
          {destination.description && <p className="text-white/80 text-lg max-w-2xl">{destination.description}</p>}
        </div>
      </div>

      {/* Content Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Content (Left Column) */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Dates & Duration */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-indigo-500" />
                {t('dates_and_duration')}
              </h3>
              <button onClick={() => setIsEditingDates(!isEditingDates)} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                {isEditingDates ? 'Cancelar' : 'Editar'}
              </button>
            </div>
            
            {isEditingDates ? (
              <form onSubmit={handleSaveDates} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Llegada</label>
                    <input 
                      type="date" 
                      name="startDate"
                      defaultValue={destination.startDate || ''} 
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Partida</label>
                    <input 
                      type="date" 
                      name="endDate"
                      defaultValue={destination.endDate || ''} 
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                  </div>
                </div>
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                  Guardar Fechas
                </button>
              </form>
            ) : (
              <div className="text-gray-600 space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="font-medium text-gray-700">Estancia:</span>
                  <span>{durationText}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="font-medium text-gray-700">Llegada:</span>
                  <span>{destination.startDate ? new Date(destination.startDate).toLocaleDateString() : '(Por definir)'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="font-medium text-gray-700">Partida:</span>
                  <span>{destination.endDate ? new Date(destination.endDate).toLocaleDateString() : '(Por definir)'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Must-See Places */}
          <PlacesSection 
            title={t('must_see_places')}
            icon={MapPin}
            iconColor="text-rose-500"
            destination={destination}
            tripId={trip.id}
            updateDestinationDetails={updateDestinationDetails}
          />

          {/* Recommended Activities */}
          <ListSection 
            title={t('recommended_activities')}
            icon={Activity}
            iconColor="text-amber-500"
            items={destination.activities}
            onUpdate={(activities: string[]) => updateDestinationDetails(trip.id, destination.id, { activities })}
            placeholder="Agrega actividades para hacer aquí..."
          />

          {/* Gastronomy */}
          <RestaurantsSection 
            title={t('gastronomy')}
            icon={Utensils}
            iconColor="text-orange-500"
            destination={destination}
            tripId={trip.id}
            updateDestinationDetails={updateDestinationDetails}
          />

          {/* Transport */}
          <TransportsSection 
            title="Transporte"
            icon={Plane}
            iconColor="text-sky-500"
            destination={destination}
            tripId={trip.id}
            updateDestinationDetails={updateDestinationDetails}
          />

          {/* Lodging */}
          <LodgingsSection 
            title={t('lodging')}
            icon={Home}
            iconColor="text-teal-500"
            destination={destination}
            tripId={trip.id}
            updateDestinationDetails={updateDestinationDetails}
          />

          {/* Photos */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ImageIcon className="w-6 h-6 text-purple-500" />
                Álbum de Fotos
              </h3>
              <div className="flex items-center gap-4">
                {destination.photos && destination.photos.length > 0 && (
                  <button 
                    onClick={() => setIsEditingPhotos(!isEditingPhotos)} 
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    {isEditingPhotos ? 'Hecho' : 'Editar'}
                  </button>
                )}
                <Link to={`/trip/${trip.id}/photos`} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Agregar Fotos
                </Link>
              </div>
            </div>
            
            {(!destination.photos || destination.photos.length === 0) ? (
              <div className="text-center py-8">
                <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No hay fotos en este destino.</p>
                <Link to={`/trip/${trip.id}/photos`} className="text-indigo-600 hover:underline text-sm mt-2 inline-block">
                  Importar fotos
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {destination.photos.map((photo, idx) => (
                  <div 
                    key={photo.id || idx} 
                    className="aspect-square rounded-xl overflow-hidden relative group cursor-pointer"
                    onClick={() => !isEditingPhotos && setLightboxIndex(idx)}
                  >
                    <img 
                      src={photo.url} 
                      alt="Destino" 
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=400&auto=format&fit=crop';
                      }}
                    />
                    {photo.locationName && !isEditingPhotos && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-[10px] font-medium truncate">{photo.locationName}</p>
                      </div>
                    )}
                    {isEditingPhotos && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDestinationPhoto(trip.id, destination.id, photo.id);
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors shadow-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lightbox */}
          {lightboxIndex !== null && destination.photos && (
            <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center backdrop-blur-sm">
              {/* Top Bar */}
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
                <div className="text-white/80 text-sm font-medium">
                  {lightboxIndex + 1} / {destination.photos.length}
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setIsSlideshowPlaying(!isSlideshowPlaying)}
                    className="text-white/80 hover:text-white transition-colors p-2"
                    title={isSlideshowPlaying ? "Pausar Slideshow" : "Reproducir Slideshow"}
                  >
                    {isSlideshowPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </button>
                  <button 
                    onClick={() => {
                      setLightboxIndex(null);
                      setIsSlideshowPlaying(false);
                    }}
                    className="text-white/80 hover:text-white transition-colors p-2"
                  >
                    <X className="w-8 h-8" />
                  </button>
                </div>
              </div>

              {/* Navigation Arrows */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev === null || prev === 0) ? destination.photos!.length - 1 : prev - 1);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 transition-colors z-10"
              >
                <ChevronLeft className="w-10 h-10" />
              </button>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev === null || prev === destination.photos!.length - 1) ? 0 : prev + 1);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 transition-colors z-10"
              >
                <ChevronRight className="w-10 h-10" />
              </button>

              {/* Main Image */}
              <div className="relative max-w-5xl w-full max-h-[80vh] flex items-center justify-center px-12">
                <img 
                  src={destination.photos[lightboxIndex].url} 
                  alt="Destino" 
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=400&auto=format&fit=crop';
                  }}
                />
                {destination.photos[lightboxIndex].locationName && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm backdrop-blur-md">
                    {destination.photos[lightboxIndex].locationName}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Sidebar (Right Column) */}
        <div className="space-y-6">
          {/* AI Assistant Promo */}
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-6 rounded-2xl shadow-sm text-white">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Bot className="w-6 h-6" />
              {t('ai_assistant')}
            </h3>
            <p className="text-white/80 mb-4 text-sm">
              Usa IA para encontrar eventos, festivales y lugares ocultos en {destination.name}.
            </p>
            <Link 
              to={`/trip/${trip.id}/ai`}
              className="block w-full py-2 bg-white text-indigo-600 font-semibold rounded-lg text-center hover:bg-gray-50 transition-colors"
            >
              Preguntar a Gemini
            </Link>
          </div>

          {/* Mini Map */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wider">Ubicación</h3>
            <div className="h-48 bg-gray-100 rounded-xl overflow-hidden relative z-0">
              <MapContainer 
                center={[destination.lat, destination.lng]} 
                zoom={12} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                scrollWheelZoom={false}
                dragging={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[destination.lat, destination.lng]} />
              </MapContainer>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
