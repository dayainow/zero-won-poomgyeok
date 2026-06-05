import { Platform } from 'react-native';

import {
  CULTURE_EVENTS,
  MOCK_NOTIFICATIONS,
  MOCK_USER,
  TRENDING_SEARCHES,
} from '../data/events';
import type {
  Category,
  CultureEvent,
  CultureFilters,
  UserCoordinate,
} from '../types';

const DEFAULT_FILTERS: CultureFilters = {
  region: '전체',
  category: '전체',
  price: '전체',
  date: '전체',
  radiusKm: 30,
};

export type CultureStats = {
  free: number;
  cheap: number;
  weekend: number;
};

export type CultureEventsDataState = {
  events: CultureEvent[];
  sourceLabel: string;
  updatedAt: string | null;
  warning: string | null;
};

type CultureEventsApiPayload = {
  source?: string;
  updatedAt?: string;
  count?: number;
  warning?: string;
  events?: CultureEvent[];
};

const eventsApiUrl = process.env.EXPO_PUBLIC_EVENTS_API_URL;

export const cultureApi = {
  async getFeed(category: Category = '전체', filters = DEFAULT_FILTERS) {
    return filterEvents(CULTURE_EVENTS, {
      ...filters,
      category,
    });
  },

  async getFeatured() {
    return CULTURE_EVENTS[0];
  },

  async getNearby(
    coordinate: UserCoordinate,
    category: Category = '전체',
    filters = DEFAULT_FILTERS,
  ) {
    return filterEvents(CULTURE_EVENTS, {
      ...filters,
      category,
    })
      .map((event) => ({
        ...event,
        distanceKm: getEventDistanceKm(coordinate, event),
      }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  },

  async getStats(filters = DEFAULT_FILTERS): Promise<CultureStats> {
    const events = filterEvents(CULTURE_EVENTS, filters);

    return {
      free: events.filter((event) => event.priceTier === 'free').length,
      cheap: events.filter(
        (event) => event.priceTier === 'free' || event.priceTier === 'cheap',
      ).length,
      weekend: events.filter((event) => isWeekendEvent(event)).length,
    };
  },

  async getEvent(id: string) {
    const event = CULTURE_EVENTS.find((item) => item.id === id);

    if (!event) {
      throw new Error(`Event not found: ${id}`);
    }

    return event;
  },

  async search(query: string, filters = DEFAULT_FILTERS) {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return [];
    }

    return filterEvents(CULTURE_EVENTS, filters).filter((event) =>
      [
        event.title,
        event.subtitle,
        event.category,
        event.priceLabel,
        event.location.address,
        ...event.hashtags,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  },

  async getTrending() {
    return TRENDING_SEARCHES.map((keyword, index) => ({
      keyword,
      count: 138 - index * 17,
    }));
  },

  async getNotifications() {
    return MOCK_NOTIFICATIONS;
  },

  async getMe() {
    return MOCK_USER;
  },
};

export function getInitialCultureEventsData(): CultureEventsDataState {
  return {
    events: CULTURE_EVENTS,
    sourceLabel: '앱 내장 문화행사 mock 데이터',
    updatedAt: null,
    warning: null,
  };
}

export async function loadCultureEventsData(): Promise<CultureEventsDataState> {
  const url = getCultureEventsApiUrl();

  if (!url) {
    return {
      ...getInitialCultureEventsData(),
      warning: 'EXPO_PUBLIC_EVENTS_API_URL이 없어 앱 내장 mock 데이터를 사용합니다.',
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Culture events API responded with ${response.status}.`);
    }

    const payload = (await response.json()) as CultureEventsApiPayload;

    if (!Array.isArray(payload.events) || payload.events.length === 0) {
      throw new Error('Culture events API returned no events.');
    }

    return {
      events: ensureUniqueEventIds(payload.events),
      sourceLabel:
        payload.source === 'seoul-open-api'
          ? '서울 열린데이터광장 문화행사 API'
          : '문화행사 API fallback 데이터',
      updatedAt: payload.updatedAt ?? null,
      warning: payload.warning ?? null,
    };
  } catch {
    return {
      ...getInitialCultureEventsData(),
      warning:
        '문화행사 API를 불러오지 못해 앱 내장 mock 데이터로 표시합니다.',
    };
  }
}

export function filterEvents(
  events: CultureEvent[],
  filters: Partial<CultureFilters>,
) {
  return events.filter((event) => {
    if (filters.category && filters.category !== '전체') {
      if (event.category !== filters.category) {
        return false;
      }
    }

    if (filters.region && filters.region !== '전체') {
      if (!event.location.address.includes(filters.region)) {
        return false;
      }
    }

    if (filters.price && filters.price !== '전체') {
      if (filters.price === '무료' && event.priceTier !== 'free') {
        return false;
      }

      if (
        filters.price === '1만원 이하' &&
        event.priceTier !== 'free' &&
        event.priceTier !== 'cheap'
      ) {
        return false;
      }

      if (filters.price === '1-3만원' && event.priceTier !== 'mid') {
        return false;
      }
    }

    if (filters.date && filters.date !== '전체') {
      if (filters.date === '오늘' && !isActiveToday(event)) {
        return false;
      }

      if (filters.date === '이번 주' && !isActiveThisWeek(event)) {
        return false;
      }

      if (filters.date === '이번 달' && !isActiveThisMonth(event)) {
        return false;
      }
    }

    return true;
  });
}

function getCultureEventsApiUrl() {
  if (eventsApiUrl) {
    return eventsApiUrl;
  }

  if (Platform.OS === 'web') {
    return '/api/events';
  }

  const appUrl = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (appUrl) {
    return `${appUrl}/api/events`;
  }

  return null;
}

function ensureUniqueEventIds(events: CultureEvent[]) {
  const seen = new Set<string>();

  return events.map((event, index) => {
    if (!seen.has(event.id)) {
      seen.add(event.id);
      return event;
    }

    let id = createEventId(event, index);
    let suffix = 1;

    while (seen.has(id)) {
      id = createEventId(event, index + suffix);
      suffix += 1;
    }

    seen.add(id);

    return {
      ...event,
      id,
    };
  });
}

function createEventId(event: CultureEvent, index: number) {
  const source = [
    event.id,
    event.title,
    event.subtitle,
    event.location.address,
    event.location.lat.toFixed(8),
    event.location.lng.toFixed(8),
    event.schedule.startDate,
    index,
  ].join(':');
  let hash = 0;

  for (let charIndex = 0; charIndex < source.length; charIndex += 1) {
    hash = (hash * 31 + source.charCodeAt(charIndex)) >>> 0;
  }

  return `event-${hash.toString(36)}`;
}

export function getEventDistanceKm(
  from: UserCoordinate,
  event: CultureEvent,
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(event.location.lat - from.latitude);
  const dLon = toRadians(event.location.lng - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(event.location.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

export function formatEventDistance(distanceKm?: number) {
  if (typeof distanceKm !== 'number') {
    return '거리 계산 중';
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }

  return `${distanceKm.toFixed(1)}km`;
}

function isWeekendEvent(event: CultureEvent) {
  const date = new Date(event.schedule.startDate);
  const day = date.getDay();

  return day === 0 || day === 6 || event.schedule.closedDays.includes('주말');
}

function isActiveToday(event: CultureEvent) {
  const today = new Date('2026-05-08T12:00:00+09:00');
  const start = new Date(`${event.schedule.startDate}T00:00:00+09:00`);
  const end = new Date(`${event.schedule.endDate}T23:59:59+09:00`);

  return start <= today && today <= end;
}

function isActiveThisWeek(event: CultureEvent) {
  const today = new Date('2026-05-08T12:00:00+09:00');
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const start = new Date(`${event.schedule.startDate}T00:00:00+09:00`);

  return start <= weekEnd;
}

function isActiveThisMonth(event: CultureEvent) {
  return event.schedule.startDate.startsWith('2026-05');
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
