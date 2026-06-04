const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const LAKHAN_MAJRA = '55f17833-4cfc-4214-b208-2266af991a34';

async function check() {
  const { rows } = await pool.query(`
    SELECT 
      full_name, pay_code, belt_number, rank,
      date_of_birth, date_of_enlistment,
      graduation_degree, subject_graduation, pg_degree,
      mobile_number, gender, religion, caste, service_type,
      village, police_station, home_district,
      node_id, created_at
    FROM personnel
    WHERE node_id = $1 AND is_deleted = false
    ORDER BY created_at DESC
    LIMIT 5
  `, [LAKHAN_MAJRA]);

  console.log(`\nRecords in LAKHAN MAJRA: ${rows.length}`);
  rows.forEach((r, i) => {
    console.log(`\n--- Record ${i+1} ---`);
    Object.entries(r).forEach(([k, v]) => {
      console.log(`  ${k}: ${v === null ? 'NULL ❌' : v === '' ? 'EMPTY ❌' : v + ' ✅'}`);
    });
  });
  await pool.end();
}
check().catch(e => { console.error(e.message); pool.end(); });
