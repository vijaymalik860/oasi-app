const { pool } = require('./db');
async function test() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stateId = 'a6569c22-43fc-45bc-93e2-8edea382c1c0'; // Random UUID from previous output
    const rRes = await client.query(
        `INSERT INTO hierarchy_nodes (node_code, name, level, parent_id, is_fixed, assigned_module)
         VALUES ($1, $2, 2, $3, false, 'attendance')
         ON CONFLICT (node_code) DO UPDATE SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id
         RETURNING id`,
        ['HR-R-TEST', 'Test Range', stateId]
    );
    console.log("Range Insert:", rRes.rows);
    await client.query('ROLLBACK');
  } catch(e) {
    console.error("ERROR:", e.message);
  } finally {
    client.release();
    process.exit(0);
  }
}
test();
