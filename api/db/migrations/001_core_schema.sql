-- ═══════════════════════════════════════════════════════════════════════════
-- 001_core_schema.sql — HTA Market Access core tables
-- ═══════════════════════════════════════════════════════════════════════════

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
