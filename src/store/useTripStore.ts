import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { get, set, del } from 'idb-keyval';
import { Trip, Destination, Expense, PackingItem } from '../types';

// Custom storage object using IndexedDB
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const idbValue = await get(name);
    const localValue = localStorage.getItem(name);
    
    if (localValue) {
      try {
        const localData = JSON.parse(localValue);
        const idbData = idbValue ? JSON.parse(idbValue as string) : null;
        
        const localDestCount = localData?.state?.trips?.reduce((acc: number, t: any) => acc + (t.destinations?.length || 0), 0) || 0;
        const idbDestCount = idbData?.state?.trips?.reduce((acc: number, t: any) => acc + (t.destinations?.length || 0), 0) || 0;
        
        // Si localStorage tiene más destinos, significa que el usuario perdió datos en la migración.
        // Restauramos desde localStorage para recuperar su itinerario completo.
        if (!idbValue || localDestCount > idbDestCount) {
          await set(name, localValue);
          return localValue;
        }
      } catch (e) {
        console.error("Error parsing storage during migration", e);
      }
    }
    
    return (idbValue as string) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

interface TripState {
  trips: Trip[];
  addTrip: (trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTrip: (id: string, data: Partial<Trip>) => void;
  deleteTrip: (id: string) => void;
  addDestination: (tripId: string, destination: Omit<Destination, 'id'>) => void;
  removeDestination: (tripId: string, destinationId: string) => void;
  updateDestinationDetails: (tripId: string, destId: string, details: Partial<Destination>) => void;
  addExpense: (tripId: string, expense: Omit<Expense, 'id'>) => void;
  removeExpense: (tripId: string, expenseId: string) => void;
  addPackingItem: (tripId: string, item: Omit<PackingItem, 'id' | 'isPacked'>) => void;
  togglePackingItem: (tripId: string, itemId: string) => void;
  removePackingItem: (tripId: string, itemId: string) => void;
  addDestinationPhotos: (tripId: string, destId: string, photos: any[]) => void;
  removeDestinationPhoto: (tripId: string, destId: string, photoId: string) => void;
  loadExampleTrip: () => void;
}

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      trips: [],
      addTrip: (tripData) => set((state) => ({
        trips: [
          ...state.trips,
          {
            ...tripData,
            id: uuidv4(),
            destinations: [],
            expenses: [],
            packingList: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        ]
      })),
      updateTrip: (id, data) => set((state) => ({
        trips: state.trips.map((trip) => 
          trip.id === id ? { ...trip, ...data, updatedAt: Date.now() } : trip
        )
      })),
      deleteTrip: (id) => set((state) => ({
        trips: state.trips.filter((trip) => trip.id !== id)
      })),
      addDestination: (tripId, destData) => set((state) => ({
        trips: state.trips.map((trip) => 
          trip.id === tripId 
            ? { 
                ...trip, 
                destinations: [...(trip.destinations || []), { ...destData, id: uuidv4() }],
                updatedAt: Date.now() 
              } 
            : trip
        )
      })),
      removeDestination: (tripId, destId) => set((state) => ({
        trips: state.trips.map((trip) => 
          trip.id === tripId 
            ? { 
                ...trip, 
                destinations: (trip.destinations || []).filter(d => d.id !== destId),
                updatedAt: Date.now() 
              } 
            : trip
        )
      })),
      updateDestinationDetails: (tripId, destId, details) => set((state) => ({
        trips: state.trips.map((trip) => 
          trip.id === tripId 
            ? { 
                ...trip, 
                destinations: (trip.destinations || []).map(d => 
                  d.id === destId ? { ...d, ...details } : d
                ),
                updatedAt: Date.now() 
              } 
            : trip
        )
      })),
      addExpense: (tripId, expenseData) => set((state) => ({
        trips: state.trips.map((trip) => 
          trip.id === tripId 
            ? { 
                ...trip, 
                expenses: [...(trip.expenses || []), { ...expenseData, id: uuidv4() }],
                updatedAt: Date.now() 
              } 
            : trip
        )
      })),
      removeExpense: (tripId, expenseId) => set((state) => ({
        trips: state.trips.map((trip) => 
          trip.id === tripId 
            ? { 
                ...trip, 
                expenses: (trip.expenses || []).filter(e => e.id !== expenseId),
                updatedAt: Date.now() 
              } 
            : trip
        )
      })),
      addPackingItem: (tripId, itemData) => set((state) => ({
        trips: state.trips.map((trip) => 
          trip.id === tripId 
            ? { 
                ...trip, 
                packingList: [...(trip.packingList || []), { ...itemData, id: uuidv4(), isPacked: false }],
                updatedAt: Date.now() 
              } 
            : trip
        )
      })),
      togglePackingItem: (tripId, itemId) => set((state) => ({
        trips: state.trips.map((trip) => 
          trip.id === tripId 
            ? { 
                ...trip, 
                packingList: (trip.packingList || []).map(item => 
                  item.id === itemId ? { ...item, isPacked: !item.isPacked } : item
                ),
                updatedAt: Date.now() 
              } 
            : trip
        )
      })),
      removePackingItem: (tripId, itemId) => set((state) => ({
        trips: state.trips.map((trip) => 
          trip.id === tripId 
            ? { 
                ...trip, 
                packingList: (trip.packingList || []).filter(i => i.id !== itemId),
                updatedAt: Date.now() 
              } 
            : trip
        )
      })),
      addDestinationPhotos: (tripId, destId, photos) => set((state) => ({
        trips: state.trips.map((trip) => 
          trip.id === tripId 
            ? { 
                ...trip, 
                destinations: (trip.destinations || []).map(d => 
                  d.id === destId ? { ...d, photos: [...(d.photos || []), ...photos] } : d
                ),
                updatedAt: Date.now() 
              } 
            : trip
        )
      })),
      removeDestinationPhoto: (tripId, destId, photoId) => set((state) => ({
        trips: state.trips.map((trip) => 
          trip.id === tripId 
            ? { 
                ...trip, 
                destinations: (trip.destinations || []).map(d => 
                  d.id === destId ? { ...d, photos: (d.photos || []).filter((p: any) => p.id !== photoId) } : d
                ),
                updatedAt: Date.now() 
              } 
            : trip
        )
      })),
      loadExampleTrip: () => set((state) => {
        const exampleTrip: Trip = {
          id: uuidv4(),
          title: "Viaje Familiar por Argentina",
          description: "Una aventura interactiva de 30 días para planificar nuestro viaje.",
          coverImage: "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?q=80&w=1000&auto=format&fit=crop",
          destinations: [
            { id: uuidv4(), name: "Buenos Aires", lat: -34.6037, lng: -58.3816 },
            { id: uuidv4(), name: "Bariloche", lat: -41.1335, lng: -71.3103 },
            { id: uuidv4(), name: "Mendoza", lat: -32.8908, lng: -68.8272 }
          ],
          expenses: [
            { id: uuidv4(), description: "Vuelos a Buenos Aires", amount: 1200, currency: "USD", category: "flights" },
            { id: uuidv4(), description: "Hotel en Bariloche", amount: 450, currency: "USD", category: "lodging" },
            { id: uuidv4(), description: "Cena de bienvenida", amount: 35000, currency: "ARS", category: "food" }
          ],
          packingList: [
            { id: uuidv4(), name: "Pasaportes", isPacked: true, category: "documents" },
            { id: uuidv4(), name: "Cámara de fotos", isPacked: false, category: "electronics" },
            { id: uuidv4(), name: "Abrigo para Bariloche", isPacked: false, category: "clothes" },
            { id: uuidv4(), name: "Cepillo de dientes", isPacked: true, category: "toiletries" }
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        return { trips: [...state.trips, exampleTrip] };
      })
    }),
    {
      name: 'viaje-a-tu-medida-storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
