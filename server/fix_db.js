require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const run = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // 1. Update the trigger function
    const filePath = path.join(__dirname, '../db/002_triggers.sql');
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // We only need to run the auto_audit_log function block, but we can just run the whole file again to replace it
    // Wait, running the whole file is safe because everything is CREATE OR REPLACE or DROP IF EXISTS...
    // Actually, CREATE TRIGGER might complain if they exist. Let's just execute the auto_audit_log function block.
    const funcSql = `
CREATE OR REPLACE FUNCTION auto_audit_log() RETURNS TRIGGER AS $$
DECLARE
  _changed_by INT;
  _rec jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _rec := to_jsonb(OLD);
    _changed_by := COALESCE( (_rec->>'created_by')::INT, (_rec->>'computed_by')::INT, (_rec->>'sanctioned_by')::INT, (_rec->>'verified_by')::INT, 0 );
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', _rec, _changed_by);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    _rec := to_jsonb(NEW);
    _changed_by := COALESCE( (_rec->>'created_by')::INT, (_rec->>'computed_by')::INT, (_rec->>'sanctioned_by')::INT, (_rec->>'verified_by')::INT, COALESCE((to_jsonb(OLD)->>'created_by')::INT, 0) );
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), _rec, _changed_by);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    _rec := to_jsonb(NEW);
    _changed_by := COALESCE( (_rec->>'created_by')::INT, (_rec->>'computed_by')::INT, (_rec->>'sanctioned_by')::INT, (_rec->>'verified_by')::INT, 0 );
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', _rec, _changed_by);
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
    `;
    await pool.query(funcSql);
    console.log('✅ Trigger function updated safely.');

    // 2. Insert the missing Financial Year
    await pool.query(`
      INSERT INTO financial_year (code, start_date, end_date) 
      VALUES ('2026-27', '2026-04-01', '2027-03-31') 
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Added FY 2026-27 to database.');

  } catch (error) {
    console.error('❌ Failed to fix DB:', error);
  } finally {
    await pool.end();
  }
};

run();
