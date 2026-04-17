#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════════
// Migration Runner — Applies SQL migrations in order
//
// Donor: EU Digital Strategy Tracker api/db/migrate.js
// Changes: none — generic utility, lifted as-is
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { getPool, shutdown } from "./connection.js";

const MIGRATION_FILE_PATTERN = /^\d{3}_[a-z0-9][a-z0-9_-]*\.sql$/i;
const SCHEMA_MIGRATIONS_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    executed_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const fromIndex = argv.indexOf("--from");
  const from = fromIndex >= 0 ? argv[fromIndex + 1] : null;

  if (fromIndex >= 0 && (!from || from.startsWith("-"))) {
    throw new Error("Missing value for --from");
  }

  const unknownFlags = argv.filter((arg, index) => {
    if (!arg.startsWith("-")) return false;
    if (arg === "--dry-run") return false;
    if (arg === "--from") return false;
    if (fromIndex >= 0 && index === fromIndex + 1) return false;
    return true;
  });

  if (unknownFlags.length > 0) {
    throw new Error(`Unknown option(s): ${unknownFlags.join(", ")}`);
  }

  return { dryRun, from };
}

async function listMigrationFiles() {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && MIGRATION_FILE_PATTERN.test(entry.name))
    .map((entry) => ({
      filename: entry.name,
      filepath: path.join(MIGRATIONS_DIR, entry.name),
    }))
    .sort((left, right) => left.filename.localeCompare(right.filename));
}

function filterMigrationsFrom(migrations, from) {
  if (!from) return migrations;

  const startIndex = migrations.findIndex((migration) => migration.filename === from);
  if (startIndex === -1) {
    throw new Error(`Migration not found: ${from}`);
  }

  return migrations.slice(startIndex);
}

async function ensureSchemaMigrationsTable(client) {
  await client.query(SCHEMA_MIGRATIONS_SQL);
}

async function fetchAppliedMigrations(client) {
  const result = await client.query(`
    SELECT version
    FROM schema_migrations
    ORDER BY version ASC
  `);

  return new Set(result.rows.map((row) => row.version));
}

async function runMigration(client, migration) {
  const sql = await fs.readFile(migration.filepath, "utf8");

  console.log(`[migrate] Applying ${migration.filename}`);
  await client.query("BEGIN");

  try {
    await client.query(sql);
    await client.query(
      `
        INSERT INTO schema_migrations (version)
        VALUES ($1)
      `,
      [migration.filename],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw new Error(`${migration.filename} failed: ${error.message}`);
  }
}

async function main() {
  const { dryRun, from } = parseArgs(process.argv.slice(2));
  const pool = await getPool();

  if (!pool) {
    throw new Error(
      "Database connection is unavailable. Set DATABASE_URL before running migrations.",
    );
  }

  const migrations = filterMigrationsFrom(await listMigrationFiles(), from);
  const client = await pool.connect();

  try {
    await ensureSchemaMigrationsTable(client);

    const applied = await fetchAppliedMigrations(client);
    const pending = migrations.filter(
      (migration) => !applied.has(migration.filename),
    );

    if (pending.length === 0) {
      console.log(
        dryRun
          ? "[migrate] Dry run: no pending migrations."
          : "[migrate] No pending migrations.",
      );
      return;
    }

    if (dryRun) {
      console.log("[migrate] Dry run: pending migrations:");
      for (const migration of pending) {
        console.log(`- ${migration.filename}`);
      }
      return;
    }

    for (const migration of pending) {
      await runMigration(client, migration);
    }

    console.log(`[migrate] Applied ${pending.length} migration(s).`);
  } finally {
    client.release();
  }
}

let exitCode = 0;

try {
  await main();
} catch (error) {
  exitCode = 1;
  console.error(`[migrate] ${error.message}`);
} finally {
  try {
    await shutdown();
  } catch (error) {
    exitCode = 1;
    console.error(`[migrate] Failed to shut down pool cleanly: ${error.message}`);
  }

  process.exit(exitCode);
}
