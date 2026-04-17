# Sprint 1 Execution Plan — HTA Market Access Product

Date: 2026-04-17
Status: ready to execute
Depends on: `HTA-REUSE-BACKBONE-PLAN.md` (donor strategy)

## Sprint 1 Goal

Prove one end-to-end path:

**search sponsor or asset → see linked trial + country roadmap → ask grounded question → get cited answer**

## Sprint 1 Exit Criteria

- [ ] At least one asset links to a sponsor and live ClinicalTrials.gov trial records
- [ ] At least three countries render structured market-access pathways
- [ ] Chat answers a basic question with visible citations from those sources only
- [ ] No EHDS terminology in user-facing surface
- [ ] All existing vibe-collab tests still pass

## Batch Structure

8 batches, ordered to match the extraction sequence in the backbone plan. Each batch is a single commit with clear scope. No batch touches files outside its scope.

---

### Batch 1: Backend scaffold + donor runtime

**Scope:** Express API server, DB connection, LLM gateway, core middleware

**New files:**
```
api/
  index.js              — Express entry point
  lib/
    llm-gateway.js      — lifted from donor, task map updated for HTA
  middleware/
    auth.js             — lifted from donor (magic links)
    csrf.js             — lifted from donor
    rate-limit.js       — lifted from donor
    logging.js          — lifted from donor
  db/
    connection.js       — lifted from donor (pg pool + pgvector)
    migrate.js          — lifted from donor (migration runner)
    migrations/
      001_core_schema.sql  — new HTA schema (see below)
  services/
    snapshot-store.js   — lifted from donor (content acquisition + dedup)
donor-notes/
  llm-gateway.md
  middleware.md
  db-connection.md
  snapshot-store.md
```

**Schema: `001_core_schema.sql`**
```sql
-- Sponsors (pharma companies)
CREATE TABLE sponsors (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  headquarters  JSONB,           -- {country, city, region}
  type          TEXT,             -- originator | generic | biotech | cro
  website       TEXT,
  financials    JSONB,           -- {revenue, rd_spend, employees, market_cap}
  therapeutic_areas TEXT[],
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Assets (drugs/biologics in development)
CREATE TABLE assets (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,    -- INN or common name
  sponsor_id    INT REFERENCES sponsors(id),
  modality      TEXT,             -- small molecule | biologic | cell therapy | gene therapy | vaccine
  indications   TEXT[],
  phase         TEXT,             -- preclinical | phase1 | phase2 | phase3 | approved | withdrawn
  status        TEXT DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Clinical trials (linked to assets)
CREATE TABLE trials (
  id            SERIAL PRIMARY KEY,
  nct_id        TEXT UNIQUE,     -- ClinicalTrials.gov NCT number
  euct_id       TEXT,            -- EU CTIS number
  asset_id      INT REFERENCES assets(id),
  title         TEXT NOT NULL,
  phase         TEXT,
  status        TEXT,            -- recruiting | active_not_recruiting | completed | terminated | etc.
  sponsor_name  TEXT,
  sponsor_class TEXT,            -- INDUSTRY | NIH | OTHER
  conditions    TEXT[],
  interventions JSONB,           -- [{name, type, arm_label}]
  enrollment    INT,
  start_date    DATE,
  primary_completion_date DATE,
  completion_date DATE,
  countries     TEXT[],
  results_available BOOLEAN DEFAULT false,
  source_url    TEXT,
  fetched_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- HTA bodies
CREATE TABLE hta_bodies (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  abbreviation  TEXT,
  country_iso   TEXT NOT NULL,
  role          TEXT,            -- assessment | decision | pricing | formulary
  website       TEXT,
  decision_db_url TEXT,          -- URL to public decisions database
  has_api       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Country access systems
CREATE TABLE country_access_systems (
  id            SERIAL PRIMARY KEY,
  country_iso   TEXT UNIQUE NOT NULL,
  country_name  TEXT NOT NULL,
  income_group  TEXT,            -- HIC | UMIC | LMIC | LIC
  has_formal_hta BOOLEAN DEFAULT false,
  system_type   TEXT,            -- single_payer | multi_payer | national_health_service | mixed
  coverage_model JSONB,          -- {type, description, universal, key_gap}
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Market access pathways (per country, ordered steps)
CREATE TABLE market_access_pathways (
  id            SERIAL PRIMARY KEY,
  country_iso   TEXT NOT NULL REFERENCES country_access_systems(country_iso),
  step_order    INT NOT NULL,
  label         TEXT NOT NULL,
  institution   TEXT,            -- which body handles this step
  is_gate       BOOLEAN DEFAULT false,  -- is this a go/no-go decision point?
  typical_months TEXT,           -- range e.g. "3-6"
  likely_blocker TEXT,
  notes         TEXT,
  UNIQUE(country_iso, step_order)
);

-- HTA decisions (linking assets to HTA body outcomes)
CREATE TABLE hta_decisions (
  id            SERIAL PRIMARY KEY,
  asset_id      INT REFERENCES assets(id),
  hta_body_id   INT REFERENCES hta_bodies(id),
  decision_date DATE,
  decision_type TEXT,            -- recommended | not_recommended | restricted | optimised
  summary       TEXT,
  source_url    TEXT,
  source_pdf_url TEXT,
  fetched_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Source documents (for citation grounding)
CREATE TABLE source_documents (
  id            SERIAL PRIMARY KEY,
  url           TEXT NOT NULL,
  title         TEXT,
  doc_type      TEXT,            -- trial_record | hta_report | guideline | eml | pathway_source
  content_hash  TEXT,            -- for dedup via snapshot store
  fetched_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Chat sessions
CREATE TABLE chat_sessions (
  id            SERIAL PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  context       JSONB,           -- {asset_id, country_iso, mode}
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Chat messages
CREATE TABLE chat_messages (
  id            SERIAL PRIMARY KEY,
  session_id    INT REFERENCES chat_sessions(id),
  role          TEXT NOT NULL,    -- user | assistant
  content       TEXT NOT NULL,
  citations     JSONB,           -- [{source_document_id, excerpt, url}]
  metadata      JSONB,           -- {confidence, lanes_used, model_used}
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Enable pgvector for semantic search (later)
-- CREATE EXTENSION IF NOT EXISTS vector;
```

