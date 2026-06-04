const { pool } = require('./db');
async function fixCodes() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query("SELECT id, name, node_code FROM hierarchy_nodes WHERE level=2");
    for(const r of res.rows) {
      const correctCode = 'HR-R-' + r.name.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');
      await client.query("UPDATE hierarchy_nodes SET node_code = $1 WHERE id = $2", [correctCode, r.id]);
    }
    await client.query('COMMIT');
    console.log('Codes fixed!');
  } catch(e) {
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
fixCodes();
