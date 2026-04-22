/**
 * Simple in-memory sliding window rate limiter.
 * In production, replace with Redis-based solution.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/**
 * Check rate limit for a given identifier.
 * @param identifier - Unique identifier (e.g., API key prefix, IP)
 * @param limit - Max requests per window
 * @param windowMs - Window size in milliseconds
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs, limit };
  }

  entry.count++;
  store.set(identifier, entry);

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, limit };
  }

  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt, limit };
}

/**
 * Create rate limit headers for the response
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { 'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)) }),
  };
}

/**
 * Returns a 429 response if rate limited
 */
export function rateLimitResponse(result: RateLimitResult): Response | null {
  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Too many requests. Please try again later.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...rateLimitHeaders(result),
        },
      }
    );
  }
  return null;
}
