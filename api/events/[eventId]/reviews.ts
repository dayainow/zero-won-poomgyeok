import type { VercelRequest, VercelResponse } from '@vercel/node';

import { withRequestContext } from '../../_lib/observability';
import { enforceRateLimit } from '../../_lib/rateLimit';
import { getEventReviews } from '../../_lib/userSystem';

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

    const limit = toLimit(request.query.limit);
    const queryAt = Date.now();
    const reviews = await getEventReviews(eventId, { limit });
    obs.mark('db_event_reviews', queryAt);
    response.status(200).json({ reviews });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '이벤트 후기를 조회하지 못했습니다.';
    const status = (error as { status?: number })?.status ?? (message.includes('숫자') ? 400 : 500);
    const retryAfterSec = (error as { retryAfterSec?: number })?.retryAfterSec;
    if (retryAfterSec) {
      response.setHeader('Retry-After', String(retryAfterSec));
    }
    response.status(status).json({ message });
    obs.log(status >= 500 ? 'error' : 'warn', 'event_reviews_failed', {
      elapsedMs: Date.now() - startedAt,
      message,
      status,
    });
  } finally {
    obs.mark('handler', startedAt);
    obs.finalize();
  }
}

function toLimit(input: string | string[] | undefined) {
  const raw = Array.isArray(input) ? input[0] : input;
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error('limit은 숫자여야 합니다.');
  }

  return parsed;
}
