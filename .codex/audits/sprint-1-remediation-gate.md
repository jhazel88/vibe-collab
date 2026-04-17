# Sprint 1 Remediation Gate — Sign-off

**Date:** 2026-04-17
**Auditor:** Claude (post-remediation verification)
**Scope:** R1–R6 remediation of Sprint 1 hostile audit findings

## Hostile Audit → Remediation Mapping

| ID | Severity | Finding | Batch | Status |
|----|----------|---------|-------|--------|
| C1 | CRITICAL | Citations have no source URLs — hallucinated grounding | R2 | ✅ FIXED |
| C2 | CRITICAL | AssetPage + TrialPage missing — dead route links | R3 | ✅ FIXED |
| C3 | CRITICAL | `ILIKE ANY(array)` reversed SQL semantics | R4 | ✅ FIXED |
| H1 | HIGH | No DB-gated middleware — null.rows crashes | R4 | ✅ FIXED |
| H2 | HIGH | Dev auth defaults to admin role | R4 | ✅ FIXED |
| H3 | HIGH | Countries endpoint missing pagination | R4 | ✅ FIXED |
| H4 | HIGH | chatContext uses wrong field names | R3 | ✅ FIXED |
| H5 | HIGH | SponsorPage loads trials by name search instead of ID | R3 | ✅ FIXED |
| H6 | HIGH | source_documents missing UNIQUE index on url | R2 | ✅ FIXED |
| M1 | MEDIUM | No seed data integrity tests | R5 | ✅ FIXED |
| M2 | MEDIUM | NODE_ENV not defaulted — startup requires manual env | R4 | ✅ FIXED |
| M3 | MEDIUM | README outdated (missing pages, wrong HTA names) | R6 | ✅ FIXED |
| L1 | LOW | COALESCE missing on trial upsert asset_id | R1 | ✅ FIXED |

**All 13 findings resolved: 3 CRITICAL, 6 HIGH, 3 MEDIUM, 1 LOW.**

## Quality Gate Checklist

| # | Check | Result |
|---|-------|--------|
| 1 | `npm test` passes | ✅ 14 tests, 2 files, 0 failures |
| 2 | `npm run build` succeeds | ✅ Built in 208ms (227 KB JS, 23 KB CSS) |
| 3 | No EHDS terminology in user-facing surface (`src/`, `index.html`) | ✅ Zero matches |
| 4 | Donor notes exist for all lifted files | ✅ 4 donor-notes cover all 8 donor files |
| 5 | Every pathway step has source_url in seed data | ✅ Verified by seed-integrity tests |
| 6 | Every country has source_url in seed data | ✅ Verified by seed-integrity tests |
| 7 | Asset slugs unique, sponsor_slug refs valid | ✅ Verified by seed-integrity tests |
| 8 | Array SQL uses EXISTS/unnest pattern (no ILIKE ANY) | ✅ Grep-verified across all routes + services |
| 9 | requireDB middleware on all data + brain routes | ✅ Applied in api/index.js |
| 10 | Dev auth defaults to viewer (not admin) | ✅ Requires DEV_ADMIN=true for admin |

## Remediation Batch Summary

**R1 — Trial ingest hardening:** COALESCE on asset_id upsert, alias-based asset matching.

**R2 — Citation grounding:** 24 pathway steps across GB/DE/FR now carry real source_url fields pointing to official HTA methodology pages (NICE, G-BA, HAS). Write-through cache to source_documents with unique index. Brain route filters out null-URL citations.

**R3 — Frontend route graph:** AssetPage.jsx and TrialPage.jsx created. App.jsx renders them on "asset" and "trial" routes. chatContext fixed to use correct field names (sponsor_slug, asset_slug, nct_id). SponsorPage loads trials by sponsor_id instead of name search.

**R4 — Backend hardening:** All `ILIKE ANY(array)` patterns replaced with `EXISTS (SELECT 1 FROM unnest(array) AS elem WHERE elem ILIKE $N)`. requireDB middleware gates all data routes (503 on no DB). NODE_ENV defaults to "development". Dev role defaults to "viewer". Countries endpoint gains pagination.

**R5 — Seed integrity tests:** 14 Vitest tests validate all seed JSON for completeness, referential integrity, uniqueness, sequential step ordering, and source_url presence.

**R6 — Docs + quality gate:** README updated with accurate features, seed counts, HTA body names, project structure. This gate document written.

## Verdict

**PASS.** All hostile audit findings remediated. Sprint 1 is functionally complete for the e2e flow: search → sponsor/asset → trials → country pathway → grounded chat with cited answers.

## Next Steps

- Commit all R1–R6 changes
- Push to origin/main
- Proceed to Sprint 2 scope (if applicable to this repo)
