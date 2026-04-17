// ═══════════════════════════════════════════════════════════════════════════
// Assets Routes
//
// GET /api/assets              — paginated list, filterable by phase, sponsor, modality
// GET /api/assets/:slug        — single asset with linked trials
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import { query } from "../db/connection.js";

const router = Router();

/**
 * GET /api/assets
 *
 * Query params:
 *   phase       — filter by development phase
 *   sponsor_id  — filter by sponsor ID
 *   modality    — filter by modality
 *   indication  — filter by indication (partial match in array)
 *   q           — search name (ILIKE)
 *   page        — page number (default 1)
 *   limit       — items per page (default 50, max 200)
 *   sort        — column to sort by (default: name)
 *   order       — asc | desc (default: asc)
 */
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const allowedSorts = ["name", "slug", "phase", "modality", "created_at"];
    const sort = allowedSorts.includes(req.query.sort) ? req.query.sort : "name";
    const order = req.query.order === "desc" ? "DESC" : "ASC";

    const conditions = [];
    const params = [];
    let paramIdx = 0;

    if (req.query.phase) {
      paramIdx++;
      conditions.push(`a.phase = $${paramIdx}`);
      params.push(req.query.phase);
    }

    if (req.query.sponsor_id) {
      paramIdx++;
      conditions.push(`a.sponsor_id = $${paramIdx}`);
      params.push(parseInt(req.query.sponsor_id, 10));
    }

    if (req.query.modality) {
      paramIdx++;
      conditions.push(`a.modality = $${paramIdx}`);
      params.push(req.query.modality);
    }

    if (req.query.indication) {
      paramIdx++;
      conditions.push(`$${paramIdx} ILIKE ANY(a.indications)`);
      params.push(`%${req.query.indication}%`);
    }

    if (req.query.q) {
      paramIdx++;
      conditions.push(`a.name ILIKE $${paramIdx}`);
      params.push(`%${req.query.q}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM assets a ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await query(
      `SELECT a.*, s.name AS sponsor_name, s.slug AS sponsor_slug
       FROM assets a
       LEFT JOIN sponsors s ON s.id = a.sponsor_id
       ${where}
       ORDER BY a.${sort} ${order}
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
 * GET /api/assets/:slug
 *
 * Returns asset detail with sponsor info and linked trials.
 */
router.get("/:slug", async (req, res, next) => {
  try {
    const assetResult = await query(
      `SELECT a.*, s.name AS sponsor_name, s.slug AS sponsor_slug
       FROM assets a
       LEFT JOIN sponsors s ON s.id = a.sponsor_id
       WHERE a.slug = $1`,
      [req.params.slug]
    );

    if (!assetResult.rows.length) {
      return res.status(404).json({ error: "Asset not found" });
    }

    const asset = assetResult.rows[0];

    // Fetch linked trials
    const trialsResult = await query(
      `SELECT id, nct_id, title, phase, status, enrollment, start_date,
              primary_completion_date, countries, results_available, source_url
       FROM trials
       WHERE asset_id = $1
       ORDER BY start_date DESC NULLS LAST
       LIMIT 50`,
      [asset.id]
    );

    res.json({
      data: {
        ...asset,
        trials: trialsResult.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
