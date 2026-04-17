// ═══════════════════════════════════════════════════════════════════════════
// Sponsors Routes
//
// GET /api/sponsors           — paginated list, filterable by type, therapeutic area
// GET /api/sponsors/:slug     — single sponsor with linked asset/trial counts
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import { query } from "../db/connection.js";

const router = Router();

/**
 * GET /api/sponsors
 *
 * Query params:
 *   type     — filter by sponsor type (originator, biotech, generic, cro)
 *   area     — filter by therapeutic area (partial match)
 *   q        — search name (ILIKE)
 *   page     — page number (default 1)
 *   limit    — items per page (default 50, max 200)
 *   sort     — column to sort by (default: name)
 *   order    — asc | desc (default: asc)
 */
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const allowedSorts = ["name", "slug", "type", "created_at"];
    const sort = allowedSorts.includes(req.query.sort) ? req.query.sort : "name";
    const order = req.query.order === "desc" ? "DESC" : "ASC";

    const conditions = [];
    const params = [];
    let paramIdx = 0;

    if (req.query.type) {
      paramIdx++;
      conditions.push(`type = $${paramIdx}`);
      params.push(req.query.type);
    }

    if (req.query.area) {
      paramIdx++;
      conditions.push(`EXISTS (SELECT 1 FROM unnest(therapeutic_areas) AS elem WHERE elem ILIKE $${paramIdx})`);
      params.push(`%${req.query.area}%`);
    }

    if (req.query.q) {
      paramIdx++;
      conditions.push(`name ILIKE $${paramIdx}`);
      params.push(`%${req.query.q}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count query
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM sponsors ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Data query
    const dataResult = await query(
      `SELECT id, slug, name, headquarters, type, website, financials, therapeutic_areas, created_at, updated_at
       FROM sponsors ${where}
       ORDER BY ${sort} ${order}
       LIMIT $${paramIdx + 1} OFFSET $${paramIdx + 2}`,
      [...params, limit, offset]
    );

    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sponsors/:slug
 *
 * Returns sponsor detail with counts of linked assets and trials.
 */
router.get("/:slug", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM assets a WHERE a.sponsor_id = s.id) AS asset_count,
              (SELECT COUNT(*) FROM trials t WHERE LOWER(t.sponsor_name) = LOWER(s.name)) AS trial_count
       FROM sponsors s
       WHERE s.slug = $1`,
      [req.params.slug]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Sponsor not found" });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
