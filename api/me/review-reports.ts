import type { VercelRequest, VercelResponse } from '@vercel/node';

import { withRequestContext } from '../_lib/observability';
import { enforceRateLimit } from '../_lib/rateLimit';
import {
  createReviewReportForViewer,
  parseJsonBody,
  requireViewer,
} from '../_lib/userSystem';

type CreateReportBody = {
  reason?: string;
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
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      response.status(405).json({ message: 'POST만 허용됩니다.' });
      return;
    }

    const viewer = await requireViewer(request, response);
    if (!viewer) {
      return;
    }

    const ip = String(request.headers['x-forwarded-for'] ?? request.socket.remoteAddress ?? 'unknown')
      .split(',')[0]
      .trim();
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
    const result = await createReviewReportForViewer(viewer, {
      reason: body.reason ?? '',
      reviewId: body.reviewId ?? '',
    });

    response.status(201).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '후기 신고를 처리하지 못했습니다.';
    const status =
      message.includes('required') ||
      message.includes('fewer') ||
      message.includes('찾을 수 없습니다') ||
      message.includes('이미 신고')
        ? 400
        : (error as { status?: number })?.status ?? 500;
    response.status(status).json({ message });
    obs.log(status >= 500 ? 'error' : 'warn', 'review_report_failed', {
      elapsedMs: Date.now() - startedAt,
      message,
      status,
    });
  } finally {
    obs.mark('handler', startedAt);
    obs.finalize();
  }
}
