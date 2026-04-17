// ═══════════════════════════════════════════════════════════════════════════
// ClinicalTrials.gov Ingestion Service
//
// Fetches trials from CT.gov API v2, transforms them to the `trials` table
// schema, attempts to link each trial to a sponsor in the DB, and upserts.
//
// Default scope: oncology Phase 2/3, industry-sponsored, last 2 years.
// ═══════════════════════════════════════════════════════════════════════════

import { fetchAll } from "./ctgov-client.js";
import { getPool } from "../db/connection.js";

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Normalise a ClinicalTrials.gov phase string to our schema enum.
 * CT.gov uses "PHASE2", "PHASE3", "PHASE2|PHASE3", "NA", etc.
 */
function normalisePhase(raw) {
  if (!raw) return null;
  const phases = raw.split("|").map((p) => p.trim().toUpperCase());

  // If multiple phases, take the highest
  if (phases.includes("PHASE3")) return "phase3";
  if (phases.includes("PHASE2")) return "phase2";
  if (phases.includes("PHASE1")) return "phase1";
  if (phases.includes("EARLY_PHASE1")) return "phase1";
  return raw.toLowerCase().replace(/\s+/g, "_");
}

/**
 * Normalise CT.gov status to our lowercase underscore form.
 * CT.gov uses "RECRUITING", "ACTIVE_NOT_RECRUITING", "COMPLETED", etc.
 */
function normaliseStatus(raw) {
  if (!raw) return null;
  return raw.toLowerCase().replace(/,\s*/g, "_").replace(/\s+/g, "_");
}

/**
 * Parse a CT.gov date object to a JS Date string (YYYY-MM-DD) or null.
 * CT.gov returns dates as { date: "2024-03-15" } or { date: "2024-03" }.
 */
function parseDate(dateObj) {
  if (!dateObj) return null;
  const raw = typeof dateObj === "string" ? dateObj : dateObj.date || dateObj;
  if (!raw || typeof raw !== "string") return null;

  // Handle "YYYY-MM" by appending "-01"
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return null;
}

/**
 * Extract nested fields from the CT.gov v2 response structure.
 * The v2 API nests data under protocolSection.* sub-objects.
 */
function extractStudy(study) {
  const proto = study.protocolSection || {};
  const id = proto.identificationModule || {};
  const status = proto.statusModule || {};
  const design = proto.designModule || {};
  const sponsor = proto.sponsorCollaboratorsModule || {};
  const conditions = proto.conditionsModule || {};
  const interventions = proto.armsInterventionsModule || {};
  const contacts = proto.contactsLocationsModule || {};
  const results = study.resultsSection || null;

  const leadSponsor = sponsor.leadSponsor || {};

  // Extract intervention details
  const interventionList = (interventions.interventions || []).map((iv) => ({
    name: iv.name || null,
    type: iv.type || null,
    description: iv.description || null,
  }));

  // Extract unique countries from locations
  const locations = contacts.locations || [];
  const countries = [...new Set(locations.map((l) => l.country).filter(Boolean))];

  return {
    nct_id: id.nctId || null,
    title: id.officialTitle || id.briefTitle || "Untitled",
    phase: normalisePhase(
      design.phases ? design.phases.join("|") : null
    ),
    status: normaliseStatus(status.overallStatus),
    sponsor_name: leadSponsor.name || null,
    sponsor_class: leadSponsor.class || null,
    conditions: (conditions.conditions || []),
    interventions: interventionList.length ? interventionList : null,
    enrollment: design.enrollmentInfo?.count || null,
    start_date: parseDate(status.startDateStruct),
    primary_completion_date: parseDate(status.primaryCompletionDateStruct),
    completion_date: parseDate(status.completionDateStruct),
    countries,
    results_available: !!results,
    source_url: id.nctId
      ? `https://clinicaltrials.gov/study/${id.nctId}`
      : null,
  };
}

// ── Sponsor matching ─────────────────────────────────────────────────────

/**
 * Build a lookup map of sponsor names → sponsor IDs.
 * Uses lowercase normalisation for fuzzy matching.
 */
