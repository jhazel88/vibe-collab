// ═══════════════════════════════════════════════════════════════════════════
// Database Connection — PostgreSQL + pgvector
// Uses pg pool with graceful shutdown. Falls back gracefully when no DB.
//
// Donor: EU Digital Strategy Tracker api/db/connection.js
// Changes: none — generic utility, lifted as-is
// ═══════════════════════════════════════════════════════════════════════════

const DATABASE_URL = process.env.DATABASE_URL;

let _poolPromise = null;

/**
 * Lazy async pool getter (handles dynamic import)
 */
export async function getPool() {
  if (!DATABASE_URL) return null;

  if (!_poolPromise) {
    _poolPromise = (async () => {
      try {
        const pg = await import("pg");
        const Pool = pg.default?.Pool || pg.Pool;
        const p = new Pool({
          connectionString: DATABASE_URL,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });
        p.on("error", (err) => {
          console.error("[db] Unexpected pool error:", err.message);
        });
        return p;
      } catch (err) {
        console.warn("[db] pg not installed or failed to connect, running in file-based mode");
        return null;
      }
    })();
  }

  return _poolPromise;
}

/**
 * Execute a query against the pool.
 * Returns null if no database is configured.
 */
export async function query(text, params = []) {
  const p = await getPool();
  if (!p) return null;

  const start = Date.now();
  try {
    const result = await p.query(text, params);
    const duration = Date.now() - start;
    if (duration > 200) {
      console.warn(`[db] Slow query (${duration}ms): ${text.slice(0, 80)}...`);
    }
    return result;
  } catch (err) {
    console.error(`[db] Query error: ${err.message}`);
    throw err;
  }
}

/**
 * Check if the database is available
 */
export async function healthCheck() {
  try {
    const result = await query("SELECT 1 as ok");
    if (!result) return { status: "no_database", mode: "file-based" };
    return { status: "connected", mode: "postgresql" };
  } catch (err) {
    return { status: "error", error: err.message, mode: "postgresql" };
  }
}

/**
 * Graceful shutdown
 */
export async function shutdown() {
  const p = await getPool();
  if (p) {
    await p.end();
    console.log("[db] Pool closed");
  }
}
