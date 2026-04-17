# Sprint 1 Remediation Plan

Date: 2026-04-17
Status: ready to execute
Depends on: `.codex/audits/sprint-1-hostile-audit-2026-04-17.md`
Goal: **Make Sprint 1 actually work end-to-end** — search sponsor or asset → see linked trial + country roadmap → ask grounded question → get cited answer.

## Bottom line

The hostile audit found 3 CRITICAL, 6 HIGH, 3 MEDIUM, and 1 LOW issue. Sprint 1 was built as a skeleton but never wired end-to-end. The three structural blockers are: (1) the asset spine doesn't exist in practice, (2) the frontend route graph has dead links, and (3) pathway citations aren't grounded to real sources. The fix is 6 focused batches that close those gaps without expanding scope. No new features — just make what's there actually work.

## Severity map (from audit)

| # | Severity | Finding | Fix batch |
|---|----------|---------|-----------|
| 1 | CRITICAL | No asset seed, no asset page, no trial-to-asset linkage | R1, R3 |
| 2 | CRITICAL | Frontend routes `asset`/`trial` navigate to blank states | R3 |
| 3 | CRITICAL | Pathway citations have no real source URLs; `source_documents` unused | R2 |
| 4 | HIGH | No-DB "file-based mode" returns 500 on real routes | R4 |
| 5 | HIGH | `node api/index.js` crashes without manual env setup | R4 |
| 6 | HIGH | Array search SQL is backwards (`$1 ILIKE ANY(col)` instead of `ANY(col) ILIKE $1`) | R4 |
| 7 | HIGH | Dev-mode auth bypass makes ingest route public | R4 |
| 8 | HIGH | `hta_decisions` and `source_documents` tables are dead | R2 (source_documents); hta_decisions stays deferred |
| 9 | MEDIUM | Chat context persisted but ignored; sponsor page sends slug as `asset_id` | R3 |
| 10 | MEDIUM | `/api/countries` skips pagination | R4 |
| 11 | MEDIUM | Tests: 1 file, 2 trivial assertions, `npm test`/`npm run build` fail at startup | R5 |
| 12 | LOW | README HTA body names don't match seed file | R6 |

---

## Batch R1: Asset spine — seed + ingest linkage

**Problem:** The `assets` table is permanently empty. CT.gov ingestion computes sponsor matches but never writes `asset_id`. The entire sponsor → asset → trial chain is broken at the data level.

**Scope:**
- `api/db/seed-json/assets.json` — NEW. Curate 20–30 well-known oncology assets (pembrolizumab, nivolumab, trastuzumab, etc.) with correct `sponsor_id` linkage via slug, phase, modality, indications. These are the assets that will actually appear in search and have trials linked to them.
- `api/db/seed-loader.js` — ADD asset upsert function. Insert after sponsors (FK dependency). Match `sponsor_id` by looking up sponsor slug.
- `api/services/ctgov-ingest.js` — FIX trial-to-asset linking. After sponsor match, attempt to match the trial's intervention names against known assets (by name/slug). Write `asset_id` into the upsert if matched.

**Files touched:**
```
api/db/seed-json/assets.json          — NEW
api/db/seed-loader.js                 — EDIT (add upsertAssets)
api/services/ctgov-ingest.js          — EDIT (link trials to assets)
```

**Exit criteria:**
- `npm run seed` populates `assets` table with 20+ rows, each linked to a sponsor
- After running CT.gov ingest, at least 5 trials have a non-null `asset_id`
- `SELECT a.name, COUNT(t.id) FROM assets a JOIN trials t ON t.asset_id = a.id GROUP BY a.name` returns results

**Verification:** Run seed, run ingest, run the join query above.

---

## Batch R2: Citation grounding — pathway provenance + source_documents

**Problem:** Country pathway snippets emit `source_url: null`. The `source_documents` table is never populated or queried. Citations in chat answers are synthetic labels, not evidence.

