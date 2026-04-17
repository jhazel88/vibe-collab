# HTA Reuse Backbone Plan

Date: 2026-04-17
Status: working decision memo
Purpose: turn the codebase audit into a clean build strategy for a new HTA / market-access product using donor extraction from the EU Digital Strategy Tracker and AccessMap codebases.

## Bottom line

The EU Digital Strategy Tracker and AccessMap codebases contain ~16,500 lines of directly reusable code (backend logic + UI components). The right approach is donor extraction, not a product fork. Lift the generic backbone, adapt the domain models for HTA, defer EHDS-specific product surfaces.

## What we're building

**R&D Pipeline Tracker + HTA Market Access Roadmap + Treatment Landscape Intelligence**

Three interconnected modules:
1. **R&D Pipeline Tracker**: Clinical trial data from ClinicalTrials.gov, CTIS, WHO ICTRP
2. **HTA & Market Access Roadmap**: Per-country HTA body + reimbursement pathway for 50+ countries
3. **Treatment Landscape Intelligence**: WHO EML, national formularies, clinical practice guidelines

Primary audience: HTA bodies and pharmaceutical market access teams.
Separate product, integrates with the broader AccessMap ecosystem.

## Donor repos

- **EU Digital Strategy Tracker** (`EHDSTracker_ChatGPT_Codex/`): LLM gateway, brain/chat architecture, retrieval engine, evidence system, middleware, DB scaffolding, UI components
- **AccessMap** (`EHDSTracker_ChatGPT_Codex/accessmap-extracted/`): Therapy-pack scoring model, 220 company profiles, 162-country medicines policy data, 5A access dimension framework

## Lift now (Sprint 1)

### 1. Runtime substrate
- `api/lib/llm-gateway.js` — vendor-neutral LLM abstraction
- `api/middleware/auth.js`, `csrf.js`, `rate-limit.js` — production middleware
- `api/services/rss-ingest.js` — feed ingestion pipeline
- `api/services/snapshot-store.js` — content acquisition + dedup
- DB connection + migration runner + pgvector scaffolding

### 2. Chat architecture (pattern, not copy)
- `api/routes/brain.js` — session + retrieval + LLM pipeline
- `api/services/retrieval.js` — multi-lane retrieval engine
- `src/hooks/usePolicyPilotChat.js` — React chat hook

Keep: session model, retrieval orchestration, response contract, citations, fallbacks.
Change: prompts, intents, retrieval lanes, route naming, answer modes.

### 3. Access-pack data contract
- Fork `therapy-pack-contract.js` → market-access pack contract
- `systems.json` → country access system / HTA bodies
- `pathways.json` → market-access roadmap
- `frictions.json` → access barriers / risk signals

### 4. Sponsor intelligence corpus
- `accessmap-extracted/src/data/companies/` (220 profiles)
- Enrich with: NCT IDs, development phase, trial status, sponsor-to-asset linking

## Adapt next (Sprint 2+)

- Retrieval lanes → trial, HTA decision, country pathway, sponsor, guideline, news
- 5A friction scoring → HTA-specific language
- Rule engine → country requirement comparison, evidence readiness checks

## Defer on purpose

- Full PolicyPilot UI overlay (too EHDS-shaped for Sprint 1)
- Full AccessMap product surface (explorer pages, landing, methodology)
- Medicines-policy explorer (strategic moat, not Sprint 1 dependency)
- Broad monitoring orchestration (beyond what first source universe needs)

## HTA core schema

Start with 12 entities:
- `sponsor`, `asset`, `indication`, `trial`, `trial_readout`
- `hta_body`, `country_access_system`, `market_access_pathway`
- `hta_decision`, `guideline_event`
- `source_document`, `citation`, `change_event`

## Sprint 1 goal

Prove one end-to-end path:
**search sponsor or asset → see linked trial + country roadmap → ask grounded question → get cited answer**

## Sprint 1 exit criteria

- At least one asset links to a sponsor and live CT.gov trial records
- At least three countries render structured market-access pathways
- Chat answers a basic question with visible citations from those sources only
- No EHDS terminology in user-facing surface

## Extraction order

1. LLM gateway
2. Middleware + DB scaffolding
3. Snapshot + ingest utilities
4. Therapy-pack contract → market-access pack contract
5. Company profile loader
6. Thin retrieval service
7. Thin chat route
8. Thin UI

## Anti-goals

- Full EHDS tracker fork
- Full AccessMap UI fork
- Broad rename sweeps before new schema exists
- Importing half-built features just because they're present
- Making rule-engine sophistication a prerequisite for v0
