# Sprint 1 Hostile Audit

Date: 2026-04-17
Target audited: `vibe-collab/`
Auditor stance: hostile but fair

Scope note: the prompt lives under `vibe-collab/.codex/prompts/`, and the plan + donor-note paths it names only exist relative to `vibe-collab/`, not the workspace root. I audited the `vibe-collab` app as the intended Sprint 1 target.

## Phase 1: Plan-vs-Reality reconciliation

The repo contains most of the named backend pieces, but the end-to-end path described in the plan is not actually delivered. The biggest misses are the missing `AssetPage`, missing asset/trial routes in the frontend router, and the fact that the asset table is never populated.

| Batch | Planned item | Status | Issue |
|-------|--------------|--------|-------|
| 1 | Backend scaffold + donor runtime | Partial | Files exist, but Batch 1 exit is not met. `npm run dev` starts Vite, not Express ([package.json](../../package.json:7)); `npm run dev:api` is `node api/index.js` and crashes unless `NODE_ENV=development` or `JWT_SECRET` is set ([package.json](../../package.json:8), [api/middleware/auth.js](../../api/middleware/auth.js:27)). |
| 2 | Seed data for sponsors + HTA bodies + country pathways | Partial | `sponsors.json`, `hta-bodies.json`, `country-systems.json`, and `seed-loader.js` exist, but there is still no asset seed at all, so the `assets` table remains empty by design ([api/db/seed-loader.js](../../api/db/seed-loader.js:175)). |
| 3 | CT.gov ingestion | Partial | `ctgov-client.js`, `ctgov-ingest.js`, and `POST /api/ingest/ctgov` exist, but ingestion never writes `asset_id`, so trials are not linked to assets; sponsor matching is computed but not persisted anywhere useful ([api/services/ctgov-ingest.js](../../api/services/ctgov-ingest.js:273)). |
| 4 | Search + detail API | Partial | Routes exist, but `/api/assets` depends on an empty table, `/api/countries` does not paginate despite the batch saying each route should paginate, and search/filter semantics are wrong for array fields ([api/routes/assets.js](../../api/routes/assets.js:73), [api/routes/countries.js](../../api/routes/countries.js:24), [api/routes/search.js](../../api/routes/search.js:42)). |
| 5 | Thin retrieval service + chat route | Partial | `brain.js`, `retrieval.js`, `intent-classifier.js`, `prompt-templates.js`, and `response-contract.js` exist, but session context is ignored, pathway citations have no source URLs, and the route 500s when the DB is absent ([api/routes/brain.js](../../api/routes/brain.js:103), [api/services/retrieval.js](../../api/services/retrieval.js:197)). |
| 6 | Frontend scaffold + search page | Failed | `SearchPage.jsx` and `CountryPage.jsx` exist, but the planned `AssetPage.jsx` does not. A `SponsorPage.jsx` was added instead. The router only renders `search`, `sponsor`, and `country`, so `asset` and `trial` navigations fall into a blank state ([src/App.jsx](../../src/App.jsx:55), [src/pages/SearchPage.jsx](../../src/pages/SearchPage.jsx:69), [src/pages/SponsorPage.jsx](../../src/pages/SponsorPage.jsx:151)). |
| 7 | Chat panel | Partial | `ChatPanel.jsx`, `CitationBadge.jsx`, and `useChat.js` exist, but the context wiring is wrong: sponsor route context is sent as `asset_id`, and the backend never uses the provided context anyway ([src/App.jsx](../../src/App.jsx:24), [src/hooks/useChat.js](../../src/hooks/useChat.js:31), [api/routes/brain.js](../../api/routes/brain.js:84)). |
| 8 | Sprint 1 quality gate | Failed | No read-only quality gate evidence is present. The actual checks fail in the current checkout: `npm test` and `npm run build` both die before running due to a missing Tailwind native binding from Vite config, and the app cannot demonstrate the search -> asset -> trial -> pathway -> chat chain. |

