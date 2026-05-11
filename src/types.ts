export type LibraryHours = {
  open: string;
  close: string;
};

export type Library = {
  id: string;
  name: string;
  type: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  homepage: string;
  latitude: number;
  longitude: number;
  weekdayHours: LibraryHours | null;
  saturdayHours: LibraryHours | null;
  sundayHours: LibraryHours | null;
  closedRules: string[];
  seats: number;
  books: number;
  dataDate: string;
};

export type UserCoordinate = {
  latitude: number;
  longitude: number;
};

export type Category = '전체' | '전시' | '공연' | '클래스' | '행사' | '공간';

export type PriceTier = 'free' | 'cheap' | 'mid';

export type CultureEvent = {
  id: string;
  title: string;
  subtitle: string;
  category: Exclude<Category, '전체'>;
  priceTier: PriceTier;
  priceLabel: string;
  reservationRequired: boolean;
  thumbnail: string;
  images: string[];
  description: string;
  hashtags: string[];
  location: {
    address: string;
    lat: number;
    lng: number;
  };
  schedule: {
    startDate: string;
    endDate: string;
    operatingHours: string;
    closedDays: string;
  };
  rating: number;
  reviewCount: number;
  favoriteCount: number;
  reservationUrl?: string;
};

export type SavedEvent = {
  eventId: string;
  savedAt: string;
};

export type CultureNotification = {
  id: string;
  type: 'reminder' | 'today_pick' | 'story' | 'urgent';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  eventId?: string;
};

export type UserProfile = {
  id: string;
  nickname: string;
  handle: string;
  district: string;
  interests: Exclude<Category, '전체'>[];
  budgetTier: PriceTier;
  visitedCount: number;
  upcomingCount: number;
  reviewCount: number;
};

export type CultureFilters = {
  region: string;
  category: Category;
  price: '전체' | '무료' | '1만원 이하' | '1-3만원';
  date: '전체' | '오늘' | '이번 주' | '이번 달';
  radiusKm: number;
};