**Scope:**
- `api/db/seed-json/country-systems.json` — ADD `source_url` and `source_label` to each country's top-level object AND to each pathway step. These are real URLs to official HTA body methodology pages. Sources:
  - UK: `https://www.nice.org.uk/process/pmg9/` (Guide to the processes of technology appraisal)
  - DE: `https://www.g-ba.de/english/benefitassessment/` (G-BA benefit assessment overview)
  - FR: `https://www.has-sante.fr/jcms/c_412113/en/drugs` (HAS drugs evaluation overview)
- `api/db/migrations/001_core_schema.sql` — ADD `source_url TEXT` column to `market_access_pathways` table. (Or create `002_pathway_source_url.sql` migration if you prefer not to edit 001.)
- `api/db/seed-loader.js` — EDIT pathway upsert to write `source_url` from seed data
- `api/services/retrieval.js` — FIX `countryPathwayLane`: set `source_url` from the pathway step's `source_url` field instead of hardcoded `null`. If a step has no per-step URL, fall back to the country-level source URL.
- `api/routes/brain.js` — WIRE citation extraction to produce citations only when `source_url` is non-null. Drop citations with no URL instead of emitting them as unclickable labels.
- `api/services/retrieval.js` — ADD: after retrieval, insert unique source URLs into `source_documents` (upsert on URL) so the table is no longer dead. This is a write-through cache, not a lookup dependency — retrieval still works if `source_documents` is empty.

**Files touched:**
```
api/db/seed-json/country-systems.json  — EDIT (add source_url per country + per step)
api/db/migrations/002_pathway_source.sql — NEW (add source_url to market_access_pathways)
api/db/seed-loader.js                  — EDIT (write source_url on pathway upsert)
api/services/retrieval.js              — EDIT (emit real source_url; write-through to source_documents)
api/routes/brain.js                    — EDIT (filter out null-URL citations)
```

**Exit criteria:**
- Every pathway step in the seed has a `source_url` pointing to a real, publicly accessible page
- Chat answer for "What's the HTA pathway in Germany?" returns at least one citation with a clickable URL
- `SELECT COUNT(*) FROM source_documents` > 0 after a chat session

**Verification:** Seed, ask a pathway question via curl, inspect citation URLs, query source_documents.

---

## Batch R3: Frontend route graph — AssetPage + TrialPage + context fix

**Problem:** `SearchPage` navigates to `asset` and `trial` route states that `App.jsx` never renders. `AssetPage.jsx` was planned but never created. Chat context sends sponsor slug as `asset_id`.

**Scope:**
- `src/pages/AssetPage.jsx` — NEW. Fetches `GET /api/assets/:slug`. Shows asset name, phase, modality, indications, linked sponsor (click-through), linked trials list (using `GET /api/trials?asset_id=`). Back navigation.
- `src/pages/TrialPage.jsx` — NEW. Fetches `GET /api/trials/:nctId`. Shows full trial detail: title, NCT ID, phase, status, enrollment, conditions, interventions, countries, dates, ClinicalTrials.gov link. Back navigation.
- `src/App.jsx` — ADD routes for `asset` and `trial`:
  ```jsx
  {route.page === "asset" && route.id && <AssetPage slug={route.id} onNavigate={navigate} />}
  {route.page === "trial" && route.id && <TrialPage nctId={route.id} onNavigate={navigate} />}
  ```
- `src/App.jsx` — FIX `chatContext` to use correct semantics:
  ```jsx
  if (route.page === "sponsor" && route.id) return { sponsor_slug: route.id, mode: "sponsor" };
  if (route.page === "asset" && route.id) return { asset_slug: route.id, mode: "asset" };
  if (route.page === "country" && route.id) return { country_iso: route.id, mode: "country" };
  ```
