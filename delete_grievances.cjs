const { pool } = require('./server/db');

async function deleteGrievances() {
  try {
    await pool.query('DELETE FROM grievances');
    console.log('All grievances deleted successfully.');
  } catch (error) {
    console.error('Failed to delete grievances:', error);
  } finally {
    process.exit(0);
  }
}

deleteGrievances();
