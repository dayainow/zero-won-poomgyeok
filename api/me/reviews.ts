import type { VercelRequest, VercelResponse } from '@vercel/node';

import { withRequestContext } from '../_lib/observability';
import { enforceRateLimit } from '../_lib/rateLimit';
import {
  createReviewForViewer,
  getMyReviews,
  parseJsonBody,
  requireViewer,
} from '../_lib/userSystem';

type CreateReviewBody = {
  comment?: string;
  eventId?: string;
  eventTitle?: string;
  rating?: number;
};

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader('Cache-Control', 'no-store');
  const obs = withRequestContext(request, response);
  const startedAt = Date.now();

  try {
    const viewer = await requireViewer(request, response);
    if (!viewer) {
      return;
    }

    if (request.method === 'GET') {
      enforceRateLimit({
        key: `my-reviews:get:${viewer.user.id}`,
        limit: 60,
        windowMs: 60_000,
      });
      const limit = toLimit(request.query.limit);
      const queryAt = Date.now();
      const reviews = await getMyReviews(viewer, { limit });
      obs.mark('db_my_reviews', queryAt);
      response.status(200).json({ reviews });
      return;
    }

    if (request.method === 'POST') {
      const ip = String(request.headers['x-forwarded-for'] ?? request.socket.remoteAddress ?? 'unknown')
        .split(',')[0]
        .trim();
      enforceRateLimit({
        key: `my-reviews:post-user:${viewer.user.id}`,
        limit: 8,
        windowMs: 60_000,
      });
      enforceRateLimit({
        key: `my-reviews:post-ip:${ip}`,
        limit: 20,
        windowMs: 60_000,
      });
      const body = parseJsonBody<CreateReviewBody>(request.body ?? {});
      const queryAt = Date.now();
      const review = await createReviewForViewer(viewer, {
        comment: body.comment ?? '',
        eventId: body.eventId ?? '',
        eventTitle: body.eventTitle ?? '',
        rating: Number(body.rating),
      });
      obs.mark('db_create_review', queryAt);
      response.status(201).json({ review });
      return;
    }

    response.setHeader('Allow', 'GET, POST');
    response.status(405).json({ message: 'GET 또는 POST만 허용됩니다.' });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '후기 요청을 처리하지 못했습니다.';
    const status = resolveStatus(error, message);
    const retryAfterSec = (error as { retryAfterSec?: number })?.retryAfterSec;
    if (retryAfterSec) {
      response.setHeader('Retry-After', String(retryAfterSec));
    }
    response.status(status).json({ message });
    obs.log(status >= 500 ? 'error' : 'warn', 'my_reviews_failed', {
      elapsedMs: Date.now() - startedAt,
      message,
      method: request.method,
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

function resolveStatus(error: unknown, message: string) {
  if (
    message.includes('required') ||
    message.includes('between') ||
    message.includes('fewer') ||
    message.includes('숫자')
  ) {
    return 400;
  }

  if (message.includes('잠시 후')) {
    return 429;
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number((error as { status?: unknown }).status);
    if (Number.isInteger(status) && status >= 400 && status < 600) {
      return status;
    }
  }

  return 500;
}