Files that exist but were not in the Sprint 1 plan:

- `README.md`, `api/.env.example`, and `docs/` are benign extras.
- `data/raw/clinicaltrials-explore/*` is from Kasper's independent track and does not currently conflict with the app structure.

Files or plan items silently dropped:

- `src/pages/AssetPage.jsx` is missing.
- No asset loader, transformer, or seed file exists.
- No trial detail page exists even though multiple UI surfaces navigate to `"trial"`.

## Phase 2: Schema-to-code consistency

The schema is coherent on paper. The implementation is not. Several tables are dead, and multiple array-field queries are simply wrong.

Findings:

- CRITICAL: `assets` is a dead table from Sprint 1's perspective. The schema defines it ([api/db/migrations/001_core_schema.sql](../../api/db/migrations/001_core_schema.sql:20)), routes query it ([api/routes/assets.js](../../api/routes/assets.js:73)), and the UI expects it ([src/pages/SearchPage.jsx](../../src/pages/SearchPage.jsx:63)), but the seed loader never inserts assets ([api/db/seed-loader.js](../../api/db/seed-loader.js:175)) and CT.gov ingestion explicitly defers `asset_id` linking ([api/services/ctgov-ingest.js](../../api/services/ctgov-ingest.js:277)).
- HIGH: `hta_decisions` is dead schema. It is created in the migration ([api/db/migrations/001_core_schema.sql](../../api/db/migrations/001_core_schema.sql:101)) but no service, route, or seed file writes or reads it.
- HIGH: `source_documents` is effectively dead schema. It is created in the migration ([api/db/migrations/001_core_schema.sql](../../api/db/migrations/001_core_schema.sql:115)), but the only code touching it is the donor-lifted snapshot store dedup query ([api/services/snapshot-store.js](../../api/services/snapshot-store.js:43)). No seed path, ingest path, or chat path inserts source documents, so citation grounding never reaches this table.
- HIGH: array matching is backwards in multiple queries. The code uses `pattern ILIKE ANY(array_column)` instead of checking whether array elements match the pattern. This silently breaks therapeutic-area and condition search/filter behavior:
  - [api/routes/sponsors.js](../../api/routes/sponsors.js:45)
  - [api/routes/assets.js](../../api/routes/assets.js:59)
  - [api/routes/trials.js](../../api/routes/trials.js:67)
  - [api/routes/search.js](../../api/routes/search.js:45)
  - [api/services/retrieval.js](../../api/services/retrieval.js:25)
  - [api/services/retrieval.js](../../api/services/retrieval.js:91)
- MEDIUM: `chat_sessions` and `chat_messages` are live, but they only store opaque chat content and synthetic citations. There is no schema-level link from a citation back to `source_documents`, despite the schema commentary implying that grounding should come from source-document records ([api/db/migrations/001_core_schema.sql](../../api/db/migrations/001_core_schema.sql:126), [api/routes/brain.js](../../api/routes/brain.js:137)).

No material evidence found of code querying nonexistent columns or nonexistent tables. The problem is not typo drift. The problem is that half the schema is never exercised.

## Phase 3: API contract verification

Most routes have basic error handling and no obvious SQL string-concatenation injection bug. The real issues are broken contracts, empty dependencies, and runtime behavior that contradicts the advertised health mode.

Findings:

