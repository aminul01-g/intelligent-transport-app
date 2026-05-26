import dotenv from "dotenv";
import { Client } from "pg";

// Load environment variables
dotenv.config();

async function executeSeeding(): Promise<void> {
  console.info("[Seed] Initializing database seeding pipeline...");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(
      "[Seed] Failed: DATABASE_URL environment variable is missing.",
    );
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.info("[Seed] Database connection established successfully.");

    // TODO: Insert seed data for routes, static locations, initial vehicles, and test admin credentials
    console.info(
      "[Seed] TODO: Execute SQL queries to seed initial reference data.",
    );

    console.info("[Seed] Database seeding finished.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Seed] Fatal exception occurred during seeding: ${message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Invoke the seeding logic
void executeSeeding();
