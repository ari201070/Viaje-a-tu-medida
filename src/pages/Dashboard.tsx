import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus, Map, Trash2 } from 'lucide-react';
import { useTripStore } from '../store/useTripStore';

export default function Dashboard() {
  const { t } = useTranslation();
  const { trips, addTrip, loadExampleTrip, deleteTrip } = useTripStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState('');
  const [newTripDesc, setNewTripDesc] = useState('');

  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripTitle.trim()) return;
    
    addTrip({
      title: newTripTitle,
      description: newTripDesc,
      userId: null, // Local mode for now
    });
    
    setNewTripTitle('');
    setNewTripDesc('');
    setIsCreating(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('my_trips')}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={loadExampleTrip}
            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            {t('load_example_trip')}
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t('create_new_trip')}
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <form onSubmit={handleCreateTrip} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">{t('trip_title')}</label>
              <input
                id="title"
                type="text"
                value={newTripTitle}
                onChange={(e) => setNewTripTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="Ej. Viaje a la Patagonia"
                required
              />
            </div>
            <div>
              <label htmlFor="desc" className="block text-sm font-medium text-gray-700 mb-1">{t('trip_description')}</label>
              <textarea
                id="desc"
                value={newTripDesc}
                onChange={(e) => setNewTripDesc(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none h-24"
                placeholder="Ej. Aventura de 15 días explorando lagos y montañas..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {t('create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {trips.length === 0 && !isCreating ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
          <Map className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">{t('no_trips_yet')}</h3>
          <p className="text-gray-500">{t('start_planning')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => (
            <div key={trip.id} className="group relative bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
              <Link to={`/trip/${trip.id}`} className="block">
                <div className="h-48 bg-gray-200 relative overflow-hidden">
                  {trip.coverImage ? (
                    <img src={trip.coverImage} alt={trip.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                      <Map className="w-10 h-10 text-indigo-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h3 className="text-xl font-bold line-clamp-1">{trip.title}</h3>
                    <p className="text-sm text-white/80 line-clamp-1 mt-1">{trip.description}</p>
                  </div>
                </div>
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (window.confirm(t('confirm_delete'))) {
                    deleteTrip(trip.id);
                  }
                }}
                className="absolute top-3 right-3 p-2 bg-white/90 text-red-600 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all shadow-sm"
                title={t('delete_trip')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
