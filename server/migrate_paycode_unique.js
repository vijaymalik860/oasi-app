const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  try {
    // Check for duplicate pay_codes first
    const dups = await pool.query(`
      SELECT pay_code, COUNT(*) as cnt
      FROM personnel
      WHERE pay_code IS NOT NULL AND pay_code != '' AND is_deleted = false
      GROUP BY pay_code
      HAVING COUNT(*) > 1
    `);

    if (dups.rows.length > 0) {
      console.log('⚠️  Duplicate pay_codes found (must fix before adding constraint):');
      dups.rows.forEach(r => console.log(`  pay_code="${r.pay_code}" appears ${r.cnt} times`));
      console.log('\nRun this to see duplicates:');
      console.log(`SELECT id, full_name, pay_code FROM personnel WHERE pay_code IN (${dups.rows.map(r => `'${r.pay_code}'`).join(',')}) AND is_deleted=false;`);
      await pool.end();
      return;
    }

    console.log('✅ No duplicates found. Adding unique constraint...');

    // Add unique constraint (partial — only for non-deleted, non-empty pay_codes)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_pay_code_unique
      ON personnel (pay_code)
      WHERE pay_code IS NOT NULL AND pay_code != '' AND is_deleted = false
    `);

    console.log('✅ Unique index on pay_code created successfully.');
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
  }
}

migrate();
