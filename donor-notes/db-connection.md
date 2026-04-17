# DB Connection + Migration Runner — Donor Notes

**Source:** `EHDSTracker_ChatGPT_Codex/api/db/connection.js` + `migrate.js`
**Target:** `api/db/connection.js` + `api/db/migrate.js`

## connection.js
Lifted as-is. Lazy PostgreSQL pool with dynamic import (handles missing `pg` gracefully), slow query warnings, health check, graceful shutdown. No domain-specific code.

## migrate.js
Lifted as-is. Sequential SQL migration runner with `schema_migrations` tracking table, dry-run support, `--from` flag for partial runs, transactional per-migration execution. No domain-specific code.

## 001_core_schema.sql
**New file** — not from donor. Schema designed for HTA market access domain per Sprint 1 plan. Tables: sponsors, assets, trials, hta_bodies, country_access_systems, market_access_pathways, hta_decisions, source_documents, chat_sessions, chat_messages.
