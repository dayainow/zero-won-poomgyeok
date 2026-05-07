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
