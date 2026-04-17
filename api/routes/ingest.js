// ═══════════════════════════════════════════════════════════════════════════
// Ingestion Routes — Admin-only triggers for external data connectors
//
// POST /api/ingest/ctgov — Trigger ClinicalTrials.gov ingestion
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ingestTrials } from "../services/ctgov-ingest.js";

const router = Router();

/**
 * POST /api/ingest/ctgov
 *
 * Trigger a ClinicalTrials.gov ingestion run.
 * Admin-only. Accepts optional body params to override defaults.
 *
 * Body (all optional):
 *   condition     string   — Disease/condition filter (default: "cancer")
 *   phase         string   — Phase filter (default: "PHASE2|PHASE3")
 *   sponsorType   string   — Lead sponsor class (default: "INDUSTRY")
 *   lookbackYears number   — Years to look back (default: 2)
 *   maxPages      number   — Max pages to fetch (default: 20)
 */
router.post(
  "/ctgov",
  requireAuth,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const opts = {
        condition: req.body.condition,
        phase: req.body.phase,
        sponsorType: req.body.sponsorType,
        lookbackYears: req.body.lookbackYears,
        maxPages: req.body.maxPages,
      };

      // Strip undefined values so defaults kick in
      Object.keys(opts).forEach((k) => opts[k] === undefined && delete opts[k]);

      const result = await ingestTrials(opts);

      res.json({
        status: "ok",
        message: `Ingested ${result.total} trials`,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
