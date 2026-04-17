// ═══════════════════════════════════════════════════════════════════════════
// HTA Market Access API — Express entry point
//
// Minimal server for Sprint 1. Routes added in later batches.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { requestLogger, errorHandler } from "./middleware/logging.js";
import { rateLimiter } from "./middleware/rate-limit.js";
import { csrfProtection } from "./middleware/csrf.js";
import { authenticate, authRoutes } from "./middleware/auth.js";
import { healthCheck, shutdown as dbShutdown } from "./db/connection.js";
import { status as llmStatus } from "./lib/llm-gateway.js";

const PORT = Number(process.env.API_PORT || process.env.PORT || 3011);
const IS_PROD = process.env.NODE_ENV === "production";

const DEFAULT_CORS_ORIGINS = IS_PROD
  ? []
  : [
      "http://localhost:5173",   // Vite default
      "http://localhost:3000",
      "http://127.0.0.1:5173",
    ];

const ALLOWED_CORS_ORIGINS = (process.env.CORS_ORIGIN || DEFAULT_CORS_ORIGINS.join(","))
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();
let server = null;

// ── Global middleware ─────────────────────────────────────────────────────

app.use(cors({
  origin: ALLOWED_CORS_ORIGINS,
  credentials: true,
}));

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(requestLogger);
app.use(authenticate);

// Rate limit all API routes
app.use("/api", rateLimiter({ rpm: 120 }));

// CSRF on state-changing requests
app.use(csrfProtection({ allowedOrigins: ALLOWED_CORS_ORIGINS }));

// ── Health endpoint ──────────────────────────────────────────────────────

app.get("/api/health", async (_req, res) => {
  const db = await healthCheck();
  const llm = llmStatus();

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    db,
    llm,
  });
});

// ── Auth routes ──────────────────────────────────────────────────────────

app.use("/api/auth", authRoutes);

// ── Placeholder for future route mounts ─────────────────────────────────
// Batch 4: sponsors, assets, trials, countries, search
// Batch 5: brain/chat

// ── Error handler (must be last) ─────────────────────────────────────────

app.use(errorHandler);

// ── Start server ─────────────────────────────────────────────────────────

function start() {
  server = app.listen(PORT, () => {
    console.log(`[api] HTA Market Access API listening on :${PORT}`);
    console.log(`[api] Health: http://localhost:${PORT}/api/health`);
  });
}

// ── Graceful shutdown ────────────────────────────────────────────────────

async function gracefulShutdown(signal) {
  console.log(`[api] ${signal} received, shutting down...`);
  if (server) {
    server.close(async () => {
      await dbShutdown();
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10000);
  } else {
    await dbShutdown();
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start if run directly (not imported)
const isMain = !process.argv[1] || import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain || process.argv[1]?.endsWith("api/index.js")) {
  start();
}

export default app;
