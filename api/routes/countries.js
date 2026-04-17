// ═══════════════════════════════════════════════════════════════════════════
// Countries Routes
//
// GET /api/countries           — list all country access systems
// GET /api/countries/:iso      — detail with HTA bodies + pathway steps
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import { query } from "../db/connection.js";

const router = Router();

/**
 * GET /api/countries
 *
 * Returns all country access systems, optionally filtered.
 *
 * Query params:
 *   has_hta     — filter by has_formal_hta (true/false)
 *   income      — filter by income_group (HIC, UMIC, LMIC, LIC)
 *   system      — filter by system_type
 *   q           — search country_name (ILIKE)
 */
router.get("/", async (req, res, next) => {
  try {
    const conditions = [];
    const params = [];
    let paramIdx = 0;

    if (req.query.has_hta !== undefined) {
      paramIdx++;
      conditions.push(`has_formal_hta = $${paramIdx}`);
      params.push(req.query.has_hta === "true");
    }

    if (req.query.income) {
      paramIdx++;
      conditions.push(`income_group = $${paramIdx}`);
      params.push(req.query.income);
    }

    if (req.query.system) {
      paramIdx++;
      conditions.push(`system_type = $${paramIdx}`);
      params.push(req.query.system);
    }

    if (req.query.q) {
      paramIdx++;
      conditions.push(`country_name ILIKE $${paramIdx}`);
      params.push(`%${req.query.q}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM hta_bodies h WHERE h.country_iso = c.country_iso) AS hta_body_count,
              (SELECT COUNT(*) FROM market_access_pathways p WHERE p.country_iso = c.country_iso) AS pathway_step_count
       FROM country_access_systems c
       ${where}
       ORDER BY c.country_name ASC`
      , params
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/countries/:iso
 *
 * Returns a single country with its HTA bodies and full pathway steps.
 */
router.get("/:iso", async (req, res, next) => {
  try {
    const iso = req.params.iso.toUpperCase();

    const countryResult = await query(
      `SELECT * FROM country_access_systems WHERE country_iso = $1`,
      [iso]
    );

    if (!countryResult.rows.length) {
      return res.status(404).json({ error: "Country not found" });
    }

    const country = countryResult.rows[0];

    // Fetch HTA bodies for this country
    const htaResult = await query(
      `SELECT id, slug, name, abbreviation, role, website, decision_db_url, has_api
       FROM hta_bodies
       WHERE country_iso = $1
       ORDER BY role ASC, name ASC`,
      [iso]
    );

    // Fetch pathway steps for this country
    const pathwayResult = await query(
      `SELECT step_order, label, institution, is_gate, typical_months, likely_blocker, notes
       FROM market_access_pathways
       WHERE country_iso = $1
       ORDER BY step_order ASC`,
      [iso]
    );

    res.json({
      data: {
        ...country,
        hta_bodies: htaResult.rows,
        pathway: pathwayResult.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
