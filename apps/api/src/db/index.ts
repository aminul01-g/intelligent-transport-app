import { Pool, PoolClient, QueryResult } from 'pg';
import { env } from '../config/env';

// ──────────────────────────────────────────────
// Pool initialisation
// ──────────────────────────────────────────────

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: env.DATABASE_POOL_MIN,
  max: env.DATABASE_POOL_MAX,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Execute a parameterised SQL query against the pool.
 *
 * @example
 *   const { rows } = await db.query<User>('SELECT * FROM users WHERE id = $1', [id]);
 */
async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(sql, params);
}

/**
 * Run `fn` inside a database transaction.
 *
 * Acquires a client from the pool, issues BEGIN, invokes `fn` with that
 * client, then COMMITs on success or ROLLBACKs on error.  The client is
 * always released back to the pool.
 *
 * @example
 *   const user = await db.transaction(async (client) => {
 *     const { rows } = await client.query('INSERT INTO users …');
 *     return rows[0];
 *   });
 */
async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Lightweight health probe — returns `true` when the pool can execute
 * a trivial query within a reasonable time frame.
 */
async function isHealthy(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Drain all connections.  Called during graceful shutdown.
 */
async function close(): Promise<void> {
  await pool.end();
  console.log('[DB] Pool closed');
}

export const db = { query, transaction, isHealthy, close } as const;
