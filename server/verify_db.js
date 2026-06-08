require('dotenv').config();
const { pool } = require('./db');

async function verify() {
  console.log('\n========== DATABASE VERIFICATION ==========\n');

  // 1. Users
  const users = await pool.query(`
    SELECT u.belt_number, u.name, r.name AS role, u.is_active, h.name AS node
    FROM app_users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN hierarchy_nodes h ON h.id = u.node_id
    ORDER BY r.rank_level
  `);
  console.log(`👥 USERS (${users.rows.length} total):`);
  users.rows.forEach(u => {
    const status = u.is_active ? '✅' : '❌';
    console.log(`  ${status} ${u.belt_number.padEnd(10)} | ${u.role.padEnd(16)} | ${u.node || 'N/A'}`);
  });

  // 2. Personnel
  const pers = await pool.query('SELECT COUNT(*) AS c FROM personnel');
  const persCount = parseInt(pers.rows[0].c);
  console.log(`\n👮 PERSONNEL: ${persCount} records ${persCount === 0 ? '(Clean ✅)' : '⚠️'}`);

  // 3. Roles
  const roles = await pool.query('SELECT name, description FROM roles ORDER BY rank_level');
  console.log(`\n🔑 ROLES (${roles.rows.length}):`);
  roles.rows.forEach(r => console.log(`  - ${r.name}`));

  // 4. Hierarchy Nodes
  const hier = await pool.query('SELECT level, COUNT(*) AS c FROM hierarchy_nodes GROUP BY level ORDER BY level');
  console.log('\n🏛️  HIERARCHY NODES:');
  const levelLabel = { 1: 'State', 2: 'Range', 3: 'District', 4: 'Police Station' };
  hier.rows.forEach(h => console.log(`  Level ${h.level} (${levelLabel[h.level] || '?'}): ${h.c} nodes`));

  // 5. Other tables count
  const tables = ['attendance_register', 'chitthas', 'leaves'];
  console.log('\n📋 OTHER TABLES:');
  for (const t of tables) {
    const r = await pool.query(`SELECT COUNT(*) AS c FROM ${t}`);
    console.log(`  ${t}: ${r.rows[0].c} records`);
  }

  console.log('\n===========================================');
  console.log('✅ Verification complete!\n');
  await pool.end();
}

verify().catch(async e => {
  console.error('❌ Error:', e.message);
  await pool.end();
});
