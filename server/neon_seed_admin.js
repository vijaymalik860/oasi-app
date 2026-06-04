// ============================================================
// NEON SUPER ADMIN SEED SCRIPT
// Ek baar run karo — super admin user ban jayega
// Usage: node neon_seed_admin.js
// ============================================================

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function seedAdmin() {
  const client = await pool.connect();
  console.log('\n👮 OASI Admin User Setup...\n');

  try {
    // Get super_admin role id
    const roleRes = await client.query(
      `SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1`
    );

    if (roleRes.rows.length === 0) {
      throw new Error('super_admin role nahi mili! Pehle migration run karo.');
    }

    const roleId = roleRes.rows[0].id;

    // Hash password
    const password = 'Admin@1234';
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert super admin
    const result = await client.query(
      `INSERT INTO app_users (name, belt_number, password_hash, role_id, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (belt_number) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         is_active = true
       RETURNING id, name, belt_number`,
      ['Super Admin', 'ADMIN001', passwordHash, roleId]
    );

    const user = result.rows[0];

    console.log('✅ Super Admin user ban gaya!\n');
    console.log('┌─────────────────────────────────┐');
    console.log('│        LOGIN CREDENTIALS         │');
    console.log('├─────────────────────────────────┤');
    console.log(`│  Belt No : ADMIN001              │`);
    console.log(`│  Password: Admin@1234            │`);
    console.log('└─────────────────────────────────┘');
    console.log('\n⚠️  Login ke baad password zaroor badlo!\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdmin();
