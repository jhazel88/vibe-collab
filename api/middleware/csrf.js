// ═══════════════════════════════════════════════════════════════════════════
// CSRF Protection Middleware — Origin/Referer validation
//
// Stateless CSRF protection using the "Verifying Origin with Standard
// Headers" approach (OWASP recommended). Checks Origin and Referer headers
// on all state-changing requests (POST, PUT, PATCH, DELETE).
//
// In production: Origin must match an allowed list.
// In development: passes through for convenience (dev tools, curl, etc.)
//
// Donor: EU Digital Strategy Tracker api/middleware/csrf.js
// Changes: none — generic utility, lifted as-is
// ═══════════════════════════════════════════════════════════════════════════

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Create CSRF protection middleware.
 *
 * @param {Object} opts
 * @param {string[]} opts.allowedOrigins — List of allowed origins
 */
export function csrfProtection({ allowedOrigins = [] } = {}) {
  const originsSet = new Set(allowedOrigins.map(o => o.toLowerCase().replace(/\/$/, "")));

  return (req, res, next) => {
    // Only check state-changing methods
    const method = req.method.toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
      return next();
    }

    // In development, skip CSRF for convenience
    if (!IS_PROD) {
      return next();
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;

    // Extract origin from Referer if Origin header is absent
    let sourceOrigin = origin;
    if (!sourceOrigin && referer) {
      try {
        const url = new URL(referer);
        sourceOrigin = url.origin;
      } catch {
        // malformed referer
      }
    }

    // If neither Origin nor Referer is present, reject
    if (!sourceOrigin) {
      return res.status(403).json({
        error: "CSRF validation failed: missing Origin/Referer header",
        code: "CSRF_MISSING_ORIGIN",
      });
    }

    // Check against allowed origins
    const normalizedSource = sourceOrigin.toLowerCase().replace(/\/$/, "");
    if (!originsSet.has(normalizedSource)) {
      return res.status(403).json({
        error: "CSRF validation failed: origin not allowed",
        code: "CSRF_ORIGIN_MISMATCH",
      });
    }

    next();
  };
}
