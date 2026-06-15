import type { VercelRequest, VercelResponse } from '@vercel/node';

import { withRequestContext } from '../../_lib/observability';
import { enforceRateLimit } from '../../_lib/rateLimit';
import {
  getEventReviews,
  resolveOptionalViewerUserId,
  type ReviewSort,
} from '../../_lib/userSystem';

// userSystem.ts의 REVIEW_DEFAULT_LIMIT와 일치시켜 hasMore를 정확히 계산.
const DEFAULT_LIMIT = 20;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
  const obs = withRequestContext(request, response);
  const startedAt = Date.now();

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ message: 'GET만 허용됩니다.' });
    return;
  }

  try {
    const ip = String(request.headers['x-forwarded-for'] ?? request.socket.remoteAddress ?? 'unknown')
      .split(',')[0]
      .trim();
    enforceRateLimit({
      key: `event-reviews:get-ip:${ip}`,
      limit: 120,
      windowMs: 60_000,
    });

    const eventId = String(request.query.eventId ?? '').trim();
    if (!eventId) {
      response.status(400).json({ message: 'eventId가 필요합니다.' });
      return;
    }

    // 잘못된 limit/offset/sort는 안전 폴백(throw하지 않는다).
    const limit = toLimit(request.query.limit);
    const offset = toOffset(request.query.offset);
    const sort = toSort(request.query.sort);

    // Authorization Bearer가 있으면 viewer 추출(없거나 무효면 비로그인).
    const viewerUserId = await resolveOptionalViewerUserId(request);

    // 서버 기본 limit과 동일(REVIEW_DEFAULT_LIMIT=20). hasMore 계산용 기준.
    const effectiveLimit = limit ?? DEFAULT_LIMIT;
    const queryAt = Date.now();
    const reviews = await getEventReviews(eventId, {
      limit: effectiveLimit,
      offset,
      sort,
      viewerUserId,
    });
    obs.mark('db_event_reviews', queryAt);

    const hasMore = reviews.length === effectiveLimit;
    response.status(200).json({ reviews, hasMore });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '이벤트 후기를 조회하지 못했습니다.';
    const status = (error as { status?: number })?.status ?? 500;
    const retryAfterSec = (error as { retryAfterSec?: number })?.retryAfterSec;
    if (retryAfterSec) {
      response.setHeader('Retry-After', String(retryAfterSec));
    }
    response.status(status).json({ message });
    obs.log(
      status >= 500 ? 'error' : 'warn',
      'event_reviews_failed',
      {
        elapsedMs: Date.now() - startedAt,
        message,
        status,
      },
      error,
    );
  } finally {
    obs.mark('handler', startedAt);
    obs.finalize();
  }
}

function toLimit(input: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(input) ? input[0] : input;
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  // 잘못된 값은 폴백(undefined → 서버 기본 limit).
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOffset(input: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(input) ? input[0] : input;
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toSort(input: string | string[] | undefined): ReviewSort | undefined {
  const raw = Array.isArray(input) ? input[0] : input;
  if (raw === 'recent' || raw === 'rating' || raw === 'likes') {
    return raw;
  }
  return undefined;
}
