import { getAuthAccessToken } from './authClient';

export type ReviewItem = {
  eventTitle: string;
  id: string;
  eventId: string;
  rating: number;
  comment: string;
  status?: 'visible' | 'hidden';
  createdAt: string;
  updatedAt: string;
};

type ApiError = {
  code?: string;
  error?: string;
  message?: string;
};

import { getAppApiUrl } from './apiBase';

export async function createReview(input: {
  eventTitle: string;
  eventId: string;
  rating: number;
  comment: string;
}) {
  return requestWithAuth<{ review: ReviewItem }>('/api/me/reviews', {
    body: JSON.stringify(input),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

export async function loadMyReviews() {
  return requestWithAuth<{ reviews: ReviewItem[] }>('/api/me/reviews');
}

export async function loadEventReviews(eventId: string, limit = 3) {
  const query = new URLSearchParams({ limit: String(limit) });
  return requestWithoutAuth<{ reviews: ReviewItem[] }>(
    `/api/events/${encodeURIComponent(eventId)}/reviews?${query.toString()}`,
  );
}

export async function reportReview(input: { reason: string; reviewId: string }) {
  return requestWithAuth<{ alreadyHidden?: boolean; hideTriggered?: boolean; reportCount?: number }>(
    '/api/me/review-reports',
    {
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );
}

async function requestWithAuth<T>(path: string, init: RequestInit = {}) {
  const token = await getAuthAccessToken();

  if (!token) {
    const error = new Error('로그인이 필요합니다.') as Error & { code?: string };
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  return request<T>(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}

async function requestWithoutAuth<T>(path: string, init: RequestInit = {}) {
  return request<T>(path, init);
}

async function request<T>(path: string, init: RequestInit) {
  const response = await fetch(getApiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as ApiError | null;

  if (!response.ok) {
    const message =
      payload && typeof payload.message === 'string'
        ? payload.message
        : `API request failed with ${response.status}.`;
    const error = new Error(message) as Error & { code?: string };
    error.code =
      (payload && typeof payload.code === 'string' && payload.code) ||
      (payload && typeof payload.error === 'string' ? payload.error : undefined);
    throw error;
  }

  return payload as T;
}

function getApiUrl(path: string) {
  return getAppApiUrl(path);
}
