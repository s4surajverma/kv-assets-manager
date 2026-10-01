const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV 
  ? process.env.DATABASE_URL_LOCAL 
  : process.env.DATABASE_URL_PROD;

const pool = new Pool({
  connectionString
});

async function updateSuperadmin() {
  try {
    const hash = await bcrypt.hash('Suraj@191193', 12);
    
    const res = await pool.query(
      `UPDATE "user" 
       SET employee_code = $1, password_hash = $2 
       WHERE id = 1 
       RETURNING id, name, email, employee_code`,
      ['EP.80389', hash]
    );

    if (res.rows.length > 0) {
      console.log('Successfully updated SuperAdmin credentials:', res.rows[0]);
    } else {
      console.log('SuperAdmin user (id=1) not found!');
    }
  } catch (err) {
    console.error('Error updating SuperAdmin:', err);
  } finally {
    await pool.end();
  }
}

updateSuperadmin();
