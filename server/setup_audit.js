require('dotenv').config();
const { pool } = require('./db');

async function setup() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id         UUID REFERENCES app_users(id) ON DELETE SET NULL,
          action          TEXT NOT NULL,
          entity_type     TEXT NOT NULL,
          entity_id       UUID,
          old_data        JSONB,
          new_data        JSONB,
          ip_address      TEXT,
          created_at      TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `);
    console.log('✅ Audit logs table created successfully');
  } catch (e) {
    console.error('❌ Error creating audit logs table:', e);
  } finally {
    pool.end();
  }
}
setup();
