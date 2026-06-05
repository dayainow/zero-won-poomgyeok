import { getAppApiUrl } from './apiBase';

export type KakaoPlace = {
  addressName: string;
  categoryName: string;
  id: string;
  latitude: number;
  longitude: number;
  phone: string;
  placeName: string;
  placeUrl: string;
  roadAddressName: string;
};

export type GeocodeCoordinate = {
  addressName: string;
  latitude: number;
  longitude: number;
  roadAddressName: string;
};

type SearchPlacesPayload = {
  message?: string;
  places?: KakaoPlace[];
};

type GeocodePayload = {
  coordinate?: GeocodeCoordinate | null;
  message?: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const WINDOW_MS = 60 * 1000;
const MAX_CLIENT_REQUESTS_PER_WINDOW = 30;
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
let requestWindowStartedAt = Date.now();
let requestCount = 0;

export async function searchKakaoPlaces(query: string) {
  const normalized = normalizeQuery(query);

  if (!normalized) {
    return [];
  }

  const cacheKey = `search:${normalized.toLowerCase()}`;
  const cached = readCache<KakaoPlace[]>(cacheKey);

  if (cached) {
    return cached;
  }

  enforceRateLimit();
  const url = `${getApiUrl('/api/map/search')}?query=${encodeURIComponent(normalized)}&size=7`;
  const payload = await request<SearchPlacesPayload>(url);
  const places = Array.isArray(payload.places) ? payload.places : [];

  writeCache(cacheKey, places);
  return places;
}

export async function geocodeKakaoQuery(query: string) {
  const normalized = normalizeQuery(query);

  if (!normalized) {
    return null;
  }

  const cacheKey = `geocode:${normalized.toLowerCase()}`;
  const cached = readCache<GeocodeCoordinate | null>(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  enforceRateLimit();
  const url = `${getApiUrl('/api/map/geocode')}?query=${encodeURIComponent(normalized)}`;
  const payload = await request<GeocodePayload>(url);
  const coordinate = payload.coordinate ?? null;
  writeCache(cacheKey, coordinate);

  return coordinate;
}

function normalizeQuery(query: string) {
  const normalized = query.trim();

  if (normalized.length < 2) {
    return '';
  }

  return normalized;
}

function getApiUrl(path: string) {
  return getAppApiUrl(path);
}

async function request<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string } & T;

  if (!response.ok) {
    throw new Error(payload.message ?? `Map API 요청 실패 (${response.status})`);
  }

  return payload;
}

function enforceRateLimit() {
  const now = Date.now();

  if (now - requestWindowStartedAt >= WINDOW_MS) {
    requestWindowStartedAt = now;
    requestCount = 0;
  }

  if (requestCount >= MAX_CLIENT_REQUESTS_PER_WINDOW) {
    throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
  }

  requestCount += 1;
}

function readCache<T>(cacheKey: string) {
  const cached = responseCache.get(cacheKey);

  if (!cached) {
    return undefined;
  }

  if (Date.now() > cached.expiresAt) {
    responseCache.delete(cacheKey);
    return undefined;
  }

  return cached.value as T;
}

function writeCache(cacheKey: string, value: unknown) {
  responseCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value,
  });
}
