import 'server-only';

// Tiny in-memory rate limiter for the auth actions. Resets on container
// restart, which is fine — it only needs to blunt password brute force on a
// single-instance deployment.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 2000) {
    buckets.forEach((b, k) => { if (now > b.resetAt) buckets.delete(k); });
  }
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}
