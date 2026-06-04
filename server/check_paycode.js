const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  // Check existing constraints on personnel.pay_code
  const { rows } = await pool.query(`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'personnel'
    AND constraint_type IN ('UNIQUE', 'PRIMARY KEY')
  `);
  console.log('Constraints:', rows);

  // Check indexes
  const idx = await pool.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'personnel' AND indexdef ILIKE '%pay_code%'
  `);
  console.log('pay_code indexes:', idx.rows);
  await pool.end();
}
check().catch(e => { console.error(e.message); pool.end(); });
