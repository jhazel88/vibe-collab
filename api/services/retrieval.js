// ═══════════════════════════════════════════════════════════════════════════
// Multi-Lane Retrieval Service
//
// Queries the DB for context relevant to the user's question.
// Each lane produces context snippets with source URLs for citation.
//
// Lanes:
//   sponsor_lane         — company profiles, financials, therapeutic areas
//   trial_lane           — clinical trial records
//   country_pathway_lane — country access systems, HTA bodies, pathway steps
// ═══════════════════════════════════════════════════════════════════════════

import { query } from "../db/connection.js";

const MAX_SNIPPETS_PER_LANE = 10;

// ── Lane: Sponsor ────────────────────────────────────────────────────────

async function sponsorLane(userQuery, entities) {
  const snippets = [];

  // If we have a specific sponsor name or the query mentions pharma
  const searchTerm = `%${userQuery}%`;

  const result = await query(
    `SELECT slug, name, type, headquarters, financials, therapeutic_areas, website
     FROM sponsors
     WHERE name ILIKE $1 OR slug ILIKE $1
        OR EXISTS (SELECT 1 FROM unnest(therapeutic_areas) AS elem WHERE elem ILIKE $1)
     ORDER BY
       CASE WHEN LOWER(name) LIKE LOWER($2) || '%' THEN 0 ELSE 1 END
     LIMIT $3`,
    [searchTerm, userQuery.split(" ")[0], MAX_SNIPPETS_PER_LANE]
  );

  for (const row of result.rows) {
    const hq = row.headquarters
      ? `${row.headquarters.city || ""}, ${row.headquarters.country || ""}`.replace(/^, |, $/g, "")
      : "Unknown";

    const fin = row.financials || {};
    const revenue = fin.revenue ? `Revenue: ${fin.revenue.currency} ${fin.revenue.value} (${fin.revenue.year})` : "";
    const rdSpend = fin.rd_spend ? `R&D: ${fin.rd_spend.currency} ${fin.rd_spend.value} (${fin.rd_spend.year})` : "";

    snippets.push({
      type: "sponsor",
      id: row.slug,
      title: row.name,
      content: [
        `${row.name} — ${row.type || "pharma company"}`,
        `Headquarters: ${hq}`,
        revenue,
        rdSpend,
        row.therapeutic_areas?.length
          ? `Therapeutic areas: ${row.therapeutic_areas.join(", ")}`
          : "",
      ].filter(Boolean).join("\n"),
      source_url: row.website || null,
      source_label: `${row.name} company profile`,
    });
  }

  return snippets;
}

// ── Lane: Trial ──────────────────────────────────────────────────────────

async function trialLane(userQuery, entities) {
  const snippets = [];

  // If specific NCT IDs were mentioned, fetch those directly
  if (entities.nctIds?.length) {
    const nctResult = await query(
      `SELECT nct_id, title, phase, status, sponsor_name, sponsor_class,
              conditions, enrollment, start_date, countries, source_url
       FROM trials
       WHERE nct_id = ANY($1)`,
      [entities.nctIds]
    );

    for (const row of nctResult.rows) {
      snippets.push(formatTrialSnippet(row));
    }
  }

  // Also search by text if we have room
  if (snippets.length < MAX_SNIPPETS_PER_LANE) {
    const remaining = MAX_SNIPPETS_PER_LANE - snippets.length;
    const existingNcts = snippets.map((s) => s.id);

    const searchResult = await query(
      `SELECT nct_id, title, phase, status, sponsor_name, sponsor_class,
              conditions, enrollment, start_date, countries, source_url
       FROM trials
       WHERE (title ILIKE $1 OR sponsor_name ILIKE $1 OR EXISTS (SELECT 1 FROM unnest(conditions) AS elem WHERE elem ILIKE $1))
         ${existingNcts.length ? `AND nct_id != ALL($3)` : ""}
       ORDER BY start_date DESC NULLS LAST
       LIMIT $2`,
      existingNcts.length
        ? [`%${userQuery}%`, remaining, existingNcts]
        : [`%${userQuery}%`, remaining]
    );

    for (const row of searchResult.rows) {
      snippets.push(formatTrialSnippet(row));
    }
  }

  return snippets;
}

function formatTrialSnippet(row) {
  return {
    type: "trial",
    id: row.nct_id,
    title: `${row.nct_id}: ${row.title}`,
    content: [
      `Trial: ${row.title}`,
      `NCT ID: ${row.nct_id}`,
      `Phase: ${row.phase || "N/A"} | Status: ${row.status || "N/A"}`,
      `Sponsor: ${row.sponsor_name || "N/A"} (${row.sponsor_class || "N/A"})`,
      row.conditions?.length ? `Conditions: ${row.conditions.join(", ")}` : "",
      row.enrollment ? `Enrollment: ${row.enrollment}` : "",
      row.start_date ? `Start date: ${row.start_date}` : "",
      row.countries?.length ? `Countries: ${row.countries.join(", ")}` : "",
    ].filter(Boolean).join("\n"),
    source_url: row.source_url,
    source_label: `ClinicalTrials.gov ${row.nct_id}`,
  };
}

