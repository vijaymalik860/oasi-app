require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function addColumn() {
  const client = await pool.connect();
  try {
    await client.query('ALTER TABLE personnel ADD COLUMN IF NOT EXISTS home_district_ps TEXT;');
    console.log('✅ Column home_district_ps added successfully.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addColumn();
