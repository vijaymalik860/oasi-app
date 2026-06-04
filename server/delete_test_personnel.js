const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const LAKHAN_MAJRA = '55f17833-4cfc-4214-b208-2266af991a34';

async function run() {
  // List first
  const list = await pool.query(
    `SELECT id, full_name, pay_code FROM personnel WHERE node_id = $1 AND is_deleted = false`,
    [LAKHAN_MAJRA]
  );
  console.log(`Found ${list.rows.length} record(s):`);
  list.rows.forEach(r => console.log(' -', r.id, '|', r.full_name, '| pay_code:', r.pay_code));

  // Hard delete (permanent) since these are test records
  const del = await pool.query(
    `DELETE FROM personnel WHERE node_id = $1 AND is_deleted = false RETURNING id, full_name`,
    [LAKHAN_MAJRA]
  );
  console.log(`\n✅ Deleted ${del.rows.length} record(s):`);
  del.rows.forEach(r => console.log(' -', r.id, r.full_name));

  await pool.end();
}

run().catch(e => { console.error('❌', e.message); pool.end(); });
