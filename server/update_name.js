const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV 
  ? process.env.DATABASE_URL_LOCAL 
  : process.env.DATABASE_URL_PROD;

const pool = new Pool({ connectionString });

async function run() {
  await pool.query(`UPDATE "user" SET name='Super Administrator' WHERE id=1`);
  console.log('Updated');
  await pool.end();
}
run();
