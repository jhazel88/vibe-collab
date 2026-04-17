# Snapshot Store — Donor Notes

**Source:** `EHDSTracker_ChatGPT_Codex/api/services/snapshot-store.js` (214 lines)
**Target:** `api/services/snapshot-store.js`

## What was lifted
Content acquisition and deduplication service. Fetches URLs, computes SHA-256 content hashes, checks for duplicates, stores raw snapshots to local filesystem (with S3/R2 stubs for production).

## What was changed
- **Table references**: Changed from `evidence_objects` + `source_registry` (donor's EHDS pipeline tables) to `source_documents` (our simpler schema). Dedup query now checks `source_documents.content_hash` + `source_documents.url`.
- **User-Agent**: Changed from `EU-Digital-Strategy-Tracker/2.1` to `HTA-Market-Access-Tracker/0.1`.
- **Removed pipeline_runs logging**: Donor logs acquisition runs to a `pipeline_runs` table we don't have yet. Removed `logAcquisitionRun()` export.
- **Simplified source parameter**: Donor expects a `source_registry` row object with `external_id`, `api_endpoint`, `access_type`, `format`. Simplified to accept `{ url, doc_type, title }`.
- **Path sanitization**: Kept the path traversal protection, adapted key generation to use URL instead of `external_id`.

## What was NOT changed
Core logic: fetch with timeout/abort, SHA-256 hash normalization, local file storage with defense-in-depth path checks, S3/R2 stub pattern.
