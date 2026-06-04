require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    // Total counts by level
    const total = await client.query('SELECT level, COUNT(*) as count FROM hierarchy_nodes GROUP BY level ORDER BY level');
    console.log('\n=== NODE COUNT BY LEVEL ===');
    const labels = { 1: 'State', 2: 'Range/Comm', 3: 'District', 4: 'Police Station' };
    total.rows.forEach(r => {
      console.log('Level ' + r.level + ' (' + (labels[r.level] || 'Other') + '): ' + r.count + ' nodes');
    });

    // All districts
    const districts = await client.query('SELECT name FROM hierarchy_nodes WHERE level=3 ORDER BY name');
    console.log('\n=== DISTRICTS (' + districts.rowCount + ' total) ===');
    districts.rows.forEach((r, i) => console.log('  ' + (i+1) + '. ' + r.name));

    // PS count per district
    const psCounts = await client.query(`
      SELECT d.name as district, COUNT(ps.id) as ps_count
      FROM hierarchy_nodes d
      LEFT JOIN hierarchy_nodes ps ON ps.parent_id = d.id AND ps.level = 4
      WHERE d.level = 3
      GROUP BY d.name ORDER BY d.name
    `);
    console.log('\n=== PS COUNT PER DISTRICT ===');
    let totalPS = 0;
    psCounts.rows.forEach(r => {
      console.log('  ' + r.district + ': ' + r.ps_count + ' PS');
      totalPS += parseInt(r.ps_count);
    });
    console.log('\nTOTAL PS: ' + totalPS);

  } finally {
    client.release();
    pool.end();
  }
}
check().catch(e => { console.error('Error:', e.message); process.exit(1); });
