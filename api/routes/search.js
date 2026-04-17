// ═══════════════════════════════════════════════════════════════════════════
// Cross-Entity Search Route
//
// GET /api/search?q=   — searches across sponsors, assets, trials
// Returns grouped results by entity type, ranked by relevance.
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import { query } from "../db/connection.js";

const router = Router();

const MAX_PER_TYPE = 10;

/**
 * GET /api/search?q=
 *
 * Query params:
 *   q       — search term (required, min 2 chars)
 *   types   — comma-separated entity types to search (default: all)
 *             Valid: sponsors, assets, trials, countries
 *   limit   — max results per type (default 10, max 50)
 */
router.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 2) {
      return res.status(400).json({ error: "Query must be at least 2 characters" });
    }

    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || MAX_PER_TYPE));
    const pattern = `%${q}%`;

    const requestedTypes = req.query.types
      ? req.query.types.split(",").map((t) => t.trim().toLowerCase())
      : ["sponsors", "assets", "trials", "countries"];

    const results = {};

    // ── Sponsors ─────────────────────────────────────────────────────
    if (requestedTypes.includes("sponsors")) {
      const sponsorResult = await query(
        `SELECT slug, name, type, headquarters, therapeutic_areas
         FROM sponsors
         WHERE name ILIKE $1 OR slug ILIKE $1
            OR EXISTS (SELECT 1 FROM unnest(therapeutic_areas) AS elem WHERE elem ILIKE $1)
         ORDER BY
           CASE WHEN LOWER(name) = LOWER($2) THEN 0
                WHEN LOWER(name) LIKE LOWER($2) || '%' THEN 1
                ELSE 2 END,
           name ASC
         LIMIT $3`,
        [pattern, q, limit]
      );
      results.sponsors = sponsorResult.rows;
    }

    // ── Assets ───────────────────────────────────────────────────────
    if (requestedTypes.includes("assets")) {
      const assetResult = await query(
        `SELECT a.slug, a.name, a.phase, a.modality, a.indications,
                s.name AS sponsor_name, s.slug AS sponsor_slug
         FROM assets a
         LEFT JOIN sponsors s ON s.id = a.sponsor_id
         WHERE a.name ILIKE $1 OR a.slug ILIKE $1
         ORDER BY
           CASE WHEN LOWER(a.name) = LOWER($2) THEN 0
                WHEN LOWER(a.name) LIKE LOWER($2) || '%' THEN 1
                ELSE 2 END,
           a.name ASC
         LIMIT $3`,
        [pattern, q, limit]
      );
      results.assets = assetResult.rows;
    }

    // ── Trials ───────────────────────────────────────────────────────
    if (requestedTypes.includes("trials")) {
      const trialResult = await query(
        `SELECT nct_id, title, phase, status, sponsor_name, sponsor_class,
                conditions, enrollment, start_date, source_url
         FROM trials
         WHERE title ILIKE $1
            OR nct_id ILIKE $1
            OR sponsor_name ILIKE $1
            OR EXISTS (SELECT 1 FROM unnest(conditions) AS elem WHERE elem ILIKE $1)
         ORDER BY
           CASE WHEN nct_id ILIKE $2 THEN 0
                WHEN LOWER(sponsor_name) = LOWER($2) THEN 1
                ELSE 2 END,
           start_date DESC NULLS LAST
         LIMIT $3`,
        [pattern, q, limit]
      );
      results.trials = trialResult.rows;
    }

    // ── Countries ────────────────────────────────────────────────────
    if (requestedTypes.includes("countries")) {
      const countryResult = await query(
        `SELECT c.country_iso, c.country_name, c.system_type, c.has_formal_hta,
                c.income_group
         FROM country_access_systems c
         WHERE c.country_name ILIKE $1
            OR c.country_iso ILIKE $1
         ORDER BY c.country_name ASC
         LIMIT $2`,
        [pattern, limit]
      );
      results.countries = countryResult.rows;
    }

    // Total count across all types
    const totalHits = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

    res.json({
      query: q,
      total: totalHits,
      results,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
