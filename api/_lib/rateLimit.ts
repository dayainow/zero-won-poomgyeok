type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function enforceRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const current = buckets.get(options.key);

  if (!current || current.resetAt <= now) {
    buckets.set(options.key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return;
  }

  if (current.count >= options.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    const error = new Error('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.') as Error & {
      status?: number;
      retryAfterSec?: number;
    };
    error.status = 429;
    error.retryAfterSec = retryAfterSec;
    throw error;
  }

  current.count += 1;
  buckets.set(options.key, current);
}
