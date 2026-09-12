/**
 * A minimal fixed-window rate limiter for public, unauthenticated endpoints.
 *
 * Deliberately in-process: Plan.md section 22 rules out adding Redis before the
 * workload justifies it. The limitation is real and worth stating - on Vercel
 * each serverless instance keeps its own counters, so the effective limit is
 * per-instance, not global. That is enough to blunt a naive script against a
 * single endpoint; it is not a defence against a distributed attacker. Move
 * this to shared storage when there is a reason to.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Bounds memory if a burst of unique keys arrives. */
const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window resets. */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) {
      for (const [k, w] of windows) {
        if (w.resetAt <= now) windows.delete(k);
      }
      // Still full of live windows: drop the limiter rather than grow unbounded.
      if (windows.size >= MAX_TRACKED_KEYS) {
        return { allowed: true, retryAfter: 0 };
      }
    }

    windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);

  return { allowed: existing.count <= limit, retryAfter };
}

/**
 * Best-effort client identity for rate limiting.
 *
 * x-forwarded-for is client-spoofable in general; on Vercel the left-most entry
 * is set by the platform. Good enough for throttling, never for authorization.
 */
export function clientKey(headers: Headers, scope: string): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}
