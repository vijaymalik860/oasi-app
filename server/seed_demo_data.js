require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seedDemoData() {
  const client = await pool.connect();
  console.log('\n🌱 Inserting Demo Data...\n');

  try {
    await client.query('BEGIN');

    // 1. Get Roles
    const { rows: roles } = await client.query('SELECT id, name FROM roles');
    const getRole = (name) => roles.find(r => r.name === name)?.id;
    
    if (!getRole('district_admin') || !getRole('unit_admin')) {
        throw new Error('Roles not found. Run migration first.');
    }

    // 2. Create Hierarchy Nodes
    // Level 1: State
    const sRes = await client.query(`
      INSERT INTO hierarchy_nodes (node_code, name, level) 
      VALUES ('DEMO-L1', '[DEMO] Haryana State', 1) 
      ON CONFLICT (node_code) DO UPDATE SET name = EXCLUDED.name RETURNING id`);
    const stateId = sRes.rows[0].id;

    // Level 2: Range
    const rRes = await client.query(`
      INSERT INTO hierarchy_nodes (node_code, name, level, parent_id) 
      VALUES ('DEMO-L1.1', '[DEMO] Rohtak Range', 2, $1) 
      ON CONFLICT (node_code) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [stateId]);
    const rangeId = rRes.rows[0].id;

    // Level 3: District
    const dRes = await client.query(`
      INSERT INTO hierarchy_nodes (node_code, name, level, parent_id) 
      VALUES ('DEMO-L1.1.1', '[DEMO] Rohtak District', 3, $1) 
      ON CONFLICT (node_code) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [rangeId]);
    const distId = dRes.rows[0].id;

    // Level 4: Unit (Police Station)
    const uRes = await client.query(`
      INSERT INTO hierarchy_nodes (node_code, name, level, parent_id) 
      VALUES ('DEMO-L1.1.1.1', '[DEMO] City Police Station', 4, $1) 
      ON CONFLICT (node_code) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [distId]);
    const unitId = uRes.rows[0].id;
    console.log('✅ Demo Hierarchy Created');

    // 3. Create Admin Users
    const passwordHash = await bcrypt.hash('Demo@1234', 10);
    
    await client.query(`
      INSERT INTO app_users (name, belt_number, password_hash, role_id, node_id, is_active)
      VALUES 
      ('Demo District Admin', 'DEMO-DA-01', $1, $2, $3, true),
      ('Demo Unit Admin', 'DEMO-UA-01', $1, $4, $5, true)
      ON CONFLICT (belt_number) DO NOTHING
    `, [passwordHash, getRole('district_admin'), distId, getRole('unit_admin'), unitId]);
    console.log('✅ Demo Admins Created');

    // 4. Create Dummy Personnel
    const personnelData = [
      { belt: 'DEMO-CT-01', name: 'Ramesh Kumar', rank: 'Constable' },
      { belt: 'DEMO-HC-01', name: 'Suresh Singh', rank: 'Head Constable' },
      { belt: 'DEMO-SI-01', name: 'Amit Sharma', rank: 'Sub Inspector' },
      { belt: 'DEMO-CT-02', name: 'Vikas Yadav', rank: 'Constable' }
    ];

    for (const p of personnelData) {
      await client.query(`
        INSERT INTO personnel (belt_number, full_name, mobile_number, rank, node_id, service_status)
        VALUES ($1, $2, '9999999999', $3, $4, 'Active')
      `, [p.belt, p.name, p.rank, unitId]);
    }
    console.log('✅ Demo Personnel Created');

    await client.query('COMMIT');
    console.log('\n🎉 Demo Data Successfully Inserted!');
    console.log('-------------------------------------------');
    console.log('Login as District Admin : DEMO-DA-01 / Demo@1234');
    console.log('Login as Unit Admin     : DEMO-UA-01 / Demo@1234');
    console.log('-------------------------------------------\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding demo data:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemoData();
