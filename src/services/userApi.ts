import { getAuthAccessToken } from './authClient';
import type { CultureEvent } from '../types';

export type ViewerProfile = {
  id: string;
  nickname: string;
  district: string | null;
  avatarUrl: string | null;
  interests: string[];
  marketingConsent: boolean;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ViewerPreferences = {
  defaultRegion: string;
  radiusKm: number;
  pushEnabled: boolean;
  eventPushEnabled: boolean;
  marketingEnabled: boolean;
  updatedAt: string | null;
};

export type ViewerSavedEvent = {
  id: string;
  eventId: string;
  eventSource: string;
  eventTitle: string;
  eventCategory: string;
  eventLocation: string | null;
  eventStartDate: string | null;
  eventEndDate: string | null;
  eventSnapshot: CultureEvent;
  savedAt: string;
};

export type Review = {
  id: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type ViewerData = {
  profile: ViewerProfile;
  preferences: ViewerPreferences;
  savedEventIds: string[];
  savedEvents: ViewerSavedEvent[];
  recentSearches: Array<{
    id: string;
    query: string;
    searchedAt: string;
  }>;
};

type SavedEventsPayload = {
  savedEventIds: string[];
  savedEvents: ViewerSavedEvent[];
};

import { getAppApiUrl } from './apiBase';

export async function loadViewerData() {
  return requestWithAuth<ViewerData>('/api/me');
}

export async function saveViewerEvent(event: CultureEvent) {
  return requestWithAuth<{ savedEvent: ViewerSavedEvent }>('/api/me/saved-events', {
    body: JSON.stringify({ event }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

export async function deleteViewerSavedEvent(eventId: string) {
  return requestWithAuth<{ ok: boolean; eventId: string }>(
    `/api/me/saved-events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function updateViewerProfile(input: {
  district?: string;
  interests?: string[];
  marketingConsent?: boolean;
  nickname?: string;
  onboardingCompleted?: boolean;
}) {
  return requestWithAuth<ViewerData>('/api/me', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  });
}

export async function updateViewerPreferences(input: {
  defaultRegion?: string;
  eventPushEnabled?: boolean;
  marketingEnabled?: boolean;
  pushEnabled?: boolean;
  radiusKm?: number;
}) {
  return requestWithAuth<{ preferences: ViewerPreferences }>('/api/me/preferences', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  });
}

export async function saveViewerRecentSearch(query: string) {
  return requestWithAuth<{ recentSearches: ViewerData['recentSearches'] }>(
    '/api/me/recent-searches',
    {
      body: JSON.stringify({ query }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
}

export async function loadViewerSavedEvents() {
  return requestWithAuth<SavedEventsPayload>('/api/me/saved-events');
}

export async function createViewerReview(input: {
  eventId: string;
  eventTitle: string;
  rating: number;
  comment: string;
}) {
  return requestWithAuth<{ review: Review }>('/api/me/reviews', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

export async function loadViewerReviews(limit?: number) {
  const query = typeof limit === 'number' ? `?limit=${encodeURIComponent(String(limit))}` : '';
  return requestWithAuth<{ reviews: Review[] }>(`/api/me/reviews${query}`);
}

export async function loadEventReviews(eventId: string, limit?: number) {
  const searchParams = new URLSearchParams();
  if (typeof limit === 'number') {
    searchParams.set('limit', String(limit));
  }

  const query = searchParams.toString();
  const path = `/api/events/${encodeURIComponent(eventId)}/reviews${query ? `?${query}` : ''}`;
  return requestWithoutAuth<{ reviews: Review[] }>(path);
}

async function requestWithAuth<T>(path: string, init: RequestInit = {}) {
  const token = await getAuthAccessToken();

  if (!token) {
    throw new Error('로그인이 필요합니다.');
  }

  const response = await fetch(getApiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload.message === 'string'
        ? payload.message
        : `API request failed with ${response.status}.`;
    throw new Error(message);
  }

  return payload as T;
}

async function requestWithoutAuth<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(getApiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload.message === 'string'
        ? payload.message
        : `API request failed with ${response.status}.`;
    throw new Error(message);
  }

  return payload as T;
}

function getApiUrl(path: string) {
  return getAppApiUrl(path);
}
