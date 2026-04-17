# Middleware — Donor Notes

**Source:** `EHDSTracker_ChatGPT_Codex/api/middleware/` (rate-limit.js, logging.js, csrf.js, auth.js)
**Target:** `api/middleware/`

## rate-limit.js
Lifted as-is. Generic in-memory sliding window rate limiter with periodic cleanup. No domain-specific code.

## logging.js
Lifted as-is. Structured JSON logging in production, human-readable in dev. Correlation ID per request. Error handler middleware. No domain references.

## csrf.js
Lifted as-is. Stateless CSRF protection via Origin/Referer validation (OWASP approach). Skips in development. No domain references.

## auth.js
Adapted from donor. Changes:
- **Removed tier-gate**: The donor has `tier` (public/researcher/institutional/enterprise) for content gating. Not needed for Sprint 1 — removed from token payload and /me endpoint.
- **Removed DB user lookup**: The donor's `/me` endpoint queries `app_users` table. We don't have that table yet, so `/me` returns JWT claims only.
- **Simplified role hierarchy**: Removed `senior_editor` (not needed for two-person team). Kept `viewer < editor < admin`.
- **Updated domain references**: Changed `hdgh-dev-secret` to `hta-dev-secret`, email domain from `hdgh.local` to `hta.local`.
- **Removed ALLOW_DEV_LOGIN_IN_PROD**: Simplified — dev login only available in development mode.
