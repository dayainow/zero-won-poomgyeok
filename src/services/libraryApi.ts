import { LIBRARIES } from '../data/libraries';
import type { Library } from '../types';

export type LibraryDataState = {
  libraries: Library[];
  sourceLabel: string;
  updatedAt: string | null;
  warning: string | null;
};

type LibraryApiPayload = {
  source?: string;
  updatedAt?: string;
  count?: number;
  libraries?: Library[];
};

const libraryApiUrl = process.env.EXPO_PUBLIC_LIBRARY_API_URL;

export function getInitialLibraryData(): LibraryDataState {
  return {
    libraries: LIBRARIES,
    sourceLabel: '앱 내장 seed 데이터',
    updatedAt: null,
    warning: libraryApiUrl
      ? null
      : 'EXPO_PUBLIC_LIBRARY_API_URL이 없어 앱 내장 seed 데이터를 사용합니다.',
  };
}

export async function loadLibraryData(): Promise<LibraryDataState> {
  if (!libraryApiUrl) {
    return getInitialLibraryData();
  }

  try {
    const response = await fetch(libraryApiUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Library API responded with ${response.status}.`);
    }

    const payload = (await response.json()) as LibraryApiPayload;

    if (!Array.isArray(payload.libraries) || payload.libraries.length === 0) {
      throw new Error('Library API returned no libraries.');
    }

    return {
      libraries: ensureUniqueLibraryIds(payload.libraries),
      sourceLabel: '공공데이터 캐시 JSON',
      updatedAt: payload.updatedAt ?? null,
      warning: null,
    };
  } catch {
    return {
      ...getInitialLibraryData(),
      warning:
        '공공데이터 캐시를 불러오지 못해 앱 내장 seed 데이터로 표시합니다.',
    };
  }
}

function ensureUniqueLibraryIds(libraries: Library[]) {
  const seen = new Set<string>();

  return libraries.map((library, index) => {
    if (!seen.has(library.id)) {
      seen.add(library.id);
      return library;
    }

    let id = createLibraryId(library, index);
    let suffix = 1;

    while (seen.has(id)) {
      id = createLibraryId(library, index + suffix);
      suffix += 1;
    }

    seen.add(id);

    return {
      ...library,
      id,
    };
  });
}

function createLibraryId(library: Library, index: number) {
  const source = [
    library.id,
    library.name,
    library.city,
    library.district,
    library.address,
    library.latitude.toFixed(8),
    library.longitude.toFixed(8),
    index,
  ].join(':');
  let hash = 0;

  for (let charIndex = 0; charIndex < source.length; charIndex += 1) {
    hash = (hash * 31 + source.charCodeAt(charIndex)) >>> 0;
  }

  return `library-${hash.toString(36)}`;
}
