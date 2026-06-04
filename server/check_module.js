const { pool } = require('./db');
pool.query("SELECT id, name, assigned_module FROM hierarchy_nodes WHERE level=4 LIMIT 5").then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
