export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'admin' | 'user';
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time?: string;
  location: string;
  city: string;
  category: 'culture' | 'party' | 'concert' | 'dance' | 'other';
  imageUrl?: string;
  authorUid: string;
  createdAt: string;
  isRecurring?: boolean;
  recurringDay?: number; // 0 for Sunday, 1 for Monday, etc.
  favoriteCount?: number;
}

export interface Moment {
  id: string;
  videoUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  city: string;
  eventId?: string;
  authorUid: string;
  authorName: string;
  createdAt: string;
  locationName?: string;
  time?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface Review {
  id: string;
  hotspotId: string;
  authorUid: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Hotspot {
  id: string;
  name: string;
  description: string;
  type: 'restaurant' | 'bar' | 'club' | 'beach' | 'monument' | 'other';
  imageUrl?: string;
  location: string;
  city: string;
  rating?: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  eventId: string;
  authorUid: string;
  authorName: string;
  authorPhoto?: string;
  text: string;
  createdAt: string;
}

export type TogoCity = 'Lomé' | 'Kara' | 'Atakpamé' | 'Sokodé' | 'Kpalimé' | 'Dapaong' | 'Aného' | 'Tsevié';

export const TOGO_CITIES: TogoCity[] = [
  'Lomé',
  'Kara',
  'Atakpamé',
  'Sokodé',
  'Kpalimé',
  'Dapaong',
  'Aného',
  'Tsevié'
];
