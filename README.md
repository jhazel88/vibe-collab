# HTA Market Access Tracker

R&D pipeline tracker with HTA market access pathways and AI-assisted analysis. Search pharmaceutical sponsors, browse clinical trials from ClinicalTrials.gov, explore country-level market access pathways, and ask grounded questions with cited answers.

## What's in the box

**Backend** (Express 4, PostgreSQL)

- REST API with paginated, filterable endpoints for sponsors, assets, trials, countries, and cross-entity search
- ClinicalTrials.gov v2 ingestion pipeline — fetches live trial data, matches to sponsor records, upserts idempotently
- AI chat pipeline: intent classification → multi-lane retrieval (sponsors, trials, country pathways) → LLM augmentation → cited response with confidence scoring
- Session-based multi-turn chat with history
- LLM gateway supporting Anthropic Claude and OpenAI with task-to-model-tier routing and automatic fallback

**Frontend** (React 19, Vite 8, Tailwind CSS v4)

- Unified search across sponsors, assets, trials, and countries
- Sponsor detail pages with financials, therapeutic areas, and linked trials
- Country pages with HTA body grid and interactive pathway timeline (gate steps highlighted, blockers flagged)
- Collapsible chat panel with context-aware prompting, citation badges, confidence indicators, and follow-up suggestions

**Seed data**

- 220 pharmaceutical company profiles
- 7 HTA bodies (NICE, SMC, G-BA, IQWiG, HAS, CEESP, CT)
- 3 country access systems (UK, Germany, France) with structured multi-step market access pathways

## Prerequisites

- **Node.js** 18+ (tested on 22)
- **PostgreSQL** 14+ with a database created for the project
- At least one LLM API key (Anthropic or OpenAI) for chat functionality

## Quick start

### 1. Install dependencies

```bash
git clone https://github.com/jhazel88/vibe-collab.git
cd vibe-collab
npm install
```

### 2. Set up environment variables

Create a `.env` file in the project root (or export these in your shell):

```bash
# Required — PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/hta_tracker

# At least one LLM key for chat (both optional — gateway auto-selects whichever is available)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Optional
API_PORT=3011              # default: 3011
NODE_ENV=development       # default: development (enables dev auth bypass)
JWT_SECRET=your-secret     # auto-generated in dev mode
```

### 3. Create the database and run migrations

```bash
createdb hta_tracker       # or use your preferred method
npm run migrate            # runs api/db/migrations/001_core_schema.sql
```

To preview what the migration will do without executing:

```bash
npm run migrate:dry
```

### 4. Seed the database

```bash
npm run seed
```

This loads sponsors, HTA bodies, country access systems, and pathway steps from `api/db/seed-json/`. All upserts are idempotent — safe to re-run.

### 5. Start both servers

In two terminals:

```bash
# Terminal 1 — API server (port 3011)
npm run dev:api

# Terminal 2 — Vite dev server (port 5173, proxies /api to 3011)
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

### 6. (Optional) Ingest live clinical trials

Once the API is running, pull oncology trials from ClinicalTrials.gov:

```bash
curl -X POST http://localhost:3011/api/ingest/ctgov \
  -H "Content-Type: application/json" \
  -d '{"condition": "cancer", "phase": "PHASE2|PHASE3", "maxPages": 5}'
