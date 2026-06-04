const { pool } = require('./db');
(async () => {
  try {
    const res = await pool.query(
      "SELECT 1",
      []
    );
    console.log("Success");
  } catch (e) { console.error(e); }
  process.exit(0);
})();
