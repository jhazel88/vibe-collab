// ═══════════════════════════════════════════════════════════════════════════
// Request Logging & Error Handler Middleware
//
// Structured JSON logging in production; human-readable in development.
// Each request gets a correlation ID for tracing across services.
//
// Donor: EU Digital Strategy Tracker api/middleware/logging.js
// Changes: none — generic utility, lifted as-is
// ═══════════════════════════════════════════════════════════════════════════

import crypto from "crypto";

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Emit a structured log entry.
 * In production: JSON for log aggregators (Datadog, CloudWatch, etc.)
 * In development: human-readable single-line format
 */
function log(level, message, meta = {}) {
  if (IS_PROD) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };
    const output = JSON.stringify(entry);
    if (level === "error") console.error(output);
    else if (level === "warn") console.warn(output);
    else console.log(output);
  } else {
    // Development: concise human-readable format
    const metaStr = Object.keys(meta).length
      ? " " + Object.entries(meta).map(([k, v]) => `${k}=${v}`).join(" ")
      : "";
    const line = `[${level}] ${message}${metaStr}`;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }
}

export function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url } = req;

  // Assign a correlation ID for request tracing
  req.correlationId = req.headers["x-correlation-id"] || crypto.randomUUID().slice(0, 8);
  res.set("X-Correlation-ID", req.correlationId);

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

    // Always log errors and warnings; skip fast 2xx in production
    if (level !== "info" || duration > 500 || !IS_PROD) {
      log(level, `${method} ${url} ${status} ${duration}ms`, {
        correlationId: req.correlationId,
        method,
        url,
        status,
        duration_ms: duration,
        user: req.user?.sub || req.user?.email || undefined,
      });
    }
  });

  next();
}

export function errorHandler(err, req, res, _next) {
  log("error", `${req.method} ${req.url}: ${err.message}`, {
    correlationId: req.correlationId,
    method: req.method,
    url: req.url,
    stack: IS_PROD ? undefined : err.stack,
    code: err.code,
  });

  // Consistent error response format
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: IS_PROD ? "Internal server error" : err.message,
    code: err.code || "INTERNAL_ERROR",
    correlationId: req.correlationId,
  });
}

// Export log helper for use in other modules
export { log };
