const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE personnel
        ADD COLUMN IF NOT EXISTS subject_graduation TEXT,
        ADD COLUMN IF NOT EXISTS subject_post_graduation TEXT
    `);
    console.log('✅ subject_graduation and subject_post_graduation columns added.');

    // Verify
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'personnel'
      AND column_name IN ('graduation_degree', 'subject_graduation', 'pg_degree', 'subject_post_graduation')
      ORDER BY column_name
    `);
    console.log('✅ Verified:', rows.map(r => r.column_name).join(', '));
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
  }
}
migrate();
