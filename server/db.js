// db.js — PostgreSQL Connection Pool
// DATABASE_URL (cloud/Neon) ya individual DB_* variables dono support karta hai
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

// ── Connection Config ──
// Option A: Full DATABASE_URL (Neon / Cloud PostgreSQL)
// Option B: Individual variables (Govt server local PostgreSQL)
const poolConfig = process.env.DATABASE_URL
  ? {
      // Option A — Cloud DB (SSL required for Neon)
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: false },
    }
  : {
      // Option B — Local PostgreSQL (Govt server)
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'oasi_db',
      user:     process.env.DB_USER     || 'oasi_user',
      password: process.env.DB_PASSWORD || '',
      ssl: false,
    };

const pool = new Pool({
  ...poolConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') console.log('[DB] New client connected');
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message);
});

// Connection test on startup
pool.query('SELECT NOW()')
  .then(() => console.log('[DB] ✅ PostgreSQL connected successfully'))
  .catch(err => console.error('[DB] ❌ Connection failed:', err.message));

module.exports = { pool };
