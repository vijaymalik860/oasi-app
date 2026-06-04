const { pool } = require('./db');
async function findRamesh() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT u.name, h.name as unit_name, h.level
      FROM app_users u
      JOIN hierarchy_nodes h ON u.node_id = h.id
      WHERE u.name ILIKE '%Ramesh%'
    `);
    console.log(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
findRamesh();