// ── Lane: Country Pathway ────────────────────────────────────────────────

async function countryPathwayLane(userQuery, entities) {
  const snippets = [];

  // Determine which countries to fetch
  let countryIsos = entities.countries || [];

  // If no specific countries detected, search by name
  if (!countryIsos.length) {
    const searchResult = await query(
      `SELECT country_iso FROM country_access_systems
       WHERE country_name ILIKE $1 OR country_iso ILIKE $1
       LIMIT 3`,
      [`%${userQuery}%`]
    );
    countryIsos = searchResult.rows.map((r) => r.country_iso);
  }

  // If still no countries and query is about pathways/HTA, fetch all
  if (!countryIsos.length) {
    const allResult = await query(
      `SELECT country_iso FROM country_access_systems ORDER BY country_name LIMIT 5`
    );
    countryIsos = allResult.rows.map((r) => r.country_iso);
  }

  for (const iso of countryIsos) {
    // Country system info
    const sysResult = await query(
      `SELECT * FROM country_access_systems WHERE country_iso = $1`,
      [iso]
    );
    if (!sysResult.rows.length) continue;
    const sys = sysResult.rows[0];

    // HTA bodies
    const htaResult = await query(
      `SELECT name, abbreviation, role, website, decision_db_url
       FROM hta_bodies WHERE country_iso = $1 ORDER BY role`,
      [iso]
    );

    // Pathway steps (includes source_url from migration 002)
    const pathResult = await query(
      `SELECT step_order, label, institution, is_gate, typical_months, likely_blocker, notes, source_url
       FROM market_access_pathways WHERE country_iso = $1 ORDER BY step_order`,
      [iso]
    );

    const htaBodies = htaResult.rows
      .map((h) => `  - ${h.abbreviation || h.name} (${h.role})${h.website ? ` — ${h.website}` : ""}`)
      .join("\n");

    const pathwaySteps = pathResult.rows
      .map((s) => {
        const gate = s.is_gate ? " [GATE]" : "";
        const time = s.typical_months ? ` (${s.typical_months} months)` : "";
        const blocker = s.likely_blocker ? `\n      Likely blocker: ${s.likely_blocker}` : "";
        return `  ${s.step_order}. ${s.label}${gate}${time}\n      Institution: ${s.institution || "N/A"}${blocker}`;
      })
      .join("\n");

    const coverage = sys.coverage_model || {};

    // Determine best source URL: country-level first, then first pathway step
    const countrySourceUrl = sys.source_url || null;
    const firstStepUrl = pathResult.rows.find((s) => s.source_url)?.source_url || null;
    const bestSourceUrl = countrySourceUrl || firstStepUrl;
    const bestSourceLabel = sys.source_label || `${sys.country_name} market access system`;

    snippets.push({
      type: "country_pathway",
      id: iso,
      title: `${sys.country_name} (${iso}) — Market Access Pathway`,
      content: [
        `Country: ${sys.country_name} (${iso})`,
        `System type: ${sys.system_type || "N/A"} | Income group: ${sys.income_group || "N/A"}`,
        `Formal HTA: ${sys.has_formal_hta ? "Yes" : "No"}`,
        coverage.description ? `Coverage: ${coverage.description}` : "",
        coverage.key_gap ? `Key gap: ${coverage.key_gap}` : "",
        "",
        "HTA Bodies:",
        htaBodies || "  None in database",
        "",
        "Market Access Pathway:",
        pathwaySteps || "  No pathway steps in database",
        sys.notes ? `\nNotes: ${sys.notes}` : "",
      ].filter((line) => line !== undefined).join("\n"),
      source_url: bestSourceUrl,
      source_label: bestSourceLabel,
    });
  }

  return snippets;
}

// ── Public API ───────────────────────────────────────────────────────────

const LANE_MAP = {
  sponsor_lane: sponsorLane,
  trial_lane: trialLane,
  country_pathway_lane: countryPathwayLane,
};

/**
 * Run retrieval across the specified lanes.
 *
 * @param {object} opts
 * @param {string} opts.query        — the user's question
 * @param {string[]} opts.lanes      — which lanes to activate
 * @param {object} opts.entities     — extracted entity hints
 * @returns {Promise<Array<{type, id, title, content, source_url, source_label}>>}
 */
export async function retrieve({ query: userQuery, lanes, entities = {} }) {
  const activeLanes = lanes
    .filter((l) => LANE_MAP[l])
    .map((l) => LANE_MAP[l](userQuery, entities));

  const results = await Promise.all(activeLanes);
  const snippets = results.flat();

  // Write-through: upsert unique source URLs into source_documents
  // This is a best-effort cache — retrieval still works if this fails
  try {
    const seen = new Set();
    for (const s of snippets) {
      if (!s.source_url || seen.has(s.source_url)) continue;
      seen.add(s.source_url);
      await query(
        `INSERT INTO source_documents (url, title, doc_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (url) DO NOTHING`,
        [s.source_url, s.source_label || null, s.type === "trial" ? "trial_record" : "pathway_source"]
      );
    }
  } catch {
    // Non-critical — source_documents is a write-through cache
  }

  return snippets;
}
