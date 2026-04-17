#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════════
// Seed Loader — Idempotent upsert of sponsors, HTA bodies, country systems,
// and market access pathways from JSON seed files.
//
// Usage: node api/db/seed-loader.js
// Requires: DATABASE_URL environment variable
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, shutdown } from "./connection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_DIR = path.join(__dirname, "seed-json");

async function loadJSON(filename) {
  const raw = await fs.readFile(path.join(SEED_DIR, filename), "utf-8");
  return JSON.parse(raw);
}

// ── Upsert helpers ────────────────────────────────────────────────────────

async function upsertSponsors(client, sponsors) {
  let created = 0, updated = 0;

  for (const s of sponsors) {
    const result = await client.query(
      `INSERT INTO sponsors (slug, name, headquarters, type, website, financials, therapeutic_areas)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         headquarters = EXCLUDED.headquarters,
         type = EXCLUDED.type,
         website = EXCLUDED.website,
         financials = EXCLUDED.financials,
         therapeutic_areas = EXCLUDED.therapeutic_areas,
         updated_at = now()
       RETURNING (xmax = 0) AS is_insert`,
      [
        s.slug,
        s.name,
        s.headquarters ? JSON.stringify(s.headquarters) : null,
        s.type,
        s.website,
        s.financials ? JSON.stringify(s.financials) : null,
        s.therapeutic_areas || [],
      ]
    );
    if (result.rows[0]?.is_insert) created++;
    else updated++;
  }

  return { created, updated };
}

async function upsertHTABodies(client, bodies) {
  let created = 0, updated = 0;

  for (const b of bodies) {
    const result = await client.query(
      `INSERT INTO hta_bodies (slug, name, abbreviation, country_iso, role, website, decision_db_url, has_api)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         abbreviation = EXCLUDED.abbreviation,
         country_iso = EXCLUDED.country_iso,
         role = EXCLUDED.role,
         website = EXCLUDED.website,
         decision_db_url = EXCLUDED.decision_db_url,
         has_api = EXCLUDED.has_api
       RETURNING (xmax = 0) AS is_insert`,
      [
        b.slug,
        b.name,
        b.abbreviation || null,
        b.country_iso,
        b.role || null,
        b.website || null,
        b.decision_db_url || null,
        b.has_api || false,
      ]
    );
    if (result.rows[0]?.is_insert) created++;
    else updated++;
  }

  return { created, updated };
}

async function upsertCountrySystems(client, countries) {
  let created = 0, updated = 0;

  for (const c of countries) {
    const result = await client.query(
      `INSERT INTO country_access_systems (country_iso, country_name, income_group, has_formal_hta, system_type, coverage_model, notes, source_url, source_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (country_iso) DO UPDATE SET
         country_name = EXCLUDED.country_name,
         income_group = EXCLUDED.income_group,
         has_formal_hta = EXCLUDED.has_formal_hta,
         system_type = EXCLUDED.system_type,
         coverage_model = EXCLUDED.coverage_model,
         notes = EXCLUDED.notes,
         source_url = EXCLUDED.source_url,
         source_label = EXCLUDED.source_label,
         updated_at = now()
       RETURNING (xmax = 0) AS is_insert`,
      [
        c.country_iso,
        c.country_name,
        c.income_group || null,
        c.has_formal_hta || false,
        c.system_type || null,
        c.coverage_model ? JSON.stringify(c.coverage_model) : null,
        c.notes || null,
        c.source_url || null,
        c.source_label || null,
      ]
    );
    if (result.rows[0]?.is_insert) created++;
    else updated++;
  }

  return { created, updated };
}

async function upsertPathways(client, pathways) {
  let created = 0, updated = 0;

  for (const pw of pathways) {
    // Country-level source URL is the fallback for steps without their own
    const countrySourceUrl = pw.source_url || null;

    for (const step of pw.steps) {
      const result = await client.query(
        `INSERT INTO market_access_pathways (country_iso, step_order, label, institution, is_gate, typical_months, likely_blocker, notes, source_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (country_iso, step_order) DO UPDATE SET
           label = EXCLUDED.label,
           institution = EXCLUDED.institution,
           is_gate = EXCLUDED.is_gate,
           typical_months = EXCLUDED.typical_months,
           likely_blocker = EXCLUDED.likely_blocker,
           notes = EXCLUDED.notes,
           source_url = EXCLUDED.source_url
         RETURNING (xmax = 0) AS is_insert`,
        [
          pw.country_iso,
          step.step_order,
          step.label,
          step.institution || null,
          step.is_gate || false,
          step.typical_months || null,
          step.likely_blocker || null,
          step.notes || null,
          step.source_url || countrySourceUrl,
        ]
      );
      if (result.rows[0]?.is_insert) created++;
      else updated++;
    }
  }

  return { created, updated };
}

