/**
 * Sequential Migration Runner
 * Runs all SQL migration files in the correct order against the
 * currently configured database (local or production based on NODE_ENV).
 *
 * Migration numbering is strictly chronological:
 *   001 — Core schema (tables, constraints, indexes)
 *   002 — Triggers & functions
 *   003 — Donation in kind columns
 *   004 — User soft delete + role simplification
 *   005 — Operational departments
 *   006 — Classification workflow + employee codes
 *   007 — Multi-tenant architecture (vidyalaya)
 *   008 — Condemnation depreciation method columns
 *   009 — Department-based multi-asset condemnation master
 *   010 — Stock charge transfer / handing over
 *   011 — Fresh seed data (local development only)
 *   012 — Depreciation / Condemnation / Schedule 4 integration
 *   013 — Non-consumable custody management
 */
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Strictly ordered migration list — DO NOT reorder
const MIGRATIONS = [
  '001_schema.sql',
  '002_triggers.sql',
  '003_donation_in_kind.sql',
  '004_user_delete_roles.sql',
  'migrations/001_operational_department.sql',
  'migrations/002_classification_and_empcode.sql',
  '005_multitenant.sql',
  'migrations/006_condemnation_depr_method.sql',
  'migrations/007_condemnation_master.sql',
  'migrations/008_stock_transition.sql',
  'migrations/009_seed.sql',
  'migrations/010_depreciation_integration.sql',
  'migrations/011_non_consumable_movement.sql',
  'migrations/012_opening_balance.sql',
  'migrations/013_default_depreciation_rules.sql',
];

const isDev = (process.env.NODE_ENV || 'development') === 'development';
const connectionString = isDev
  ? (process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL)
  : (process.env.DATABASE_URL_PROD || process.env.DATABASE_URL);

if (!connectionString) {
  console.error(`FATAL: DATABASE_URL_PROD or DATABASE_URL is not set in environment`);
  process.exit(1);
}

const clientConfig = { connectionString };
if (!isDev || (connectionString && (connectionString.includes('neon.tech') || connectionString.includes('supabase.co') || connectionString.includes('supabase.com') || connectionString.includes('sslmode=require')))) {
  clientConfig.ssl = { rejectUnauthorized: false };
}

async function run() {
  const client = new Client(clientConfig);
  await client.connect();
  console.log(`[MIGRATE] Connected to ${isDev ? 'LOCAL' : 'PRODUCTION'} database`);

  // Ensure migration tracking table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows: appliedRows } = await client.query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(appliedRows.map((r) => r.filename));

  console.log(`[MIGRATE] Running ${MIGRATIONS.length} migration files (${appliedSet.size} already recorded)...\n`);

  const dbDir = path.join(__dirname, '../db');
  let passed = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of MIGRATIONS) {
    // Skip seed data on production
    if (!isDev && file.includes('seed')) {
      console.log(`[MIGRATE] SKIP (production): ${file}`);
      skipped++;
      continue;
    }

    if (appliedSet.has(file)) {
      console.log(`[MIGRATE] ⏭️ SKIP (already applied): ${file}`);
      skipped++;
      continue;
    }

    const filePath = path.join(dbDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`[MIGRATE] SKIP (not found): ${file}`);
      skipped++;
      continue;
    }

    console.log(`[MIGRATE] Running: ${file} ...`);
    const sql = fs.readFileSync(filePath, 'utf-8');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', [file]);
      console.log(`[MIGRATE] ✅ OK: ${file}`);
      passed++;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      // Gracefully record if objects were already created in an earlier deployment
      if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
        console.log(`[MIGRATE] ℹ️ Recorded existing migration: ${file} (objects already exist)`);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', [file]);
        passed++;
      } else {
        console.error(`[MIGRATE] ❌ FAILED: ${file} — ${err.message}`);
        failed++;
        console.error(`[MIGRATE] Aborting due to migration failure.`);
        await client.end();
        process.exit(1);
      }
    }
  }

  console.log(`\n[MIGRATE] ════════════════════════════════════════`);
  console.log(`[MIGRATE] Migration complete: ${passed} passed, ${skipped} skipped, ${failed} failed`);
  console.log(`[MIGRATE] ════════════════════════════════════════`);
  await client.end();
}

run().catch((err) => {
  console.error('[MIGRATE] Fatal error:', err.message);
  process.exit(1);
});
