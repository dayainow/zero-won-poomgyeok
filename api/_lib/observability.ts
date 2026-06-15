import * as Sentry from '@sentry/node';
import type { VercelRequest, VercelResponse } from '@vercel/node';

type TimingMark = {
  label: string;
  ms: number;
};

// SENTRY_DSN이 없으면 완전 no-op. init은 모듈 로드시 1회만.
const sentryEnabled = Boolean(process.env.SENTRY_DSN);
let sentryInitialized = false;

function ensureSentryInitialized() {
  if (!sentryEnabled || sentryInitialized) {
    return;
  }
  sentryInitialized = true;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0,
  });
}

ensureSentryInitialized();

/**
 * Sentry로 예외를 보고한다. DSN 미설정 시 no-op.
 * extra에는 requestId/event 등 컨텍스트를 넣는다.
 */
export function captureException(error: unknown, extra?: Record<string, unknown>) {
  if (!sentryEnabled) {
    return;
  }
  try {
    Sentry.captureException(error, extra ? { extra } : undefined);
  } catch {
    // 보고 실패가 핸들러 흐름을 깨지 않도록 무시.
  }
}

export function withRequestContext(request: VercelRequest, response: VercelResponse) {
  const requestId =
    String(request.headers['x-request-id'] ?? '').trim() ||
    `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const marks: TimingMark[] = [];

  response.setHeader('x-request-id', requestId);

  function mark(label: string, startMs: number) {
    marks.push({ label, ms: Date.now() - startMs });
  }

  function finalize() {
    if (marks.length === 0) {
      return;
    }

    const serverTiming = marks
      .map((item) => `${item.label};dur=${Math.max(0, item.ms).toFixed(1)}`)
      .join(', ');
    response.setHeader('Server-Timing', serverTiming);
  }

  function log(
    level: 'info' | 'warn' | 'error',
    event: string,
    meta: Record<string, unknown>,
    error?: unknown,
  ) {
    const payload = {
      event,
      level,
      requestId,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    const line = JSON.stringify(payload);

    if (level === 'error') {
      console.error(line);
      // 처리되지 않은(5xx) 에러 경로를 Sentry로 보고. DSN 없으면 no-op.
      captureException(error ?? new Error(`${event}: ${String(meta.message ?? '')}`), {
        event,
        requestId,
        ...meta,
      });
      return;
    }
    if (level === 'warn') {
      console.warn(line);
      return;
    }
    console.log(line);
  }

  return {
    finalize,
    log,
    mark,
    requestId,
  };
}
