// ═══════════════════════════════════════════════════════════════════════════
// Snapshot Store — Acquire & deduplicate raw source content
//
// Responsible for: fetching from source URLs, computing content hashes,
// deduplicating against existing snapshots, storing raw artifacts.
//
// Donor: EU Digital Strategy Tracker api/services/snapshot-store.js
// Changes: table references updated (evidence_objects → source_documents,
//   source_registry → source_documents), User-Agent updated for HTA domain,
//   pipeline_runs logging removed (no pipeline_runs table yet)
// ═══════════════════════════════════════════════════════════════════════════

import { createHash } from "crypto";
import { query } from "../db/connection.js";

/**
 * Acquire a snapshot from a URL.
 * Returns { snapshot_uri, content_hash, is_new, raw_text }
 *
 * @param {Object} source — { url, doc_type, title }
 * @param {Object} opts
 * @param {string} opts.storage_backend — "local" | "s3" | "r2" (default: "local")
 */
export async function acquireSnapshot(source, opts = {}) {
  const { storage_backend = "local" } = opts;
  const startMs = Date.now();

  // 1. Fetch content from source URL
  const rawText = await fetchSourceContent(source);
  if (!rawText) {
    return {
      success: false,
      error: "Empty response from source",
      url: source.url,
    };
  }

  // 2. Compute content hash for dedup
  const contentHash = computeHash(rawText);

  // 3. Check for existing snapshot with same hash
  const existing = await query(
    `SELECT id, content_hash FROM source_documents
     WHERE content_hash = $1 AND url = $2
     LIMIT 1`,
    [contentHash, source.url]
  );

  if (existing?.rows?.[0]) {
    return {
      success: true,
      is_new: false,
      content_hash: contentHash,
      existing_id: existing.rows[0].id,
      latency_ms: Date.now() - startMs,
    };
  }

  // 4. Store raw snapshot
  const snapshotUri = await storeRawSnapshot(rawText, source, contentHash, storage_backend);

  return {
    success: true,
    is_new: true,
    content_hash: contentHash,
    snapshot_uri: snapshotUri,
    raw_text: rawText,
    url: source.url,
    byte_size: Buffer.byteLength(rawText, "utf-8"),
    latency_ms: Date.now() - startMs,
  };
}

/**
 * Fetch content from a source URL.
 */
async function fetchSourceContent(source) {
  const { url } = source;

  if (!url) {
    console.warn(`[snapshot] No URL provided`);
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "HTA-Market-Access-Tracker/0.1 (research; regulatory-intelligence)",
        Accept: "application/json, text/html, text/plain, */*",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[snapshot] HTTP ${response.status} from ${url}`);
      return null;
    }

    return await response.text();
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn(`[snapshot] Timeout fetching ${url}`);
    } else {
      console.warn(`[snapshot] Fetch error for ${url}: ${err.message}`);
    }
    return null;
  }
}

/**
 * Compute SHA-256 hash of normalized content
 */
export function computeHash(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized, "utf-8").digest("hex");
}

/**
 * Sanitize a key for path safety.
 */
function sanitizeKey(key) {
  if (!key || typeof key !== "string") {
    throw new Error("Invalid key: must be a non-empty string");
  }
  const sanitized = key.replace(/[^a-zA-Z0-9_.-]/g, "_");
  if (sanitized.includes("..") || sanitized.startsWith(".")) {
    throw new Error(`Invalid key: contains path traversal characters: ${key}`);
  }
  return sanitized;
}

/**
 * Store raw snapshot to configured backend.
 */
async function storeRawSnapshot(rawText, source, contentHash, backend) {
  const safeKey = sanitizeKey(source.url?.replace(/https?:\/\//, "").slice(0, 60) || "unknown");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `snapshots/${safeKey}/${timestamp}-${contentHash.slice(0, 12)}`;

  switch (backend) {
    case "s3":
    case "r2":
      console.log(`[snapshot] Would upload to ${backend}://${key}`);
      return `${backend}://${process.env.BUCKET_NAME || "hta-snapshots"}/${key}`;

    case "local":
    default: {
      const fs = await import("fs/promises");
      const path = await import("path");
      const baseDir = path.resolve(process.cwd(), ".pipeline-data", "snapshots");
      const dir = path.join(baseDir, safeKey);

      const resolvedDir = path.resolve(dir);
      if (!resolvedDir.startsWith(baseDir)) {
        throw new Error(`Path traversal blocked: ${resolvedDir} escapes ${baseDir}`);
      }

      try {
        await fs.mkdir(dir, { recursive: true });
        const filePath = path.join(dir, `${timestamp}.txt`);
        await fs.writeFile(filePath, rawText, "utf-8");
        return `file://${filePath}`;
      } catch (err) {
        console.error(`[snapshot] Failed to write snapshot: ${err.message}`);
        throw new Error(`Snapshot storage failed: ${err.message}`);
      }
    }
  }
}