```

This fetches trials from the ClinicalTrials.gov v2 API, matches sponsors, and upserts into the `trials` table. Rate-limited to ~10 req/sec.

## Project structure

```
vibe-collab/
├── api/
│   ├── index.js                 # Express entry point
│   ├── db/
│   │   ├── connection.js        # PostgreSQL pool
│   │   ├── migrate.js           # Migration runner
│   │   ├── seed-loader.js       # Idempotent JSON seed loader
│   │   ├── migrations/          # SQL migration files
│   │   └── seed-json/           # Seed data (sponsors, HTA bodies, countries)
│   ├── lib/
│   │   └── llm-gateway.js       # Vendor-neutral LLM interface
│   ├── middleware/
│   │   ├── auth.js              # JWT auth + dev bypass
│   │   ├── csrf.js              # CSRF protection
│   │   ├── logging.js           # Request logging
│   │   └── rate-limit.js        # Rate limiting
│   ├── routes/
│   │   ├── sponsors.js          # GET /api/sponsors, /api/sponsors/:slug
│   │   ├── assets.js            # GET /api/assets, /api/assets/:slug
│   │   ├── trials.js            # GET /api/trials, /api/trials/:nctId
│   │   ├── countries.js         # GET /api/countries, /api/countries/:iso
│   │   ├── search.js            # GET /api/search?q=
│   │   ├── brain.js             # POST /api/brain/chat
│   │   └── ingest.js            # POST /api/ingest/ctgov (admin)
│   └── services/
│       ├── ctgov-client.js      # ClinicalTrials.gov API v2 client
│       ├── ctgov-ingest.js      # Trial ingestion + sponsor matching
│       ├── intent-classifier.js # Query intent classification
│       ├── retrieval.js         # Multi-lane context retrieval
│       ├── prompt-templates.js  # LLM system/user prompt construction
│       ├── response-contract.js # Canonical response shape
│       └── snapshot-store.js    # Content acquisition + dedup
├── src/
│   ├── App.jsx                  # State-based routing + ChatPanel
│   ├── lib/
│   │   └── api-client.js        # Frontend fetch wrapper
│   ├── hooks/
│   │   ├── useSearch.js         # Debounced search hook
│   │   └── useChat.js           # Chat state management
│   ├── components/
│   │   ├── SearchBar.jsx        # Search input with loading state
│   │   ├── SponsorCard.jsx      # Sponsor summary card
│   │   ├── TrialCard.jsx        # Trial record card
│   │   ├── PathwayTimeline.jsx  # Vertical HTA pathway timeline
│   │   ├── ChatPanel.jsx        # Collapsible chat panel
│   │   └── CitationBadge.jsx    # Inline citation link
│   └── pages/
│       ├── SearchPage.jsx       # Unified search with grouped results
│       ├── SponsorPage.jsx      # Sponsor detail view
│       └── CountryPage.jsx      # Country + HTA pathway view
├── donor-notes/                 # Provenance notes for code lifted from donor repos
├── data/raw/                    # Raw research data (independent track)
└── .codex/                      # Execution plans and sprint documentation
```

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run dev:api` | Start Express API server (port 3011) |
| `npm run build` | Production build |
| `npm test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run migrate` | Run database migrations |
| `npm run migrate:dry` | Preview migrations without executing |
| `npm run seed` | Load seed data into database |

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (DB + LLM status) |
| GET | `/api/sponsors` | List sponsors (paginated, filterable) |
| GET | `/api/sponsors/:slug` | Sponsor detail with counts |
| GET | `/api/assets` | List assets (filterable by phase, sponsor, modality) |
| GET | `/api/assets/:slug` | Asset detail with sponsor + trials |
| GET | `/api/trials` | List trials (filterable by phase, status, country) |
| GET | `/api/trials/:nctId` | Trial detail |
| GET | `/api/countries` | List countries with HTA body counts |
| GET | `/api/countries/:iso` | Country detail with HTA bodies + pathway |
| GET | `/api/search?q=` | Cross-entity search |
| POST | `/api/brain/chat` | AI chat with cited responses |
| POST | `/api/ingest/ctgov` | Ingest trials from ClinicalTrials.gov (admin) |

## Chat response contract

Every chat response follows this shape:

```json
{
  "answer": "The UK market access pathway begins with...",
  "citations": [
    {
      "source_url": "https://clinicaltrials.gov/study/NCT12345678",
      "source_label": "NCT12345678",
      "excerpt": "relevant passage from source"
    }
  ],
  "confidence": "high",
  "follow_ups": [
    "What are the typical timelines for NICE appraisal?",
    "How does Germany's pathway compare?"
  ],
  "metadata": {
    "intent": "pathway_question",
    "lanes_used": ["country_pathway"],
    "model_used": "claude-sonnet-4-20250514"
  }
}
```

## Tech stack

- **Frontend:** React 19, Vite 8, Tailwind CSS v4
- **Backend:** Express 4, PostgreSQL, pg driver
- **LLM:** Anthropic Claude / OpenAI (vendor-neutral gateway)
- **Data:** ClinicalTrials.gov API v2, curated HTA seed data
- **Testing:** Vitest, Testing Library

## Docs

- **[Getting Started](docs/GETTING-STARTED.md)** — extended setup and workflow guide
- **[Vibe Coding Guide](docs/vibe-coding-guide.md)** — patterns and tips from a real build
- **[Sprint 1 Plan](.codex/plans/SPRINT-1-EXECUTION-PLAN.md)** — batch-by-batch execution plan
