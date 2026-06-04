require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function safeDelete(client, query, params = []) {
  try {
    await client.query('SAVEPOINT sp1');
    const res = await client.query(query, params);
    await client.query('RELEASE SAVEPOINT sp1');
    return res.rowCount;
  } catch (e) {
    await client.query('ROLLBACK TO SAVEPOINT sp1');
    return 0;
  }
}

async function cleanupDemoData() {
  const client = await pool.connect();
  console.log('\n🧹 Cleaning up ALL Demo Data...\n');

  try {
    await client.query('BEGIN');

    // Step 0: Get IDs of DEMO app_users and personnel
    const demoUserRes = await client.query(
      `SELECT id FROM app_users WHERE belt_number LIKE 'DEMO-%'`
    );
    const demoUserIds = demoUserRes.rows.map(r => r.id);
    console.log(`Found ${demoUserIds.length} demo user(s).`);

    const demoPersonnelRes = await client.query(
      `SELECT id FROM personnel WHERE belt_number LIKE 'DEMO-%'`
    );
    const demoPersonnelIds = demoPersonnelRes.rows.map(r => r.id);
    console.log(`Found ${demoPersonnelIds.length} demo personnel.`);

    const demoNodeRes = await client.query(
      `SELECT id FROM hierarchy_nodes WHERE node_code LIKE 'DEMO-%'`
    );
    console.log(`Found ${demoNodeRes.rowCount} demo hierarchy nodes.`);

    // --- Delete all linked data for DEMO users ---
    if (demoUserIds.length > 0) {
      const idList = demoUserIds;

      let n = await safeDelete(client,
        `DELETE FROM chitthas WHERE created_by_user_id = ANY($1::uuid[])`, [idList]);
      console.log(`  Chitthas (by demo user): ${n} deleted`);

      n = await safeDelete(client,
        `DELETE FROM leaves WHERE approved_by_user_id = ANY($1::uuid[])`, [idList]);
      console.log(`  Leaves (approved by demo user): ${n} deleted`);

      n = await safeDelete(client,
        `DELETE FROM transfers WHERE approved_by_user_id = ANY($1::uuid[])`, [idList]);
      console.log(`  Transfers (approved by demo user): ${n} deleted`);
    }

    // --- Delete all linked data for DEMO personnel ---
    if (demoPersonnelIds.length > 0) {
      const pList = demoPersonnelIds;

      let n = await safeDelete(client,
        `DELETE FROM attendance WHERE personnel_id = ANY($1::uuid[])`, [pList]);
      console.log(`  Attendance (demo personnel): ${n} deleted`);

      n = await safeDelete(client,
        `DELETE FROM leaves WHERE personnel_id = ANY($1::uuid[])`, [pList]);
      console.log(`  Leaves (demo personnel): ${n} deleted`);

      n = await safeDelete(client,
        `DELETE FROM transfers WHERE personnel_id = ANY($1::uuid[])`, [pList]);
      console.log(`  Transfers (demo personnel): ${n} deleted`);

      n = await safeDelete(client,
        `DELETE FROM chitthas WHERE personnel_id = ANY($1::uuid[])`, [pList]);
      console.log(`  Chitthas (demo personnel): ${n} deleted`);
    }

    // --- Now delete demo personnel ---
    const r3 = await client.query(`DELETE FROM personnel WHERE belt_number LIKE 'DEMO-%'`);
    console.log(`\n✅ Deleted ${r3.rowCount} demo personnel.`);

    // --- Now delete demo app users ---
    const r4 = await client.query(`DELETE FROM app_users WHERE belt_number LIKE 'DEMO-%'`);
    console.log(`✅ Deleted ${r4.rowCount} demo app user(s).`);

    // --- Delete DEMO hierarchy nodes bottom-up (by level descending) ---
    // Level 4 -> Level 3 -> Level 2 -> Level 1
    for (const level of [4, 3, 2, 1]) {
      const rN = await client.query(
        `DELETE FROM hierarchy_nodes WHERE node_code LIKE 'DEMO-%' AND level = $1`,
        [level]
      );
      if (rN.rowCount > 0) {
        console.log(`✅ Deleted ${rN.rowCount} demo hierarchy node(s) at level ${level}.`);
      }
    }

    await client.query('COMMIT');
    console.log('\n🎉 All Demo Data Deleted Successfully!\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    console.error('   Detail:', err.detail || '');
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupDemoData();