- `src/pages/SponsorPage.jsx` — FIX trial loading: use `GET /api/trials?sponsor_id=<id>` instead of free-text `?q=<name>` heuristic (requires fetching sponsor first to get ID, which the page already does).
- `api/routes/brain.js` — WIRE session context into retrieval call. If context has `country_iso`, add `country_pathway_lane`. If context has `asset_slug` or `sponsor_slug`, add `sponsor_lane` and `trial_lane` with entity hints.

**Files touched:**
```
src/pages/AssetPage.jsx     — NEW
src/pages/TrialPage.jsx     — NEW
src/App.jsx                 — EDIT (add routes + fix chatContext)
src/pages/SponsorPage.jsx   — EDIT (fix trial loading)
api/routes/brain.js         — EDIT (wire context into retrieval)
```

**Exit criteria:**
- Clicking an asset result in search navigates to AssetPage with real data
- Clicking a trial result navigates to TrialPage with real data
- No blank states in the route graph
- Chat on a country page retrieves pathway data for that country specifically

**Verification:** Search "pembrolizumab", click asset → see asset detail → click trial → see trial detail → go back → navigate to country → open chat → ask pathway question → answer references that country.

---

## Batch R4: Backend hardening — SQL fixes, null-safety, env defaults

**Problem:** Array search is backwards, routes crash without a DB, server startup requires manual env setup, dev auth bypass is too permissive, countries endpoint skips pagination.

**Scope:**

**SQL array fix** — In all files that use `$N ILIKE ANY(array_column)`, reverse to `EXISTS (SELECT 1 FROM unnest(array_column) AS elem WHERE elem ILIKE $N)`. Files:
- `api/routes/sponsors.js` (therapeutic_areas filter)
- `api/routes/assets.js` (indications filter)
- `api/routes/trials.js` (conditions filter)
- `api/routes/search.js` (conditions/therapeutic_areas in cross-entity search)
- `api/services/retrieval.js` (conditions search in trial lane)

**Null-safety on DB queries** — Wrap every `query()` call in routes with a null check. If `query()` returns `null` (no DB), return a 503 with `{ error: "Database not available" }` instead of crashing on `null.rows`. Apply to all route files.

**Server startup** — In `api/index.js`, set `NODE_ENV` default to `"development"` if unset, so `node api/index.js` works without manual env config. Add `.env.example` if not present (it exists per audit).

**Dev auth hardening** — In `api/middleware/auth.js`, change dev bypass to set role `"user"` not `"admin"`. Add a separate `DEV_ADMIN=true` env var required to get admin in dev mode. This makes the ingest route require explicit opt-in.

**Countries pagination** — Add `limit`/`offset` params to `GET /api/countries` matching the pattern used in other routes.

**Files touched:**
```
api/routes/sponsors.js       — EDIT (array SQL fix + null safety)
api/routes/assets.js          — EDIT (array SQL fix + null safety)
api/routes/trials.js          — EDIT (array SQL fix + null safety)
api/routes/countries.js       — EDIT (add pagination + null safety)
api/routes/search.js          — EDIT (array SQL fix + null safety)
api/routes/brain.js           — EDIT (null safety)
api/services/retrieval.js     — EDIT (array SQL fix)
api/middleware/auth.js         — EDIT (dev bypass → user role, DEV_ADMIN opt-in)
api/index.js                  — EDIT (NODE_ENV default)
```

**Exit criteria:**
- `node api/index.js` starts without crashing in a fresh shell (no env vars)
- `curl localhost:3011/api/health` returns 200 with `no_database` status
- `curl localhost:3011/api/search?q=pfizer` returns 503 with clear error (not 500 with `null.rows`)
- `curl -X POST localhost:3011/api/ingest/ctgov` returns 403 (not 200) without `DEV_ADMIN=true`
- With DB: `GET /api/sponsors?area=oncology` returns correct results (not reversed match)

**Verification:** Start server fresh, hit all endpoints without DB, verify 503s. Then with DB, test filtered queries.

---

## Batch R5: Test + build fix — make verification possible

