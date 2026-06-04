const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const LAKHAN_MAJRA = '55f17833-4cfc-4214-b208-2266af991a34';

async function diagnose() {
  // 1. Records with null node_id (broken imports)
  const nullNodes = await pool.query(
    `SELECT id, full_name, pay_code, node_id, created_at 
     FROM personnel WHERE is_deleted = false AND node_id IS NULL
     ORDER BY created_at DESC LIMIT 20`
  );
  console.log(`\n[1] Records with NULL node_id: ${nullNodes.rows.length}`);
  nullNodes.rows.forEach(r => console.log('  -', r.full_name, '| pay_code:', r.pay_code, '| created:', r.created_at));

  // 2. Recent records in LAKHAN MAJRA
  const recent = await pool.query(
    `SELECT id, full_name, pay_code, node_id, created_at 
     FROM personnel WHERE is_deleted = false AND node_id = $1
     ORDER BY created_at DESC LIMIT 10`,
    [LAKHAN_MAJRA]
  );
  console.log(`\n[2] LAKHAN MAJRA records: ${recent.rows.length}`);
  recent.rows.forEach(r => console.log('  -', r.full_name, '| pay_code:', r.pay_code));

  // 3. Total all active personnel
  const total = await pool.query(`SELECT COUNT(*) FROM personnel WHERE is_deleted = false`);
  console.log(`\n[3] Total active personnel in DB: ${total.rows[0].count}`);

  await pool.end();
}

diagnose().catch(e => { console.error('❌', e.message); pool.end(); });
