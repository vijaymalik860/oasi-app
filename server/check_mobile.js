const { pool } = require('./db');
pool.query("SELECT * FROM personnel WHERE mobile_number = '6666666666'").then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
