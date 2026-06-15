import { getAuthAccessToken } from './authClient';

export type ReviewSort = 'recent' | 'rating' | 'likes';

export type ReviewItem = {
  eventTitle: string;
  id: string;
  eventId: string;
  rating: number;
  comment: string;
  status?: 'visible' | 'hidden';
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  likedByViewer: boolean;
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

export async function loadEventReviews(
  eventId: string,
  options: { limit?: number; offset?: number; sort?: ReviewSort } = {},
) {
  const { limit = 3, offset, sort } = options;
  const query = new URLSearchParams({ limit: String(limit) });

  if (typeof offset === 'number') {
    query.set('offset', String(offset));
  }

  if (sort) {
    query.set('sort', sort);
  }

  // Bearer 토큰이 있으면 likedByViewer가 채워지고, 없으면 비로그인으로 false 처리된다.
  const token = await getAuthAccessToken();
  const path = `/api/events/${encodeURIComponent(eventId)}/reviews?${query.toString()}`;

  if (token) {
    return request<{ reviews: ReviewItem[]; hasMore: boolean }>(path, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return requestWithoutAuth<{ reviews: ReviewItem[]; hasMore: boolean }>(path);
}

export async function likeReview(reviewId: string) {
  return requestWithAuth<{ liked: true; likeCount: number }>('/api/me/review-likes', {
    body: JSON.stringify({ reviewId }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

export async function unlikeReview(reviewId: string) {
  return requestWithAuth<{ liked: false; likeCount: number }>('/api/me/review-likes', {
    body: JSON.stringify({ reviewId }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'DELETE',
  });
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
