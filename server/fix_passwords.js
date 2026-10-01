require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const run = async () => {
  const hash = bcrypt.hashSync('test1234', 12);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pool.query('UPDATE "user" SET password_hash = $1', [hash]);
    console.log('Passwords successfully updated to "test1234".');
  } catch (error) {
    console.error('Failed to update passwords:', error);
  } finally {
    await pool.end();
  }
};

run();
