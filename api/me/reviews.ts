import type { VercelRequest, VercelResponse } from '@vercel/node';

import { withRequestContext } from '../_lib/observability';
import { enforceRateLimit } from '../_lib/rateLimit';
import {
  createReviewForViewer,
  createReviewReportForViewer,
  getMyReviews,
  likeReviewForViewer,
  parseJsonBody,
  requireViewer,
  unlikeReviewForViewer,
} from '../_lib/userSystem';

type CreateReviewBody = {
  comment?: string;
  eventId?: string;
  eventTitle?: string;
  rating?: number;
};

type CreateReportBody = {
  reason?: string;
  reviewId?: string;
};

type ReviewLikeBody = {
  reviewId?: string;
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
      const resource =
        typeof request.query.resource === 'string' ? request.query.resource : '';

      if (resource === 'reports') {
        enforceRateLimit({
          key: `review-report:user:${viewer.user.id}`,
          limit: 20,
          windowMs: 60_000,
        });
        enforceRateLimit({
          key: `review-report:ip:${ip}`,
          limit: 40,
          windowMs: 60_000,
        });
        const body = parseJsonBody<CreateReportBody>(request.body ?? {});
        const queryAt = Date.now();
        const result = await createReviewReportForViewer(viewer, {
          reason: body.reason ?? '',
          reviewId: body.reviewId ?? '',
        });
        obs.mark('db_create_review_report', queryAt);
        response.status(201).json(result);
        return;
      }

      if (resource === 'likes') {
        enforceRateLimit({
          key: `review-like:user:${viewer.user.id}`,
          limit: 60,
          windowMs: 60_000,
        });
        enforceRateLimit({
          key: `review-like:ip:${ip}`,
          limit: 120,
          windowMs: 60_000,
        });
        const body = parseJsonBody<ReviewLikeBody>(request.body ?? {});
        const queryAt = Date.now();
        const result = await likeReviewForViewer(viewer, body.reviewId ?? '');
        obs.mark('db_like_review', queryAt);
        response.status(201).json(result);
        return;
      }

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

    if (request.method === 'DELETE') {
      const ip = String(request.headers['x-forwarded-for'] ?? request.socket.remoteAddress ?? 'unknown')
        .split(',')[0]
        .trim();
      const resource =
        typeof request.query.resource === 'string' ? request.query.resource : '';

      if (resource === 'likes') {
        enforceRateLimit({
          key: `review-unlike:user:${viewer.user.id}`,
          limit: 60,
          windowMs: 60_000,
        });
        enforceRateLimit({
          key: `review-unlike:ip:${ip}`,
          limit: 120,
          windowMs: 60_000,
        });
        const body = parseJsonBody<ReviewLikeBody>(request.body ?? {});
        const queryAt = Date.now();
        const result = await unlikeReviewForViewer(viewer, body.reviewId ?? '');
        obs.mark('db_unlike_review', queryAt);
        response.status(200).json(result);
        return;
      }

      response.setHeader('Allow', 'GET, POST, DELETE');
      response.status(405).json({ message: 'GET, POST 또는 DELETE만 허용됩니다.' });
      return;
    }

    response.setHeader('Allow', 'GET, POST, DELETE');
    response.status(405).json({ message: 'GET, POST 또는 DELETE만 허용됩니다.' });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '후기 요청을 처리하지 못했습니다.';
    const status = resolveStatus(error, message);
    const retryAfterSec = (error as { retryAfterSec?: number })?.retryAfterSec;
    if (retryAfterSec) {
      response.setHeader('Retry-After', String(retryAfterSec));
    }
    response.status(status).json({ message });
    obs.log(
      status >= 500 ? 'error' : 'warn',
      'my_reviews_failed',
      {
        elapsedMs: Date.now() - startedAt,
        message,
        method: request.method,
        status,
      },
      error,
    );
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
    message.includes('숫자') ||
    message.includes('찾을 수 없습니다') ||
    message.includes('이미 신고')
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
