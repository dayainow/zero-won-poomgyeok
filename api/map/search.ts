import type { VercelRequest, VercelResponse } from '@vercel/node';

import { searchKakaoPlaces } from '../_lib/kakaoLocal';

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;
const rateLimitStore = new Map<string, { count: number; windowStartedAt: number }>();

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method && request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  if (!checkRateLimit(getRateLimitKey(request))) {
    response.status(429).json({
      message: '검색 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    });
    return;
  }

  const query = typeof request.query.query === 'string' ? request.query.query.trim() : '';

  if (query.length < 2) {
    response.status(200).json({
      places: [],
      source: 'kakao-local',
    });
    return;
  }

  const size = Number.parseInt(String(request.query.size ?? '7'), 10);
  const limit = Number.isFinite(size) ? Math.min(15, Math.max(1, size)) : 7;

  try {
    const places = await searchKakaoPlaces(query, limit);
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1200');
    response.status(200).json({
      places,
      source: 'kakao-local',
    });
  } catch (error) {
    response.status(500).json({
      message:
        error instanceof Error ? error.message : '카카오 장소 검색 중 오류가 발생했습니다.',
      places: [],
    });
  }
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStartedAt >= WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, windowStartedAt: now });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  entry.count += 1;
  rateLimitStore.set(key, entry);
  return true;
}

function getRateLimitKey(request: VercelRequest) {
  const forwardedFor = request.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }

  return request.socket.remoteAddress ?? 'unknown';
}
