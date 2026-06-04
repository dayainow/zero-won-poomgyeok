import type { VercelRequest, VercelResponse } from '@vercel/node';

type TimingMark = {
  label: string;
  ms: number;
};

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

  function log(level: 'info' | 'warn' | 'error', event: string, meta: Record<string, unknown>) {
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