async function buildSponsorMap(client) {
  const result = await client.query("SELECT id, slug, name FROM sponsors");
  const map = new Map();

  for (const row of result.rows) {
    // Index by multiple keys for better matching
    map.set(row.name.toLowerCase(), row.id);
    map.set(row.slug.toLowerCase(), row.id);

    // Also index common short forms (e.g. "Pfizer Inc" → "pfizer")
    const simplified = row.name
      .toLowerCase()
      .replace(/\b(inc\.?|ltd\.?|plc\.?|corp\.?|co\.?|sa|ag|se|gmbh|llc|nv|bv)\b/gi, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (simplified && simplified !== row.name.toLowerCase()) {
      map.set(simplified, row.id);
    }
  }

  return map;
}

/**
 * Try to match a CT.gov sponsor name to a sponsor ID in the DB.
 */
function matchSponsor(sponsorName, sponsorMap) {
  if (!sponsorName) return null;

  const lower = sponsorName.toLowerCase();

  // Exact match
  if (sponsorMap.has(lower)) return sponsorMap.get(lower);

  // Simplified match
  const simplified = lower
    .replace(/\b(inc\.?|ltd\.?|plc\.?|corp\.?|co\.?|sa|ag|se|gmbh|llc|nv|bv)\b/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (sponsorMap.has(simplified)) return sponsorMap.get(simplified);

  // Substring match — check if any sponsor name is contained in the CT.gov name
  for (const [key, id] of sponsorMap) {
    if (key.length > 3 && lower.includes(key)) return id;
  }

  return null;
}

// ── Asset matching ──────────────────────────────────────────────────────

/**
 * Build a lookup map of asset names/aliases → asset IDs.
 * Matches intervention names from CT.gov to known assets.
 */
async function buildAssetMap(client) {
  const result = await client.query("SELECT id, slug, name FROM assets");
  const map = new Map();

  for (const row of result.rows) {
    map.set(row.name.toLowerCase(), row.id);
    map.set(row.slug.toLowerCase(), row.id);
  }

  // Also load aliases from the seed JSON (stored as a field in seed but not in DB)
  // We build the alias map at ingest time from the seed file
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = path.default.dirname(fileURLToPath(import.meta.url));
    const seedPath = path.default.join(dir, "../db/seed-json/assets.json");
    const raw = await fs.default.readFile(seedPath, "utf-8");
    const assets = JSON.parse(raw);
    for (const a of assets) {
      const dbRow = result.rows.find((r) => r.slug === a.slug);
      if (!dbRow) continue;
      for (const alias of a.aliases || []) {
        map.set(alias.toLowerCase(), dbRow.id);
      }
    }
  } catch {
    // Seed file not available — aliases won't be matched, names/slugs still work
  }

  return map;
}

/**
 * Try to match a trial's interventions to an asset ID.
 * Checks intervention names against asset names and aliases.
 */
function matchAsset(trial, assetMap) {
  if (!trial.interventions) return null;

  for (const iv of trial.interventions) {
    if (!iv.name) continue;
    const lower = iv.name.toLowerCase();

    // Exact match
    if (assetMap.has(lower)) return assetMap.get(lower);

    // Check if any asset name/alias is contained in the intervention name
    for (const [key, id] of assetMap) {
      if (key.length > 3 && lower.includes(key)) return id;
    }
  }

  return null;
}

// ── Upsert ───────────────────────────────────────────────────────────────

/**
 * Upsert a single trial row. Uses ON CONFLICT (nct_id) DO UPDATE.
 */
async function upsertTrial(client, trial, assetId = null) {
  const result = await client.query(
    `INSERT INTO trials (
       nct_id, asset_id, title, phase, status, sponsor_name, sponsor_class,
       conditions, interventions, enrollment,
       start_date, primary_completion_date, completion_date,
       countries, results_available, source_url, fetched_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now())
     ON CONFLICT (nct_id) DO UPDATE SET
       asset_id = COALESCE(EXCLUDED.asset_id, trials.asset_id),
       title = EXCLUDED.title,
       phase = EXCLUDED.phase,
       status = EXCLUDED.status,
       sponsor_name = EXCLUDED.sponsor_name,
       sponsor_class = EXCLUDED.sponsor_class,
       conditions = EXCLUDED.conditions,
       interventions = EXCLUDED.interventions,
       enrollment = EXCLUDED.enrollment,
       start_date = EXCLUDED.start_date,
       primary_completion_date = EXCLUDED.primary_completion_date,
       completion_date = EXCLUDED.completion_date,
       countries = EXCLUDED.countries,
       results_available = EXCLUDED.results_available,
       source_url = EXCLUDED.source_url,
       fetched_at = now(),
       updated_at = now()
     RETURNING (xmax = 0) AS is_insert`,
    [
      trial.nct_id,
      assetId,
      trial.title,
      trial.phase,
      trial.status,
      trial.sponsor_name,
      trial.sponsor_class,
      trial.conditions,
      trial.interventions ? JSON.stringify(trial.interventions) : null,
      trial.enrollment,
      trial.start_date,
      trial.primary_completion_date,
      trial.completion_date,
      trial.countries,
      trial.results_available,
      trial.source_url,
    ]
  );

  return result.rows[0]?.is_insert ? "created" : "updated";
}

// ── Main ingestion ───────────────────────────────────────────────────────

/**
 * Run a CT.gov ingestion for the given parameters.
 *
 * @param {object} opts
 * @param {string} [opts.condition="cancer"] - Condition filter
 * @param {string} [opts.phase="PHASE2|PHASE3"] - Phase filter
 * @param {string} [opts.sponsorType="INDUSTRY"] - Sponsor class filter
 * @param {number} [opts.lookbackYears=2] - How far back to search
 * @param {number} [opts.maxPages=20] - Max pages to fetch
 * @returns {Promise<{created: number, updated: number, skipped: number, matched: number, total: number}>}
 */
export async function ingestTrials(opts = {}) {
  const pool = await getPool();
  if (!pool) throw new Error("Database not configured");

  const client = await pool.connect();

  try {
    const condition = opts.condition || "cancer";
    const phase = opts.phase || "PHASE2|PHASE3";
    const sponsorType = opts.sponsorType || "INDUSTRY";
    const lookbackYears = opts.lookbackYears || 2;
    const maxPages = opts.maxPages || 20;

    // Build date range: from (today - lookbackYears) to today
    const now = new Date();
    const from = new Date(now);
    from.setFullYear(from.getFullYear() - lookbackYears);
    const dateRange = [
      `${String(from.getMonth() + 1).padStart(2, "0")}/${String(from.getDate()).padStart(2, "0")}/${from.getFullYear()}`,
      `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`,
    ].join(",");

    console.log(`[ctgov-ingest] Fetching ${condition} ${phase} trials (industry, last ${lookbackYears}y)...`);

    // Build sponsor + asset lookups
    const sponsorMap = await buildSponsorMap(client);
    console.log(`[ctgov-ingest] Loaded ${sponsorMap.size} sponsor name variants for matching`);

    const assetMap = await buildAssetMap(client);
    console.log(`[ctgov-ingest] Loaded ${assetMap.size} asset name/alias variants for matching`);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let matched = 0;
    let assetLinked = 0;

    await client.query("BEGIN");

    for await (const page of fetchAll({ condition, phase, sponsorType, dateRange, pageSize: 100 }, maxPages)) {
      console.log(`[ctgov-ingest] Page ${page.page} — ${page.studies.length} studies (${page.totalCount} total)`);

      for (const study of page.studies) {
        const trial = extractStudy(study);

        if (!trial.nct_id) {
          skipped++;
          continue;
        }

        // Try to link to a sponsor
        const sponsorId = matchSponsor(trial.sponsor_name, sponsorMap);
        if (sponsorId) matched++;

        // Try to link to an asset via intervention names
        const assetId = matchAsset(trial, assetMap);
        if (assetId) assetLinked++;

        const action = await upsertTrial(client, trial, assetId);
        if (action === "created") created++;
        else updated++;
      }
    }

    await client.query("COMMIT");

    const summary = { created, updated, skipped, matched, assetLinked, total: created + updated };
    console.log(`[ctgov-ingest] Done. ${summary.total} trials (${created} new, ${updated} updated, ${skipped} skipped, ${matched} sponsor-matched, ${assetLinked} asset-linked)`);

    return summary;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
