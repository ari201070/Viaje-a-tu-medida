import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Map, DollarSign, Cloud, ListChecks, Bot, Plane, Image as ImageIcon, Camera, MapPin } from 'lucide-react';
import { useTripStore } from '../store/useTripStore';

export default function TripDetails() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const trip = useTripStore((state) => state.trips.find((t) => t.id === id));
  const updateTrip = useTripStore((state) => state.updateTrip);

  if (!trip) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Viaje no encontrado</h2>
        <Link to="/" className="text-indigo-600 hover:underline flex items-center justify-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Volver a Mis Viajes
        </Link>
      </div>
    );
  }

  const modules = [
    { id: 'map', name: t('map_module'), icon: Map, color: 'bg-blue-500', text: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'budget', name: t('budget_module'), icon: DollarSign, color: 'bg-green-500', text: 'text-green-500', bg: 'bg-green-50' },
    { id: 'packing', name: t('packing_module'), icon: ListChecks, color: 'bg-amber-500', text: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 'ai', name: t('ai_assistant'), icon: Bot, color: 'bg-purple-500', text: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'photos', name: 'Álbum', icon: ImageIcon, color: 'bg-teal-500', text: 'text-teal-500', bg: 'bg-teal-50' },
  ];

  const handleChangeCover = () => {
    const newUrl = window.prompt(t('enter_image_url'), trip.coverImage || '');
    if (newUrl !== null) {
      updateTrip(trip.id, { coverImage: newUrl });
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Cover Image */}
      <div className="relative h-64 sm:h-80 md:h-96 rounded-3xl overflow-hidden shadow-lg group">
        {trip.coverImage ? (
          <img 
            src={trip.coverImage} 
            alt={trip.title} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <ImageIcon className="w-20 h-20 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6 sm:p-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/" className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full backdrop-blur-sm transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2">{trip.title}</h1>
          {trip.description && <p className="text-white/80 text-lg max-w-2xl">{trip.description}</p>}
        </div>
        
        <button 
          onClick={handleChangeCover}
          className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Camera className="w-4 h-4" />
          <span className="hidden sm:inline">{t('change_cover')}</span>
        </button>
      </div>

      {/* Quick Actions (Modules) */}
      <div className="flex flex-wrap gap-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.id}
              to={`/trip/${trip.id}/${mod.id}`}
              className={`flex-1 min-w-[140px] flex items-center gap-3 p-4 rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-gray-300 transition-all group`}
            >
              <div className={`${mod.bg} ${mod.text} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="font-semibold text-gray-700">{mod.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Destinations Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-indigo-500" />
            {t('trip_destinations')}
          </h2>
          <Link 
            to={`/trip/${trip.id}/map`}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            {t('add_destination')}
          </Link>
        </div>

        {(!trip.destinations || trip.destinations.length === 0) ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-gray-200 border-dashed">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{t('no_destinations')}</p>
            <Link 
              to={`/trip/${trip.id}/map`}
              className="inline-block mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-lg hover:bg-indigo-100 transition-colors"
            >
              {t('add_destination')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {trip.destinations.map((dest) => (
              <Link 
                key={dest.id}
                to={`/trip/${trip.id}/destination/${dest.id}`}
                className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden flex flex-col"
              >
                <div className="h-48 bg-gray-200 relative overflow-hidden">
                  {dest.coverImage ? (
                    <img 
                      src={dest.coverImage} 
                      alt={dest.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <img 
                      src={`https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=800&auto=format&fit=crop`} 
                      alt="Generic City" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <h3 className="absolute bottom-4 left-4 right-4 text-xl font-bold text-white">{dest.name}</h3>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  {((dest.placesList && dest.placesList.length > 0) || (dest.places && dest.places.length > 0)) ? (
                    <div className="mb-4 flex-1">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Lugares Imperdibles</h4>
                      <ul className="space-y-1">
                        {(dest.placesList || dest.places?.map((p, i) => ({ id: `legacy-${i}`, name: p })) || []).slice(0, 4).map(place => (
                          <li key={place.id} className="text-sm text-gray-700 flex items-center gap-2 truncate">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0"></span>
                            <span className="truncate">{place.name}</span>
                          </li>
                        ))}
                        {((dest.placesList?.length || dest.places?.length || 0) > 4) && (
                          <li className="text-xs text-gray-500 italic mt-1">
                            + {(dest.placesList?.length || dest.places?.length || 0) - 4} lugares más...
                          </li>
                        )}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm line-clamp-2 mb-4 flex-1">
                      {dest.description || dest.notes || t('explore_details')}
                    </p>
                  )}
                  <div className="text-indigo-600 font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all mt-auto pt-2 border-t border-gray-100">
                    {t('explore_details')} <ArrowLeft className="w-4 h-4 rotate-180" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
