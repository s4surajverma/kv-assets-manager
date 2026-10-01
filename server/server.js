const app = require('./app');
const { pool } = require('./config/db');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // Verify DB connection
    const client = await pool.connect();
    const { rows } = await client.query('SELECT NOW() AS time');
    const isDev = (process.env.NODE_ENV || 'development') === 'development';
    console.log(`[DB] Connected at ${rows[0].time}`);
    console.log(`[DB] Target: ${isDev ? 'LOCAL (development)' : 'NEON (production)'}`);
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
