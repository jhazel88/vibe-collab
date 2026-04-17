// ═══════════════════════════════════════════════════════════════════════════
// Rate Limiter Middleware — In-memory sliding window
// In production: replace with Redis-backed limiter
//
// Donor: EU Digital Strategy Tracker api/middleware/rate-limit.js
// Changes: none — generic utility, lifted as-is
// ═══════════════════════════════════════════════════════════════════════════

const windows = new Map();

/**
 * Create a rate limiter middleware
 * @param {Object} opts
 * @param {number} opts.rpm - Requests per minute (default 60)
 * @param {string} opts.keyFn - Function to extract client key (default: IP)
 */
export function rateLimiter({ rpm = 60, keyFn } = {}) {
  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : (req.ip || req.headers["x-forwarded-for"] || "unknown");
    const windowKey = `${req.baseUrl}:${key}`;
    const now = Date.now();
    const windowMs = 60000;

    if (!windows.has(windowKey)) {
      windows.set(windowKey, []);
    }

    const timestamps = windows.get(windowKey);
    // Prune old entries
    const cutoff = now - windowMs;
    while (timestamps.length && timestamps[0] < cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= rpm) {
      res.set("Retry-After", "60");
      return res.status(429).json({
        error: "Rate limit exceeded",
        code: "RATE_LIMITED",
        retryAfter: 60,
      });
    }

    timestamps.push(now);
    res.set("X-RateLimit-Limit", String(rpm));
    res.set("X-RateLimit-Remaining", String(rpm - timestamps.length));

    next();
  };
}

// Periodic cleanup of stale windows (every 5 min)
setInterval(() => {
  const cutoff = Date.now() - 120000;
  for (const [key, timestamps] of windows.entries()) {
    if (!timestamps.length || timestamps[timestamps.length - 1] < cutoff) {
      windows.delete(key);
    }
  }
}, 300000);
