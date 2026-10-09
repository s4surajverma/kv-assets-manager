const app = require('./app');
const { pool } = require('./config/db');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // Verify DB connection
    const client = await pool.connect();
    const { rows } = await client.query('SELECT NOW() AS time');
    const isDev = (process.env.NODE_ENV || 'development') === 'development';
    const connStr = isDev
      ? (process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL)
      : (process.env.DATABASE_URL_PROD || process.env.DATABASE_URL);
    let target = isDev ? 'LOCAL (development)' : 'PRODUCTION';
    if (connStr) {
      if (connStr.includes('supabase.co') || connStr.includes('supabase.com')) target = `SUPABASE (${isDev ? 'development' : 'production'})`;
      else if (connStr.includes('neon.tech')) target = `NEON (${isDev ? 'development' : 'production'})`;
    }
    console.log(`[DB] Connected at ${rows[0].time}`);
    console.log(`[DB] Target: ${target}`);
    client.release();

    app.listen(PORT, () => {
      console.log(`[SERVER] Running on http://localhost:${PORT}`);
      console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[API] Base URL: http://localhost:${PORT}/api/v1`);
    });
  } catch (err) {
    console.error('[FATAL] Failed to start:', err.message);
    process.exit(1);
  }
}

start();