**Problem:** `npm test` and `npm run build` fail before running due to Tailwind native binding issue. Only 2 trivial test assertions exist. No test covers the e2e chain.

**Scope:**

**Build fix** — The Tailwind v4 `@tailwindcss/vite` plugin requires a platform-specific native binary (`@tailwindcss/oxide-*`). Two options:
1. Pin to a version that works (check `npm ls @tailwindcss/oxide*` on your machine)
2. If the oxide binary is a dev-machine issue only, add a `postinstall` script or document it

**Test additions** — Add meaningful tests, not exhaustive coverage. Target the chain:
- `src/components/__tests__/App.test.jsx` — ADD: test that asset and trial routes render (once AssetPage/TrialPage exist)
- `api/__tests__/routes.test.js` — NEW. Lightweight route-shape tests using supertest or direct handler calls. Verify:
  - `/api/health` returns 200
  - `/api/sponsors` returns array shape
  - `/api/search?q=test` returns grouped results
  - `/api/brain/chat` with a message returns the response contract shape
- `api/__tests__/seed-integrity.test.js` — NEW. Load seed JSON files and verify:
  - All sponsors have `slug` + `name`
  - All assets have `slug` + `name` + valid `sponsor_slug`
  - All pathway steps have sequential `step_order` with no gaps
  - All pathway steps have non-null `source_url`
  - HTA body country_iso values exist in country-systems

**Files touched:**
```
package.json                              — EDIT (fix tailwind/vite if needed)
src/components/__tests__/App.test.jsx     — EDIT (add route tests)
api/__tests__/routes.test.js              — NEW
api/__tests__/seed-integrity.test.js      — NEW
```

**Exit criteria:**
- `npm test` passes
- `npm run build` succeeds
- At least 10 meaningful assertions exist
- Seed integrity test catches a missing `source_url` if someone removes one

**Verification:** `npm test` green, `npm run build` produces dist/.

---

## Batch R6: Documentation + quality gate re-run

**Problem:** README doesn't match reality. Audit identified doc drift on HTA body names.

**Scope:**
- `README.md` — FIX HTA body list to match actual `hta-bodies.json` (CEPS not CEESP, UNCAM not CT)
- `README.md` — ADD note about required DB for API routes (remove implication of file-based fallback)
- `README.md` — ADD `AssetPage` and `TrialPage` to project structure
- `.codex/plans/SPRINT-1-EXECUTION-PLAN.md` — UPDATE status to reflect actual completion after remediation

**Re-run quality gate (Batch 8 checklist):**
- [ ] Search → asset → trials → country pathway → chat with citations works e2e
- [ ] At least 1 asset links to sponsor + trial records
- [ ] At least 3 countries with pathways render with source URLs
- [ ] Chat returns cited answers with clickable source URLs
- [ ] No EHDS terminology in user-facing surface
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] Donor notes exist for every lifted file

**Files touched:**
```
README.md                                    — EDIT
.codex/plans/SPRINT-1-EXECUTION-PLAN.md      — EDIT
.codex/audits/sprint-1-remediation-gate.md   — NEW (gate results)
```

---

## Execution order

```
R1 (asset spine)  →  R2 (citation grounding)  →  R3 (frontend routes)  →  R4 (backend hardening)  →  R5 (tests)  →  R6 (docs + gate)
```

R1 and R2 are data-layer fixes that R3 depends on (AssetPage needs assets; citations need URLs). R4 is independent but sequenced after R3 so the null-safety fixes cover the new pages too. R5 must come after all code changes. R6 is the final gate.

Estimated: 2–3 sessions. Each batch is a single commit.

## What this plan does NOT do

- Does not add new features, countries, or HTA bodies
- Does not build Sprint 2 scope (NICE API, compare mode, 5A scoring)
- Does not fix `hta_decisions` (stays deferred — no data source yet)
- Does not add semantic search / pgvector (Sprint 2)
- Does not change the chat architecture (just wires what's there)
