// In-process fixed-window rate limiter.
//
// ponytail: per-instance only — counters live in this process's memory, so the
// limit is per-pod and resets on restart. That's the right amount of code for a
// single-instance deploy. If you scale horizontally or need durable/global
// limits, swap the Map for Redis/Upstash behind this same `rateLimit` signature.

type Bucket = { count: number; resetAtMs: number };

const buckets = new Map<string, Bucket>();
// Backstop so a flood of unique keys (e.g. spoofed IPs) can't grow memory
// without bound. Mirrors the session cache's clear-on-overflow strategy.
const MAX_KEYS = 10_000;

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

/**
 * Counts one hit against `key`. Returns `ok: false` once `limit` hits land
 * inside the rolling `windowMs`, with `retryAfterSeconds` until the window
 * resets. Fail-open by design: a limiter bug must never lock users out.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAtMs <= now) {
    if (buckets.size >= MAX_KEYS) buckets.clear();
    buckets.set(key, { count: 1, resetAtMs: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAtMs - now) / 1000)) };
  }
  bucket.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/** Best-effort client identifier from proxy headers; "unknown" collapses to a shared bucket. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Test-only: clear all counters between cases. */
export function __resetRateLimits(): void {
  buckets.clear();
}