**Donor notes:** Each lifted file gets a short markdown file in `donor-notes/` explaining: what was lifted, what was changed, why.

**Exit:** `npm run dev` starts Express, migration runner creates tables, health endpoint responds.

---

### Batch 2: Seed data — sponsors + HTA bodies + country pathways

**Scope:** Load the 220 company profiles as sponsors. Curate initial HTA body and country pathway seed data for 3 launch countries.

**New files:**
```
api/db/
  seed-json/
    sponsors.json        — transformed from AccessMap company profiles
    hta-bodies.json      — curated for UK, Germany, France (initially)
    country-systems.json — 3 countries with pathway steps
  seed-loader.js         — reads seed JSON, upserts into DB
```

**Work:**
- Write a transform script that reads `accessmap-extracted/src/data/companies/*/profile.js` and produces `sponsors.json` with the fields matching the `sponsors` table
- Hand-curate HTA bodies for UK (NICE), Germany (G-BA + IQWiG), France (HAS)
- Hand-curate market access pathways for those 3 countries (7-10 steps each)
- Seed loader idempotent (upsert on slug/iso)

**Exit:** `node api/db/seed-loader.js` populates sponsors, hta_bodies, country_access_systems, market_access_pathways. Queryable via psql.

---

### Batch 3: ClinicalTrials.gov ingestion

**Scope:** First external data connector. Fetch oncology Phase 2/3 trials and link to sponsors.

**New files:**
```
api/services/
  ctgov-client.js       — ClinicalTrials.gov API v2 client
  ctgov-ingest.js       — fetch, transform, upsert trials
api/routes/
  ingest.js             — POST /api/ingest/ctgov (admin-only trigger)
```

**Work:**
- `ctgov-client.js`: wraps the REST API, handles pagination, rate limiting, field selection
- `ctgov-ingest.js`: fetches trials by therapeutic area, transforms to `trials` table schema, links to sponsors by matching sponsor name, upserts
- Initial fetch: oncology Phase 2+3 from last 2 years (~500-1000 trials)
- Store `source_url` for each trial (citation grounding)

**Exit:** Running ingest populates `trials` table. At least one trial links to a sponsor in the DB.

---

### Batch 4: API routes — search + detail endpoints

**Scope:** REST API for frontend to query sponsors, assets, trials, country pathways.

**New files:**
```
api/routes/
  sponsors.js           — GET /api/sponsors, GET /api/sponsors/:slug
  assets.js             — GET /api/assets, GET /api/assets/:slug
  trials.js             — GET /api/trials?asset_id=&sponsor_id=&phase=&condition=
  countries.js          — GET /api/countries, GET /api/countries/:iso
  search.js             — GET /api/search?q= (cross-entity)
```

**Work:**
- Each route returns JSON with pagination
- Search endpoint queries across sponsors, assets, trials (simple ILIKE for now, pgvector later)
- Country detail includes HTA bodies + pathway steps joined

**Exit:** All endpoints return data. `GET /api/search?q=pfizer` returns sponsor + linked trials.

---

### Batch 5: Thin retrieval service + chat route

**Scope:** Lift and adapt the brain architecture for HTA domain.

**New files:**
```
api/services/
  retrieval.js          — multi-lane retrieval (trial, sponsor, country pathway lanes)
  response-contract.js  — answer shape: {answer, citations, confidence, follow_ups}
  intent-classifier.js  — classify user query: sponsor_lookup | trial_search | pathway_question | comparison
  prompt-templates.js   — HTA-specific system prompts
api/routes/
  brain.js              — POST /api/brain/chat (session-aware)
```