- CRITICAL: `GET /api/assets/:slug` cannot satisfy the batch contract because the app never creates assets and never links trials to them. The handler assumes an asset row exists and that trials are connected via `asset_id` ([api/routes/assets.js](../../api/routes/assets.js:103), [api/services/ctgov-ingest.js](../../api/services/ctgov-ingest.js:277)).
- HIGH: the API claims to have a graceful "file-based" no-DB mode, but real routes just crash on `null.rows`. `healthCheck()` returns `{ status: "no_database", mode: "file-based" }` when no DB exists ([api/db/connection.js](../../api/db/connection.js:69)), but `GET /api/search?q=pfizer` and `GET /api/countries/DE` both return 500 because route code assumes `query()` returned a result object:
  - `curl -s http://127.0.0.1:3011/api/health` -> `{"db":{"status":"no_database","mode":"file-based"}}`
  - `curl -s 'http://127.0.0.1:3011/api/search?q=pfizer'` -> `{"error":"Cannot read properties of null (reading 'rows')",...}`
  - `curl -s 'http://127.0.0.1:3011/api/countries/DE'` -> `{"error":"Cannot read properties of null (reading 'rows')",...}`
- HIGH: `GET /api/search` does not do what the Sprint 1 goal needs even with a DB. It can search sponsors, trials, and countries, but any asset results are dead because the UI has no asset page and the table is never filled. The route is present, but the sponsor/asset -> trial chain is not real ([api/routes/search.js](../../api/routes/search.js:58), [src/App.jsx](../../src/App.jsx:55)).
- MEDIUM: `/api/countries` does not paginate even though Batch 4 explicitly said each route should return paginated JSON ([api/routes/countries.js](../../api/routes/countries.js:24)).
- MEDIUM: `/api/ingest/ctgov` is nominally admin-only, but in the documented development mode the request is auto-authenticated as an admin via dev bypass. An anonymous `POST /api/ingest/ctgov` reaches the handler and only fails because the DB is missing, not because auth blocked it.
- LOW: sort/order parameters are whitelist-guarded in inspected routes, so I did not find a live SQL injection issue in route-level query construction.

## Phase 4: Brain pipeline end-to-end

This is the most dangerous section because it looks complete at a glance. It is not.

Trace findings:

- HIGH: session context is written and then ignored. The route accepts `context` and stores it in `chat_sessions` ([api/routes/brain.js](../../api/routes/brain.js:25)), but retrieval is called with only `{ query, lanes, entities }` and never receives the session context ([api/routes/brain.js](../../api/routes/brain.js:103)). This kills the claimed "context-aware" behavior.
- HIGH: if the DB is absent, the brain route does not degrade meaningfully. It returns a contract-shaped 500 with a generic apology. Runtime check:
  - `curl -s -X POST http://127.0.0.1:3011/api/brain/chat -H 'Content-Type: application/json' --data '{"message":"What is the HTA pathway in Germany?"}'`
  - Response: `{"answer":"I encountered an error processing your question. Please try again.", ...}`
- CRITICAL: country-pathway citations are synthetic, not grounded. The retrieval lane emits `source_url: null` for pathway snippets ([api/services/retrieval.js](../../api/services/retrieval.js:215)), and the brain route blindly turns every snippet into a citation ([api/routes/brain.js](../../api/routes/brain.js:137)). That means the most important Sprint 1 chat use case, "What's the HTA pathway in Germany?", cannot produce clickable evidence-backed citations from actual source documents.
- HIGH: `source_documents` never enters the brain path. The route does not query it, the retrieval layer does not query it, and citations do not refer to `source_document_id`. The entire "citation grounding" story is just "return whichever URLs happened to be attached to snippets," which is not the same thing.
- MEDIUM: if no LLM API key is configured, the gateway falls back to mock mode ([api/lib/llm-gateway.js](../../api/lib/llm-gateway.js:252), [api/lib/llm-gateway.js](../../api/lib/llm-gateway.js:287)). That is useful for development, but it also means "chat works" can be faked without proving any live analyst-quality answer path.
- LOW: the route does persist messages to `chat_sessions` and `chat_messages`; that part is not dead code ([api/routes/brain.js](../../api/routes/brain.js:96), [api/routes/brain.js](../../api/routes/brain.js:164)).

## Phase 5: Frontend-to-backend contract

The frontend is the clearest evidence that the Sprint 1 story was only partially wired. There are visible screens, but the route graph the user actually needs is broken.

Findings:

