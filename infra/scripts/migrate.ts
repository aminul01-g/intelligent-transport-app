import dotenv from "dotenv";
import { Client } from "pg";

// Load environment variables
dotenv.config();

async function executeMigrations(): Promise<void> {
  console.info("[Migration] Initializing database migration pipeline...");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(
      "[Migration] Failed: DATABASE_URL environment variable is missing.",
    );
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.info("[Migration] Database connection established successfully.");

    // TODO: Read migration files sequentially from /infra/migrations/ and execute queries
    console.info(
      "[Migration] TODO: Implement SQL script runner parsing for /infra/migrations/*.sql",
    );

    console.info("[Migration] Database migrations finished.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[Migration] Fatal exception occurred during migrations: ${message}`,
    );
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Invoke the migration logic
void executeMigrations();
