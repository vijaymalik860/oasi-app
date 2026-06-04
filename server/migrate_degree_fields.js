// Migration: Add graduation_degree and pg_degree columns to personnel table
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE personnel
        ADD COLUMN IF NOT EXISTS graduation_degree TEXT,
        ADD COLUMN IF NOT EXISTS pg_degree TEXT
    `);
    console.log('✅ Columns graduation_degree and pg_degree added successfully.');

    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'personnel'
      AND column_name IN ('graduation_degree','pg_degree','subject_graduation','subject_post_graduation')
      ORDER BY column_name
    `);
    console.log('✅ Verified columns in DB:', rows.map(r => r.column_name).join(', '));
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
