-- ═══════════════════════════════════════════════════════════════════════════
-- 002_pathway_source.sql — Add source_url to market access pathway steps
--
-- Each pathway step now carries a source URL pointing to the official HTA
-- body methodology or process page that describes this step.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE market_access_pathways ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Also add source_url + source_label to country_access_systems for
-- country-level source provenance
ALTER TABLE country_access_systems ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE country_access_systems ADD COLUMN IF NOT EXISTS source_label TEXT;

-- Add unique index on source_documents.url so upsert ON CONFLICT works
CREATE UNIQUE INDEX IF NOT EXISTS source_documents_url_idx ON source_documents (url);