- CRITICAL: `SearchPage` navigates to route states the app does not render. Asset result cards call `onNavigate("asset", a.slug)` ([src/pages/SearchPage.jsx](../../src/pages/SearchPage.jsx:72)). Trial cards call `onNavigate("trial", t.nct_id)` ([src/pages/SearchPage.jsx](../../src/pages/SearchPage.jsx:102)). But `App.jsx` only renders `search`, `sponsor`, and `country` ([src/App.jsx](../../src/App.jsx:55)). Clicking either asset or trial results drops the user into an unhandled blank state.
- HIGH: the planned `AssetPage.jsx` is missing entirely. The actual shipped replacement is `SponsorPage.jsx`, which does not satisfy the planned asset-detail contract.
- HIGH: `SponsorPage` does not use a linked sponsor -> asset -> trial relationship. It fetches the sponsor, then does a free-text `GET /api/trials?q=<sponsor name>` search ([src/pages/SponsorPage.jsx](../../src/pages/SponsorPage.jsx:24)). That is a lossy heuristic, not a relational detail page.
- HIGH: "context-aware chat" is broken at the contract level. On sponsor pages, `App.jsx` sends `{ asset_id: route.id, mode: "sponsor" }` ([src/App.jsx](../../src/App.jsx:24)). But `route.id` is the sponsor slug, not an asset ID. Then the backend ignores the context anyway ([api/routes/brain.js](../../api/routes/brain.js:103)).
- MEDIUM: the frontend has basic loading/error handling on search, sponsor, and country pages. This part is not the problem. The problem is that the wrong pages were wired, and the routed states do not match the page components that exist.

## Phase 6: Donor provenance

This phase is cleaner than the rest.

Findings:

- No blocker found: donor notes exist for the donor-lifted runtime pieces:
  - [donor-notes/db-connection.md](../../donor-notes/db-connection.md:1)
  - [donor-notes/llm-gateway.md](../../donor-notes/llm-gateway.md:1)
  - [donor-notes/middleware.md](../../donor-notes/middleware.md:1)
  - [donor-notes/snapshot-store.md](../../donor-notes/snapshot-store.md:1)
- No blocking donor-specific strings were found in user-facing `src/` or API surface text. `rg -ni "ehds|european health data|policy pilot|policypilot" vibe-collab/src vibe-collab/api vibe-collab/data` only surfaced an internal code comment in `api/lib/llm-gateway.js`, not UI text.
- LOW: the repo docs are drifting. `README.md` claims the 7 HTA bodies are "NICE, SMC, G-BA, IQWiG, HAS, CEESP, CT" ([README.md](../../README.md:25)), but the shipped `hta-bodies.json` contains `CEPS` and `UNCAM`, not `CEESP` and `CT`. That is documentation drift, not a product-surface bug.

## Phase 7: Seed data quality

The sponsor and HTA-body seed files are mostly sane. The pathway seed is the weak point because it ships assertions without provenance.

Findings:

