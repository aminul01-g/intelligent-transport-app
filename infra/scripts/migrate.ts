import fs from "fs";
import path from "path";
import { Client } from "pg";
import dotenv from "dotenv";

// ---------------------------------------------------------------------------
// migrate.ts — Database migration runner for the Intelligent Transport app
//
// Usage:
//   npx ts-node infra/scripts/migrate.ts up      — apply all pending migrations
//   npx ts-node infra/scripts/migrate.ts down    — roll back last applied migration
//   npx ts-node infra/scripts/migrate.ts status  — print applied/pending state
//
// Migrations live in: infra/migrations/*.sql
// Rollbacks live in:  infra/migrations/*.down.sql
// Applied migrations are tracked in the schema_migrations table.
// ---------------------------------------------------------------------------

dotenv.config({ path: path.resolve(__dirname, "../../apps/api/.env") });

const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");
const TRACKING_TABLE = "schema_migrations";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get a connected pg Client. Exits process on failure. */
async function getClient(): Promise<Client> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "[migrate] ERROR: DATABASE_URL environment variable is not set.",
    );
    process.exit(1);
  }
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

/**
 * Ensure the schema_migrations tracking table exists.
 * Safe to call on every run — uses CREATE TABLE IF NOT EXISTS.
 */
async function ensureTrackingTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      filename   TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

/**
 * Return all forward migration filenames (*.sql, excluding *.down.sql)
 * sorted lexicographically so that they run in deterministic order.
 */
function getForwardMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
    .sort();
}

/** Return the set of already-applied migration filenames from the DB. */
async function getAppliedMigrations(client: Client): Promise<Set<string>> {
  const result = await client.query<{ filename: string }>(
    `SELECT filename FROM ${TRACKING_TABLE} ORDER BY applied_at ASC`,
  );
  return new Set(result.rows.map((r) => r.filename));
}

// ---------------------------------------------------------------------------
// Command: up
// Apply all pending migrations in lexicographic order.
// Each migration runs inside its own transaction so a failure is fully atomic.
// ---------------------------------------------------------------------------
async function commandUp(client: Client): Promise<void> {
  await ensureTrackingTable(client);

  const allFiles = getForwardMigrationFiles();
  const applied = await getAppliedMigrations(client);
  const pending = allFiles.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("[migrate] ✓ No pending migrations — database is up to date.");
    return;
  }

  console.log(`[migrate] Applying ${pending.length} pending migration(s)...`);

  for (const filename of pending) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filePath, "utf-8");

    console.log(`[migrate]   → ${filename}`);

    // Each migration is wrapped in its own transaction for atomicity
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        `INSERT INTO ${TRACKING_TABLE} (filename) VALUES ($1)`,
        [filename],
      );
      await client.query("COMMIT");
      console.log(`[migrate]   ✓ Applied: ${filename}`);
    } catch (err) {
      await client.query("ROLLBACK");
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[migrate]   ✗ Failed on "${filename}", rolled back. Error: ${msg}`,
      );
      process.exit(1);
    }
  }

  console.log(`[migrate] ✓ All migrations applied successfully.`);
}

// ---------------------------------------------------------------------------
// Command: down
// Roll back the most recently applied migration.
// Requires a corresponding <name>.down.sql file to exist.
// ---------------------------------------------------------------------------
async function commandDown(client: Client): Promise<void> {
  await ensureTrackingTable(client);

  // Find the most recently applied migration
  const result = await client.query<{ filename: string; applied_at: string }>(
    `SELECT filename, applied_at FROM ${TRACKING_TABLE} ORDER BY applied_at DESC LIMIT 1`,
  );

  if (result.rows.length === 0) {
    console.log("[migrate] No applied migrations to roll back.");
    return;
  }

  const { filename, applied_at } = result.rows[0];

  // Derive the rollback filename by inserting .down before .sql
  const downFilename = filename.replace(/\.sql$/, ".down.sql");
  const downFilePath = path.join(MIGRATIONS_DIR, downFilename);

  if (!fs.existsSync(downFilePath)) {
    console.error(
      `[migrate] ERROR: Rollback file "${downFilename}" does not exist.`,
    );
    console.error(
      `[migrate]        Create "${downFilename}" with the inverse SQL before running down.`,
    );
    process.exit(1);
  }

  const sql = fs.readFileSync(downFilePath, "utf-8");

  console.log(`[migrate] Rolling back: ${filename} (applied at ${applied_at})`);

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      `DELETE FROM ${TRACKING_TABLE} WHERE filename = $1`,
      [filename],
    );
    await client.query("COMMIT");
    console.log(`[migrate] ✓ Rolled back: ${filename}`);
  } catch (err) {
    await client.query("ROLLBACK");
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[migrate] ✗ Rollback failed for "${filename}", rolled back. Error: ${msg}`,
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Command: status
// Print each migration filename and whether it is applied or pending.
// ---------------------------------------------------------------------------
async function commandStatus(client: Client): Promise<void> {
  await ensureTrackingTable(client);

  const allFiles = getForwardMigrationFiles();
  const result = await client.query<{ filename: string; applied_at: string }>(
    `SELECT filename, applied_at FROM ${TRACKING_TABLE} ORDER BY applied_at ASC`,
  );

  // Build a map of applied migrations for O(1) lookup
  const appliedMap = new Map(result.rows.map((r) => [r.filename, r.applied_at]));

  // Union: files on disk + files in DB (catches orphaned DB entries)
  const allKnown = new Set([...allFiles, ...appliedMap.keys()]);
  const sorted = [...allKnown].sort();

  if (sorted.length === 0) {
    console.log(
      "[migrate] No migrations found. Add .sql files to infra/migrations/.",
    );
    return;
  }

  console.log("\n[migrate] Migration Status");
  console.log("─".repeat(72));
  console.log(
    `${"Filename".padEnd(50)} ${"Status".padEnd(10)} Applied At`,
  );
  console.log("─".repeat(72));

  for (const filename of sorted) {
    const appliedAt = appliedMap.get(filename);
    const status = appliedAt ? "applied " : "pending ";
    const timestamp = appliedAt ?? "—";
    const onDisk = allFiles.includes(filename);
    const orphanMark = !onDisk && appliedAt ? " ⚠ (file missing)" : "";
    console.log(
      `${filename.padEnd(50)} ${status.padEnd(10)} ${timestamp}${orphanMark}`,
    );
  }

  console.log("─".repeat(72));
  const pendingCount = sorted.filter((f) => !appliedMap.has(f)).length;
  const appliedCount = appliedMap.size;
  console.log(
    `\n  Applied: ${appliedCount}  |  Pending: ${pendingCount}  |  Total: ${sorted.length}\n`,
  );
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const command = process.argv[2] as "up" | "down" | "status" | undefined;

  if (!command || !["up", "down", "status"].includes(command)) {
    console.error(
      "[migrate] Usage: npx ts-node infra/scripts/migrate.ts <up|down|status>",
    );
    process.exit(1);
  }

  const client = await getClient();

  try {
    switch (command) {
      case "up":
        await commandUp(client);
        break;
      case "down":
        await commandDown(client);
        break;
      case "status":
        await commandStatus(client);
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[migrate] Fatal error: ${msg}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

void main();
