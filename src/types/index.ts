export interface Photo {
  id: string;
  url: string;
  file?: File;
  date?: number;
  lat?: number;
  lng?: number;
  direction?: number;
  visionLandmarks?: string[];
  visionTexts?: string[];
  visionLabels?: string[];
  clusterId?: string;
  isAnchor?: boolean;
  inherited?: boolean;
  locationName?: string;
  resolutionSource?: 'cache' | 'api' | 'vision';
}

export interface Place {
  id: string;
  name: string;
  url?: string;
  lat?: number;
  lng?: number;
}

export interface Restaurant {
  id: string;
  name: string;
  type: string;
  glutenFree: boolean;
  sugarFree: boolean;
  url?: string;
  lat?: number;
  lng?: number;
}

export interface Lodging {
  id: string;
  name: string;
  checkIn?: string;
  checkOut?: string;
  address?: string;
  reservationUrl?: string;
  documentUrl?: string;
  lat?: number;
  lng?: number;
}

export interface Transport {
  id: string;
  type: 'flight' | 'train' | 'bus' | 'car' | 'other';
  provider: string;
  departureTime?: string;
  arrivalTime?: string;
  departureLocation?: string;
  arrivalLocation?: string;
  reservationCode?: string;
  documentUrl?: string;
}

export interface Destination {
  id: string;
  name: string;
  lat: number;
  lng: number;
  coverImage?: string;
  description?: string;
  notes?: string;
  startDate?: string;
  endDate?: string;
  places?: string[]; // Legacy
  placesList?: Place[];
  activities?: string[];
  gastronomy?: string; // Legacy
  restaurants?: Restaurant[];
  lodging?: string[]; // Legacy
  lodgings?: Lodging[];
  transports?: Transport[];
  photos?: Photo[];
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: 'flights' | 'lodging' | 'food' | 'transport' | 'activities' | 'other';
}

export interface PackingItem {
  id: string;
  name: string;
  isPacked: boolean;
  category: 'clothes' | 'electronics' | 'documents' | 'toiletries' | 'other';
}

export interface Trip {
  id: string;
  userId?: string | null;
  title: string;
  description: string;
  coverImage?: string;
  destinations?: Destination[];
  expenses?: Expense[];
  packingList?: PackingItem[];
  createdAt: number;
  updatedAt: number;
}
