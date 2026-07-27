import { RateLimitError } from "./errors";

/**
 * Minimal in-memory fixed-window rate limiter for sensitive endpoints
 * (login, forgot-password). Per-process only — fine for a single instance;
 * swap for a Redis-backed limiter when scaling horizontally.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > opts.limit) {
    throw new RateLimitError();
  }
}
