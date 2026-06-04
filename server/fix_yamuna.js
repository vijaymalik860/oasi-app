const { pool } = require('./db');
async function fix() {
  const client = await pool.connect();
  try {
    const rRes = await client.query("SELECT id FROM hierarchy_nodes WHERE name='Ambala Range' AND level=2");
    if(rRes.rows.length > 0) {
      const rId = rRes.rows[0].id;
      const uRes = await client.query("UPDATE hierarchy_nodes SET parent_id=$1 WHERE name='YAMUNA NAGAR' AND level=3", [rId]);
      console.log('Fixed YAMUNA NAGAR: updated', uRes.rowCount, 'rows');
    }
  } catch(e) {
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
fix();
