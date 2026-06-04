const { pool } = require('./db');
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='attendance_register'").then(res => {
  console.log(res.rows);
  process.exit(0);
});