**Work:**
- Retrieval service: 3 initial lanes (trial_lane, sponsor_lane, country_pathway_lane)
- Each lane queries the DB, formats context snippets with source URLs
- Intent classifier: regex-based (from donor pattern), new intents for HTA
- Prompt templates: system prompt positions the AI as HTA market access analyst
- Brain route: create/load session, classify intent, activate lanes, call LLM gateway, persist message with citations

**Exit:** `POST /api/brain/chat {message: "What's the HTA pathway for pembrolizumab in Germany?"}` returns a grounded answer with citations to trial records and country pathway data.

---

### Batch 6: Frontend scaffold + search page

**Scope:** Adapt the existing vibe-collab React scaffold for the HTA product. Build search.

**Changed files:**
```
src/
  App.jsx               — updated with HTA routes
  pages/
    SearchPage.jsx       — search bar + results (sponsors, assets, trials)
    AssetPage.jsx        — asset detail with linked trials
    CountryPage.jsx      — country pathway visualization
  components/
    SearchBar.jsx        — debounced search input
    SponsorCard.jsx      — sponsor summary card
    TrialCard.jsx        — trial summary card
    PathwayTimeline.jsx  — vertical step timeline for market access pathway
  lib/
    api-client.js        — fetch wrapper for backend API
  hooks/
    useSearch.js         — debounced search hook
```

**Work:**
- SearchPage: single search bar, results grouped by type (sponsors, assets, trials)
- AssetPage: asset name, sponsor, phase, linked trials table, country pathway links
- CountryPage: country name + HTA bodies + vertical timeline of pathway steps
- Use Tailwind for styling (existing vibe-collab convention)
- Responsive, clean, minimal

**Exit:** User can search for "Pfizer", see sponsor card, click through to assets/trials, navigate to country pathway view.

---

### Batch 7: Chat panel

**Scope:** Minimal chat UI wired to the brain endpoint.

**New files:**
```
src/
  components/
    ChatPanel.jsx        — collapsible side panel with message bubbles
    CitationBadge.jsx    — inline citation link
  hooks/
    useChat.js           — adapted from donor usePolicyPilotChat pattern
```

**Work:**
- ChatPanel: fixed right panel, message list, input box, send button
- Messages show AI responses with inline citation badges
- CitationBadge links to source (trial URL, HTA body page, pathway source)
- Context-aware: if user is on an asset page, chat pre-fills context
- Simple, not the full PolicyPilot overlay — that's a later lift

**Exit:** User asks "What phase is pembrolizumab in?" on an asset page, gets a cited answer.

---

### Batch 8: Sprint 1 quality gate

**Scope:** Read-only verification batch. No code changes.

**Checklist:**
- [ ] End-to-end flow works: search → asset → trials → country pathway → chat with citations
- [ ] At least 1 asset linked to sponsor + live CT.gov trials
- [ ] At least 3 countries with structured pathways rendering correctly
- [ ] Chat returns cited answers from DB sources only (no hallucinated URLs)
- [ ] No EHDS terminology in any user-facing text
- [ ] All vibe-collab tests still pass
- [ ] Donor notes exist for every lifted file
- [ ] Kasper's data/raw/ deliverables don't conflict with app structure

---

## Parallel tracks

| Track | Owner | Batches | Notes |
|-------|-------|---------|-------|
| Backend scaffold + donor extraction | James (with AI) | 1-5 | Core architecture work |
| Frontend + chat | James (with AI) | 6-7 | After API exists |
| Data curation | Kasper | Independent | See KASPER-DATA-TASKS.md |
| Quality gate | Both | 8 | Review together |

## Timeline estimate

| Batch | Est. time | Cumulative |
|-------|-----------|-----------|
| 1: Backend scaffold | 1 session | 1 session |
| 2: Seed data | 1 session | 2 sessions |
| 3: CT.gov ingestion | 1 session | 3 sessions |
| 4: API routes | 0.5 session | 3.5 sessions |
| 5: Retrieval + chat backend | 1 session | 4.5 sessions |
| 6: Frontend scaffold + search | 1 session | 5.5 sessions |
| 7: Chat panel | 0.5 session | 6 sessions |
| 8: Quality gate | 0.5 session | 6.5 sessions |

~6-7 sessions to Sprint 1 complete.

## What Sprint 2 looks like (preview)

- NICE API integration (first real HTA decision data)
- Additional country pathways (Kasper's 20-country curation)
- Asset-to-trial auto-linking improvements
- Richer chat with compare mode ("compare Germany vs UK pathway for X")
- 5A friction scoring as a lens on country pathways
- WHO EML integration (if Kasper delivers Task 5)