- No blocker found on `sponsors.json` completeness: I counted 220 records, 220 unique slugs, and no missing `slug`/`name` fields.
- No material factual naming issue found on the initial HTA bodies in spot checks. The seeded names/roles for NICE, G-BA, IQWiG, HAS, and CEPS line up with official sources:
  - [NICE technology appraisal guidance](https://www.nice.org.uk/what-nice-does/our-guidance/about-technology-appraisal-guidance/how-we-develop-technology-appraisal-guidance)
  - [G-BA benefit assessment of medicinal products](https://www.g-ba.de/english/benefitassessment/)
  - [IQWiG drug assessment department](https://www.iqwig.de/en/about-us/institute-structure/departments/drug-assessment/)
  - [HAS Transparency Committee example page](https://www.has-sante.fr/jcms/p_3375779/en/xarelto-rivaroxaban)
  - [CEPS official page](https://sante.gouv.fr/comite-economique-des-produits-de-sante-ceps)
- HIGH: `country-systems.json` contains detailed pathway claims but zero provenance fields. There is no top-level `sources` array per country, no per-step source URL, and nothing the chat system can turn into a real citation ([api/db/seed-json/country-systems.json](../../api/db/seed-json/country-systems.json:2)). This makes the pathway data impossible to independently verify from inside the product.
- MEDIUM: step ordering for the three launch countries is sequential and free of obvious numbering gaps, but that is the minimum bar. Because there is no provenance attached, correctness still depends entirely on trusting the curator.

## Phase 8: Security surface

No shell/eval landmines showed up. The main security issue is auth bypass behavior in the exact mode the README tells you to use.

Findings:

- HIGH: in development mode, every unauthenticated request gets a default admin user via `getDevUser()` ([api/middleware/auth.js](../../api/middleware/auth.js:95), [api/middleware/auth.js](../../api/middleware/auth.js:170)). That means `requireAuth` + `requireRole("admin")` do not meaningfully protect `POST /api/ingest/ctgov` while `NODE_ENV=development` ([api/routes/ingest.js](../../api/routes/ingest.js:25)).
- MEDIUM: the README explicitly recommends `NODE_ENV=development` in local setup ([README.md](../../README.md:58)), which is the same switch that opens the admin bypass. That is convenient for local hacking, but it means the current "admin-only" claim is environment-dependent and easy to misunderstand.
- No committed `.env` file was found. Only `api/.env.example` exists.
- I did not find any route that passes user input to a shell command or `eval()`.
- CSRF protection is only active in production by design ([api/middleware/csrf.js](../../api/middleware/csrf.js:27)). That is acceptable as a dev-only convenience, but it means state-changing routes are unprotected in the same environment where auth is also bypassed.

## Phase 9: Test coverage honesty

This is not a tested system. It is a smoke-demo with one component test.

Findings:

- HIGH: only one test file exists: [src/components/__tests__/App.test.jsx](../../src/components/__tests__/App.test.jsx:1).
- HIGH: that file contains exactly two trivial assertions: title renders, and the search page renders by default ([src/components/__tests__/App.test.jsx](../../src/components/__tests__/App.test.jsx:5)). There are no API-route tests, no brain pipeline tests, no seed integrity tests, no ingestion tests, and no frontend contract tests for asset/trial routing.
- HIGH: the current checkout does not even complete basic verification commands:
  - `npm test` fails before test execution because Vite cannot load `@tailwindcss/oxide-darwin-arm64` from [vite.config.js](../../vite.config.js:1).
  - `npm run build` fails for the same reason.
- Real coverage of the stated Sprint 1 goal is effectively zero. There is no automated assertion anywhere for "search -> asset -> trials -> country pathway -> chat with citations."

## Phase 10: Verdict

### Summary table

| Severity | Finding | Evidence |
|----------|---------|----------|
| CRITICAL | The core asset backbone does not exist in practice: no asset seed, no asset ingestion, no trial-to-asset linkage. | [api/db/seed-loader.js](../../api/db/seed-loader.js:175), [api/services/ctgov-ingest.js](../../api/services/ctgov-ingest.js:277), [api/routes/assets.js](../../api/routes/assets.js:103) |
| CRITICAL | The frontend route graph is broken: asset/trial clicks navigate to route states the app never renders. | [src/pages/SearchPage.jsx](../../src/pages/SearchPage.jsx:69), [src/pages/SearchPage.jsx](../../src/pages/SearchPage.jsx:98), [src/App.jsx](../../src/App.jsx:55) |
| CRITICAL | Pathway chat citations are not grounded to real source URLs or source-document rows. | [api/services/retrieval.js](../../api/services/retrieval.js:197), [api/routes/brain.js](../../api/routes/brain.js:137), [api/db/seed-json/country-systems.json](../../api/db/seed-json/country-systems.json:2) |
| HIGH | The advertised no-DB/file-based mode is fake; routes crash on `null.rows`. | [api/db/connection.js](../../api/db/connection.js:48), [api/routes/search.js](../../api/routes/search.js:42), [api/routes/countries.js](../../api/routes/countries.js:81) |
| HIGH | Default API startup path crashes unless env is manually fixed. | [package.json](../../package.json:8), [api/middleware/auth.js](../../api/middleware/auth.js:27) |
| HIGH | Therapeutic-area and condition search/filter SQL is reversed and silently wrong. | [api/routes/sponsors.js](../../api/routes/sponsors.js:45), [api/routes/assets.js](../../api/routes/assets.js:59), [api/routes/trials.js](../../api/routes/trials.js:67), [api/routes/search.js](../../api/routes/search.js:45), [api/services/retrieval.js](../../api/services/retrieval.js:25) |
| HIGH | Development-mode auth bypass turns admin-only ingestion into a public route. | [api/middleware/auth.js](../../api/middleware/auth.js:95), [api/middleware/auth.js](../../api/middleware/auth.js:170), [api/routes/ingest.js](../../api/routes/ingest.js:25) |
| MEDIUM | Chat context is persisted but unused; sponsor page sends sponsor slug as `asset_id`. | [src/App.jsx](../../src/App.jsx:24), [src/hooks/useChat.js](../../src/hooks/useChat.js:31), [api/routes/brain.js](../../api/routes/brain.js:103) |
| MEDIUM | `/api/countries` skips pagination despite the batch contract saying routes paginate. | [api/routes/countries.js](../../api/routes/countries.js:24) |
| MEDIUM | Verification is blocked and coverage is negligible: one trivial test file, and current `npm test` / `npm run build` fail at startup. | [src/components/__tests__/App.test.jsx](../../src/components/__tests__/App.test.jsx:1), [vite.config.js](../../vite.config.js:1) |
| LOW | README seed-data documentation does not match the shipped HTA body file. | [README.md](../../README.md:25), [api/db/seed-json/hta-bodies.json](../../api/db/seed-json/hta-bodies.json:1) |

### 1. Can this system actually deliver the Sprint 1 goal end-to-end?

No.

What works:

- There is a basic backend skeleton.
- Sponsor, country, search, chat, and ingest routes exist.
- Sponsor seed data and three country pathway seed sets exist.
- Chat messages can be persisted when a DB is configured.

What does not work:

- The chain starts with "search sponsor or asset," but the asset side is fake. There is no asset page, no asset seed, and no trial-to-asset linkage.
- The frontend literally cannot render asset or trial routes when users click those search results.
- Country pathway chat answers cannot be genuinely cited because pathway snippets have no source URLs and `source_documents` is not wired into retrieval.
- The app's fallback story is misleading: with no DB, health says "file-based mode" but real routes 500.
- The quality gate has not been met. The current checkout does not pass `npm test` or `npm run build`.

Best-case truthful statement: this repo contains a promising Sprint 1 skeleton, not a completed Sprint 1 product.

### 2. What is the single biggest risk if the team continues building on this foundation?

The biggest risk is building Sprint 2 on top of stubs that look finished but are not actually connected. This codebase already has the dangerous shape of a product where routes exist, UI exists, and the README sounds convincing, but the core relational links and citation provenance are missing. If the team keeps layering features on top of that, they will accumulate a lot of surface area without ever getting a trustworthy data spine.

### 3. What are the top 3 things to fix before starting Sprint 2?

1. Build the real asset spine.
   That means: create asset seed/ingest, populate `assets`, link `trials.asset_id`, and ship a real `AssetPage` that the router can render.

2. Fix route/UI wiring before adding scope.
   Add real `asset` and `trial` routes in the frontend, remove broken navigations, and make page context semantically correct and actually used by the brain route.

3. Make grounding honest.
   Attach provenance URLs or source-document records to country pathway data, wire `source_documents` into retrieval/citation generation, and prove one real cited pathway answer end to end.

