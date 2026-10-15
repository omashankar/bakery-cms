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

/**
 * Expired buckets are dropped as the map grows.
 *
 * They were only ever REPLACED, when the same key came back, and the login and
 * reset routes mint one key per email typed — unauthenticated. A stream of
 * random addresses grew the map until the process ran out of memory.
 */
const SWEEP_AT = 5_000;

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): void {
  const now = Date.now();
  if (buckets.size >= SWEEP_AT) sweep(now);
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