async function upsertAssets(client, assets) {
  let created = 0, updated = 0, skipped = 0;

  // Build sponsor slug → id lookup
  const sponsorResult = await client.query("SELECT id, slug FROM sponsors");
  const sponsorMap = new Map(sponsorResult.rows.map((r) => [r.slug, r.id]));

  for (const a of assets) {
    const sponsorId = sponsorMap.get(a.sponsor_slug) || null;
    if (!sponsorId) {
      console.warn(`[seed] Asset "${a.slug}": sponsor "${a.sponsor_slug}" not found, skipping`);
      skipped++;
      continue;
    }

    const result = await client.query(
      `INSERT INTO assets (slug, name, sponsor_id, modality, indications, phase, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         sponsor_id = EXCLUDED.sponsor_id,
         modality = EXCLUDED.modality,
         indications = EXCLUDED.indications,
         phase = EXCLUDED.phase,
         status = EXCLUDED.status,
         updated_at = now()
       RETURNING (xmax = 0) AS is_insert`,
      [
        a.slug,
        a.name,
        sponsorId,
        a.modality || null,
        a.indications || [],
        a.phase || null,
        a.status || "active",
      ]
    );
    if (result.rows[0]?.is_insert) created++;
    else updated++;
  }

  return { created, updated, skipped };
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const pool = await getPool();
  if (!pool) {
    throw new Error("Database not configured. Set DATABASE_URL.");
  }

  const client = await pool.connect();

  try {
    console.log("[seed] Loading seed files...");

    const sponsors = await loadJSON("sponsors.json");
    const assets = await loadJSON("assets.json");
    const htaBodies = await loadJSON("hta-bodies.json");
    const countrySystems = await loadJSON("country-systems.json");

    console.log(`[seed] Sponsors: ${sponsors.length} records`);
    console.log(`[seed] Assets: ${assets.length} records`);
    console.log(`[seed] HTA bodies: ${htaBodies.length} records`);
    console.log(`[seed] Countries: ${countrySystems.countries.length} records`);
    console.log(`[seed] Pathways: ${countrySystems.pathways.length} countries × steps`);

    await client.query("BEGIN");

    // Order matters: countries must exist before pathways (FK constraint)
    const sponsorResult = await upsertSponsors(client, sponsors);
    console.log(`[seed] Sponsors: ${sponsorResult.created} created, ${sponsorResult.updated} updated`);

    // Assets must come after sponsors (FK dependency)
    const assetResult = await upsertAssets(client, assets);
    console.log(`[seed] Assets: ${assetResult.created} created, ${assetResult.updated} updated${assetResult.skipped ? `, ${assetResult.skipped} skipped` : ""}`);

    const htaResult = await upsertHTABodies(client, htaBodies);
    console.log(`[seed] HTA bodies: ${htaResult.created} created, ${htaResult.updated} updated`);

    const countryResult = await upsertCountrySystems(client, countrySystems.countries);
    console.log(`[seed] Countries: ${countryResult.created} created, ${countryResult.updated} updated`);

    const pathwayResult = await upsertPathways(client, countrySystems.pathways);
    console.log(`[seed] Pathways: ${pathwayResult.created} created, ${pathwayResult.updated} updated`);

    await client.query("COMMIT");
    console.log("[seed] Done. All seed data loaded successfully.");

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

let exitCode = 0;

try {
  await main();
} catch (error) {
  exitCode = 1;
  console.error(`[seed] ${error.message}`);
} finally {
  try {
    await shutdown();
  } catch (error) {
    exitCode = 1;
    console.error(`[seed] Shutdown error: ${error.message}`);
  }
  process.exit(exitCode);
}
