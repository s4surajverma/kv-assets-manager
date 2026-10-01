/**
 * Migration: Remap Legacy KV (id=1) to KV 2242 and remove SuperAdmin DB user.
 */
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
  ? process.env.DATABASE_URL_LOCAL
  : process.env.DATABASE_URL_PROD;

const pool = new Pool({ connectionString });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Remove the old SuperAdmin user (EP.80389) from vidyalaya_id=1
    const { rows: superadminUsers } = await client.query(
      `SELECT id, employee_code FROM "user" WHERE employee_code = 'EP.80389'`
    );
    console.log('SuperAdmin users to remove:', superadminUsers);
    for (const sa of superadminUsers) {
      await client.query(`DELETE FROM user_role WHERE user_id = $1`, [sa.id]);
      await client.query(`DELETE FROM "user" WHERE id = $1`, [sa.id]);
      console.log(`  Deleted user id=${sa.id} (${sa.employee_code})`);
    }

    // 2. Move all users from vidyalaya_id=2 to vidyalaya_id=1
    const moveResult = await client.query(
      `UPDATE "user" SET vidyalaya_id = 1 WHERE vidyalaya_id = 2`
    );
    console.log(`Moved ${moveResult.rowCount} user(s) from vid=2 to vid=1`);

    // 3. Disable triggers, delete vid=2 FIRST (to free kv_code='2242'), then update vid=1
    await client.query(`ALTER TABLE vidyalaya DISABLE TRIGGER ALL`);

    await client.query(`DELETE FROM vidyalaya WHERE id = 2`);
    console.log('Deleted duplicate vidyalaya id=2');

    await client.query(
      `UPDATE vidyalaya SET kv_code = '2242', 
       kv_name_en = 'KV Aurangabad', kv_name_hi = 'केन्द्रीय विद्यालय औरंगाबाद', 
       regional_office_en = 'Patna', regional_office_hi = 'पटना', 
       is_system = false WHERE id = 1`
    );
    console.log('Updated vidyalaya id=1 to KV Aurangabad (2242)');

    await client.query(`ALTER TABLE vidyalaya ENABLE TRIGGER ALL`);

    await client.query('COMMIT');
    console.log('\n✅ Migration complete! Legacy KV is now KV 2242 (Aurangabad).');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
