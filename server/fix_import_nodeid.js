const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fix() {
  const LAKHAN_MAJRA_NODE_ID = '55f17833-4cfc-4214-b208-2266af991a34';

  // Fix all records with null node_id that were recently imported
  const res = await pool.query(
    `UPDATE personnel 
     SET node_id = $1, updated_at = NOW()
     WHERE node_id IS NULL AND is_deleted = false
     RETURNING id, full_name`,
    [LAKHAN_MAJRA_NODE_ID]
  );

  console.log(`✅ Fixed ${res.rows.length} record(s):`);
  res.rows.forEach(r => console.log(' -', r.id, r.full_name));
  await pool.end();
}

fix().catch(e => { console.error('❌', e.message); pool.end(); });
