// setup_demo_users.js
// 1. Super Admin ke alawa sab users delete karo
// 2. 4 demo accounts banao: state/range/district/unit admin
require('dotenv').config();
const { pool } = require('./db');
const bcrypt = require('bcryptjs');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('\n🔍 Existing hierarchy nodes dekh rahe hain...');
    const { rows: nodes } = await client.query(`
      SELECT id, node_code, name, level 
      FROM hierarchy_nodes 
      ORDER BY level, name 
      LIMIT 20
    `);
    
    console.log('Nodes found:');
    nodes.forEach(n => console.log(`  Level ${n.level}: ${n.name} (${n.node_code})`));

    // Level 1 = State/PHQ, 2 = Range, 3 = District, 4 = Unit
    const stateNode    = nodes.find(n => n.level === 1);
    const rangeNode    = nodes.find(n => n.level === 2);
    const districtNode = nodes.find(n => n.level === 3);
    const unitNode     = nodes.find(n => n.level === 4);

    console.log('\n📋 Selected nodes for demo accounts:');
    console.log('  State   :', stateNode?.name    || 'NOT FOUND');
    console.log('  Range   :', rangeNode?.name    || 'NOT FOUND');
    console.log('  District:', districtNode?.name || 'NOT FOUND');
    console.log('  Unit    :', unitNode?.name     || 'NOT FOUND');

    // ── STEP 1: Super Admin ke alawa sab delete karo ──
    console.log('\n🗑️  Super Admin ke alawa sab users delete kar rahe hain...');
    const { rows: superAdmin } = await client.query(`
      SELECT u.id FROM app_users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'super_admin'
      LIMIT 1
    `);
    
    if (superAdmin.length === 0) {
      throw new Error('Super Admin nahi mila! Pehle seed data run karo.');
    }

    // Pehle FK references NULL karo (other tables mein jo user IDs hain)
    const nullifyQueries = [
      `UPDATE grievances    SET created_by_user_id = NULL WHERE created_by_user_id != $1`,
      `UPDATE grievances    SET assigned_to_user_id = NULL WHERE assigned_to_user_id != $1`,
      `UPDATE leaves        SET approved_by_user_id = NULL WHERE approved_by_user_id != $1`,
      `UPDATE personnel     SET created_by_user_id = NULL WHERE created_by_user_id != $1`,
      `UPDATE personnel     SET updated_by_user_id = NULL WHERE updated_by_user_id != $1`,
      `UPDATE chitthas      SET created_by_user_id = NULL WHERE created_by_user_id != $1`,
      `UPDATE attendance_register SET marked_by_user_id = NULL WHERE marked_by_user_id != $1`,
      `UPDATE fir_reports   SET created_by_user_id = NULL WHERE created_by_user_id != $1`,
      `UPDATE transfers     SET created_by_user_id = NULL WHERE created_by_user_id != $1`,
    ];
    for (const q of nullifyQueries) {
      await client.query(q, [superAdmin[0].id]).catch(() => {}); // Table exist na kare to skip
    }

    const { rowCount } = await client.query(`
      DELETE FROM app_users WHERE id != $1
    `, [superAdmin[0].id]);
    console.log(`  ✓ ${rowCount} users deleted.`);

    // ── STEP 2: Roles fetch karo ──
    const { rows: roles } = await client.query(`SELECT id, name FROM roles`);
    const roleMap = {};
    roles.forEach(r => { roleMap[r.name] = r.id; });

    // Password hash (sab ka same: Admin@1234)
    const hash = await bcrypt.hash('Admin@1234', 10);

    // Level 4 (unit) node dhundho
    const { rows: unitNodes } = await client.query(
      `SELECT id, name FROM hierarchy_nodes WHERE level = 4 LIMIT 1`
    );
    const unitNode4 = unitNodes[0] || null;
    if (unitNode4) console.log(`  Unit (L4): ${unitNode4.name}`);
    else console.log('  Unit (L4): NOT FOUND — district node use hoga');

    // ── STEP 4: 4 demo accounts banao ──
    const demoUsers = [
      {
        name:        'State Admin (PHQ)',
        belt_number: 'STATE001',
        role_name:   'state_admin',
        node_id:     stateNode?.id || null,
      },
      {
        name:        'Range Admin (OASI)',
        belt_number: 'RANGE001',
        role_name:   'range_admin',
        node_id:     rangeNode?.id || districtNode?.id || stateNode?.id || null,
      },
      {
        name:        'District Admin (OASI)',
        belt_number: 'DIST001',
        role_name:   'district_admin',
        node_id:     districtNode?.id || null,
      },
      {
        name:        'Unit Admin (MHC)',
        belt_number: 'UNIT001',
        role_name:   'unit_admin',
        node_id:     unitNode4?.id || districtNode?.id || null,
      },
    ];

    console.log('\n👥 Demo accounts bana rahe hain...');
    for (const u of demoUsers) {
      const roleId = roleMap[u.role_name];
      if (!roleId) {
        console.log(`  ⚠️  Role '${u.role_name}' nahi mila, skip.`);
        continue;
      }

      await client.query(`
        INSERT INTO app_users (name, belt_number, password_hash, role_id, node_id, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (belt_number) DO UPDATE SET
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role_id = EXCLUDED.role_id,
          node_id = EXCLUDED.node_id,
          is_active = true
      `, [u.name, u.belt_number, hash, roleId, u.node_id]);

      console.log(`  ✓ ${u.belt_number} → ${u.name} (${u.role_name})`);
    }

    await client.query('COMMIT');

    // ── FINAL: Current users list dikhao ──
    const { rows: finalUsers } = await client.query(`
      SELECT u.belt_number, u.name, r.name AS role, u.is_active,
             h.name AS node_name, h.level AS node_level
      FROM app_users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN hierarchy_nodes h ON h.id = u.node_id
      ORDER BY r.rank_level
    `);

    console.log('\n✅ Final User List:');
    console.log('━'.repeat(70));
    console.log('Belt No.    │ Name                    │ Role            │ Node');
    console.log('━'.repeat(70));
    finalUsers.forEach(u => {
      console.log(
        `${u.belt_number.padEnd(11)} │ ${u.name.padEnd(23)} │ ${u.role.padEnd(15)} │ ${u.node_name || 'N/A'}`
      );
    });
    console.log('━'.repeat(70));
    console.log('\n🔑 Sab accounts ka password: Admin@1234');
    console.log('');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
