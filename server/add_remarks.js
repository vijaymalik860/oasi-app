const { pool } = require('./db');
async function addRemarks() {
  const client = await pool.connect();
  try {
    await client.query("ALTER TABLE attendance_register ADD COLUMN IF NOT EXISTS remarks TEXT");
    console.log("Success: Added remarks column.");
  } catch(e) {
    console.error("Error:", e.message);
  } finally {
    client.release();
    process.exit(0);
  }
}
addRemarks();
