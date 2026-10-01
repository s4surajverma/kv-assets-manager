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
];

const isDev = (process.env.NODE_ENV || 'development') === 'development';
const connectionString = isDev
  ? process.env.DATABASE_URL_LOCAL
  : process.env.DATABASE_URL_PROD;

if (!connectionString) {
  console.error(`FATAL: ${isDev ? 'DATABASE_URL_LOCAL' : 'DATABASE_URL_PROD'} is not set in .env`);
  process.exit(1);
}

const clientConfig = { connectionString };
if (!isDev) {
  clientConfig.ssl = { rejectUnauthorized: false };
}

async function run() {
  const client = new Client(clientConfig);
  await client.connect();
  console.log(`[MIGRATE] Connected to ${isDev ? 'LOCAL' : 'PRODUCTION'} database`);
  console.log(`[MIGRATE] Running ${MIGRATIONS.length} migration files...\n`);

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
      console.log(`[MIGRATE] ✅ OK: ${file}`);
      passed++;
    } catch (err) {
      console.error(`[MIGRATE] ❌ FAILED: ${file} — ${err.message}`);
      await client.query('ROLLBACK').catch(() => {});
      // Continue on known idempotent errors (e.g. "already exists")
      if (!err.message.includes('already exists') && !err.message.includes('duplicate key')) {
        failed++;
        console.error(`[MIGRATE] Aborting due to non-idempotent failure.`);
        await client.end();
        process.exit(1);
      }
      console.log(`[MIGRATE] Continuing (object already exists)...`);
      passed++;
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
