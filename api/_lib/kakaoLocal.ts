type KakaoKeywordDocument = {
  address_name?: string;
  category_name?: string;
  id?: string;
  phone?: string;
  place_name?: string;
  place_url?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
};

type KakaoAddressDocument = {
  address?: {
    address_name?: string;
    x?: string;
    y?: string;
  };
  road_address?: {
    address_name?: string;
  };
};

type KakaoKeywordResponse = {
  documents?: KakaoKeywordDocument[];
};

type KakaoAddressResponse = {
  documents?: KakaoAddressDocument[];
};

export type KakaoPlaceSearchResult = {
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

export type KakaoGeocodeResult = {
  addressName: string;
  latitude: number;
  longitude: number;
  roadAddressName: string;
};

const KAKAO_LOCAL_BASE_URL = 'https://dapi.kakao.com';
const CACHE_TTL_MS = 5 * 60 * 1000;
const keywordCache = new Map<string, { expiresAt: number; value: KakaoPlaceSearchResult[] }>();
const geocodeCache = new Map<string, { expiresAt: number; value: KakaoGeocodeResult | null }>();

export async function searchKakaoPlaces(query: string, limit = 7) {
  const normalized = query.trim();

  if (normalized.length < 2) {
    return [];
  }

  const cacheKey = `${normalized.toLowerCase()}:${limit}`;
  const cached = readCache(keywordCache, cacheKey);

  if (cached) {
    return cached;
  }

  const url = new URL('/v2/local/search/keyword.json', KAKAO_LOCAL_BASE_URL);
  url.searchParams.set('query', normalized);
  url.searchParams.set('size', String(Math.min(15, Math.max(1, limit))));

  const payload = await requestKakaoApi<KakaoKeywordResponse>(url);
  const places = Array.isArray(payload.documents)
    ? payload.documents
        .map((document) => toPlaceResult(document))
        .filter((place): place is KakaoPlaceSearchResult => place !== null)
    : [];

  writeCache(keywordCache, cacheKey, places);
  return places;
}

export async function geocodeKakaoQuery(query: string) {
  const normalized = query.trim();

  if (normalized.length < 2) {
    return null;
  }

  const cacheKey = normalized.toLowerCase();
  const cached = readCache(geocodeCache, cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const fromAddressApi = await geocodeFromAddressApi(normalized);

  if (fromAddressApi) {
    writeCache(geocodeCache, cacheKey, fromAddressApi);
    return fromAddressApi;
  }

  const places = await searchKakaoPlaces(normalized, 1);
  const fallback = places[0]
    ? {
        addressName: places[0].addressName,
        latitude: places[0].latitude,
        longitude: places[0].longitude,
        roadAddressName: places[0].roadAddressName,
      }
    : null;

  writeCache(geocodeCache, cacheKey, fallback);
  return fallback;
}

async function geocodeFromAddressApi(query: string) {
  const url = new URL('/v2/local/search/address.json', KAKAO_LOCAL_BASE_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('size', '1');

  const payload = await requestKakaoApi<KakaoAddressResponse>(url);
  const first = Array.isArray(payload.documents) ? payload.documents[0] : null;

  if (!first) {
    return null;
  }

  const x = Number(first.address?.x);
  const y = Number(first.address?.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    addressName: first.address?.address_name ?? query,
    latitude: y,
    longitude: x,
    roadAddressName: first.road_address?.address_name ?? '',
  };
}

async function requestKakaoApi<T>(url: URL): Promise<T> {
  const key = process.env.KAKAO_REST_API_KEY?.trim();

  if (!key) {
    throw new Error('KAKAO_REST_API_KEY 환경 변수가 필요합니다.');
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `KakaoAK ${key}`,
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(`카카오 로컬 API 요청 실패 (${response.status}): ${message.slice(0, 180)}`);
  }

  return (await response.json()) as T;
}

function toPlaceResult(document: KakaoKeywordDocument): KakaoPlaceSearchResult | null {
  const latitude = Number(document.y);
  const longitude = Number(document.x);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    addressName: document.address_name ?? '',
    categoryName: document.category_name ?? '',
    id: document.id ?? `${document.place_name ?? 'kakao-place'}:${longitude}:${latitude}`,
    latitude,
    longitude,
    phone: document.phone ?? '',
    placeName: document.place_name ?? '이름 없음',
    placeUrl: document.place_url ?? '',
    roadAddressName: document.road_address_name ?? '',
  };
}

function readCache<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string) {
  const cached = cache.get(key);

  if (!cached) {
    return undefined;
  }

  if (Date.now() > cached.expiresAt) {
    cache.delete(key);
    return undefined;
  }

  return cached.value;
}

function writeCache<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string, value: T) {
  cache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value,
  });
}
