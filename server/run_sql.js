require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const run = async () => {
  console.log('Connecting to Neon Database...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  
  try {
    const files = [
      '../db/001_schema.sql',
      '../db/002_triggers.sql',
      '../db/003_seed.sql'
    ];

    for (const file of files) {
      console.log(`\nExecuting ${file}...`);
      const filePath = path.join(__dirname, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
      console.log(`✅ Successfully executed ${path.basename(file)}`);
    }

    console.log('\n🎉 All SQL files executed successfully!');
  } catch (error) {
    console.error('\n❌ Error executing SQL:', error);
  } finally {
    client.release();
    await pool.end();
  }
};

run();
