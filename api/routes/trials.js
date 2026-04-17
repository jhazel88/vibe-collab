// ═══════════════════════════════════════════════════════════════════════════
// Trials Routes
//
// GET /api/trials              — paginated list with rich filtering
// GET /api/trials/:nctId       — single trial by NCT ID
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import { query } from "../db/connection.js";

const router = Router();

/**
 * GET /api/trials
 *
 * Query params:
 *   asset_id    — filter by linked asset
 *   sponsor_id  — filter by sponsor (joins via sponsor_name match)
 *   phase       — filter by phase (phase2, phase3)
 *   status      — filter by trial status (recruiting, completed, etc.)
 *   condition   — filter by condition (partial match in array)
 *   country     — filter by country (partial match in array)
 *   q           — search title (ILIKE)
 *   page        — page number (default 1)
 *   limit       — items per page (default 50, max 200)
 *   sort        — column to sort by (default: start_date)
 *   order       — asc | desc (default: desc)
 */
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const allowedSorts = ["title", "phase", "status", "enrollment", "start_date", "created_at"];
    const sort = allowedSorts.includes(req.query.sort) ? req.query.sort : "start_date";
    const order = req.query.order === "asc" ? "ASC" : "DESC";

    const conditions = [];
    const params = [];
    let paramIdx = 0;

    if (req.query.asset_id) {
      paramIdx++;
      conditions.push(`t.asset_id = $${paramIdx}`);
      params.push(parseInt(req.query.asset_id, 10));
    }

    if (req.query.sponsor_id) {
      paramIdx++;
      conditions.push(`EXISTS (SELECT 1 FROM sponsors s WHERE s.id = $${paramIdx} AND LOWER(s.name) = LOWER(t.sponsor_name))`);
      params.push(parseInt(req.query.sponsor_id, 10));
    }

    if (req.query.phase) {
      paramIdx++;
      conditions.push(`t.phase = $${paramIdx}`);
      params.push(req.query.phase);
    }

    if (req.query.status) {
      paramIdx++;
      conditions.push(`t.status = $${paramIdx}`);
      params.push(req.query.status);
    }

    if (req.query.condition) {
      paramIdx++;
      conditions.push(`$${paramIdx} ILIKE ANY(t.conditions)`);
      params.push(`%${req.query.condition}%`);
    }

    if (req.query.country) {
      paramIdx++;
      conditions.push(`$${paramIdx} = ANY(t.countries)`);
      params.push(req.query.country);
    }

    if (req.query.q) {
      paramIdx++;
      conditions.push(`t.title ILIKE $${paramIdx}`);
      params.push(`%${req.query.q}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM trials t ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT t.id, t.nct_id, t.euct_id, t.asset_id, t.title, t.phase, t.status,
              t.sponsor_name, t.sponsor_class, t.conditions, t.interventions,
              t.enrollment, t.start_date, t.primary_completion_date, t.completion_date,
              t.countries, t.results_available, t.source_url, t.fetched_at
       FROM trials t
       ${where}
       ORDER BY t.${sort} ${order} NULLS LAST
       LIMIT $${paramIdx + 1} OFFSET $${paramIdx + 2}`,
      [...params, limit, offset]
    );

    res.json({
      data: dataResult.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trials/:nctId
 *
 * Returns a single trial by its NCT ID.
 */
router.get("/:nctId", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT t.*,
              a.name AS asset_name, a.slug AS asset_slug
       FROM trials t
       LEFT JOIN assets a ON a.id = t.asset_id
       WHERE t.nct_id = $1`,
      [req.params.nctId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Trial not found" });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
