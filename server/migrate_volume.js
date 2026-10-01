require('dotenv').config();
const db = require('./config/db');

async function migrate() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Add stock_volume_no to stock_ledger as an integer
    await client.query(`
      ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS stock_volume_no INT
    `);

    // Create an index for faster lookups if needed later
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_volume ON stock_ledger(stock_volume_no)
    `);

    await client.query('COMMIT');
    console.log('Migration complete: Added stock_volume_no INT to stock_ledger');
    process.exit(0);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
