const { pool } = require('./db');
async function fix() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT id FROM hierarchy_nodes WHERE level=4 LIMIT 1");
    if(res.rows.length > 0) {
      await client.query("UPDATE personnel SET node_id = $1 WHERE mobile_number = '6666666666'", [res.rows[0].id]);
      console.log('Fixed node_id for mobile 6666666666');
    }
  } catch(e) {
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
fix();
