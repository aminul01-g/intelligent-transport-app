const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.waitReady;
  
  const migrationsDir = path.resolve(__dirname, '../migrations');
  const files = [
    '001_users_and_auth.sql',
    '002_companies_and_fleet.sql',
    '003_driver_operations.sql',
    '004_ticketing_and_fares.sql',
    '005_feedback_and_incidents.sql',
    '006_indexes.sql'
  ];

  console.log("=== Phase 1: Initial Migration ===");
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      await db.exec(sql);
      console.log(`✓ Applied ${file} successfully`);
    } catch (err) {
      console.error(`✗ Failed to apply ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log("\n=== Phase 2: Idempotency Check ===");
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      await db.exec(sql);
      console.log(`✓ Re-applied ${file} successfully (Idempotent)`);
    } catch (err) {
      console.error(`✗ Idempotency failed on ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log("\n=== Phase 3: Schema Introspection ===");
  
  // 1. Check Tables
  const tables = await db.query(`
    SELECT tablename 
    FROM pg_catalog.pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename;
  `);
  console.log("\nTables Found:", tables.rows.map(r => r.tablename).join(', '));

  // 2. Check Enums
  const enums = await db.query(`
    SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname;
  `);
  console.log("\nEnums Found:");
  enums.rows.forEach(e => console.log(`  - ${e.typname}: [${e.values.join(', ')}]`));

  // 3. Check Indexes
  const indexes = await db.query(`
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    ORDER BY indexname;
  `);
  console.log("\nIndexes Found:");
  indexes.rows.filter(r => !r.indexname.endsWith('_pkey') && !r.indexname.endsWith('_key')).forEach(i => console.log(`  - ${i.indexname}`));

  console.log("\n✓ All verification checks passed!");
  process.exit(0);
}

main().catch(console.error);
