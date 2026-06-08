require('dotenv').config();
const { pool } = require('./db');
const bcrypt = require('bcryptjs');

async function run() {
  try {
    // Ambala ke level 4 (Police Station) nodes dhundho
    const { rows: ambalaPS } = await pool.query(`
      SELECT h.id, h.name, h.level, p.name AS parent_name
      FROM hierarchy_nodes h
      JOIN hierarchy_nodes p ON p.id = h.parent_id
      WHERE h.level = 4 AND p.name ILIKE '%ambala%'
      ORDER BY h.name
      LIMIT 10
    `);

    console.log('\n🔍 Ambala ke Police Stations (Level 4):');
    ambalaPS.forEach(n => console.log(`  ${n.id} — ${n.name} (under: ${n.parent_name})`));

    if (ambalaPS.length === 0) {
      // Agar koi PS nahi mila to Ambala district node use karo
      console.log('\n⚠️  Koi PS nahi mila. Ambala district node dhundh rahe hain...');
      const { rows: ambalaDist } = await pool.query(`
        SELECT id, name FROM hierarchy_nodes 
        WHERE level = 3 AND name ILIKE '%ambala%' LIMIT 1
      `);
      if (ambalaDist.length === 0) {
        console.log('❌ Ambala ka koi node nahi mila!');
        return;
      }
      console.log(`  Using district node: ${ambalaDist[0].name} (${ambalaDist[0].id})`);

      // Unit admin banao district node se
      await createUnitAdmin(ambalaDist[0].id, 'Ambala District (UNIT)');
    } else {
      // Pehla PS use karo
      const node = ambalaPS[0];
      console.log(`\n✅ Using: ${node.name}`);
      await createUnitAdmin(node.id, node.name);
    }

    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
  }
}

async function createUnitAdmin(nodeId, nodeName) {
  const hash = await bcrypt.hash('Admin@1234', 10);
  const { rows: roleRows } = await pool.query(`SELECT id FROM roles WHERE name='unit_admin'`);
  
  await pool.query(`
    INSERT INTO app_users (name, belt_number, password_hash, role_id, node_id, is_active)
    VALUES ($1, $2, $3, $4, $5, true)
    ON CONFLICT (belt_number) DO UPDATE SET
      name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
      role_id = EXCLUDED.role_id, node_id = EXCLUDED.node_id, is_active = true
  `, ['Unit Admin (Ambala)', 'UNIT002', hash, roleRows[0].id, nodeId]);

  console.log(`\n✅ User created:`);
  console.log(`   Belt    : UNIT002`);
  console.log(`   Name    : Unit Admin (Ambala)`);
  console.log(`   Role    : unit_admin`);
  console.log(`   Node    : ${nodeName}`);
  console.log(`   Password: Admin@1234`);
}

run();
