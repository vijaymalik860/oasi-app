// ============================================================
// NEON DATABASE MIGRATION SCRIPT
// Ek baar run karo — saari tables Neon pe ban jayengi
// Usage: node neon_migrate.js
// ============================================================

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const MIGRATION_SQL = `

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. HIERARCHY NODES (Foundation)
-- ============================================================
CREATE TABLE IF NOT EXISTS hierarchy_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    level INTEGER NOT NULL,
    parent_id UUID REFERENCES hierarchy_nodes(id) ON DELETE CASCADE,
    is_fixed BOOLEAN DEFAULT FALSE,
    assigned_module TEXT DEFAULT 'attendance',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hierarchy_parent ON hierarchy_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_code ON hierarchy_nodes(node_code);
CREATE INDEX IF NOT EXISTS idx_hierarchy_level ON hierarchy_nodes(level);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_hierarchy_nodes_modtime ON hierarchy_nodes;
CREATE TRIGGER update_hierarchy_nodes_modtime
    BEFORE UPDATE ON hierarchy_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. UNIT CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS unit_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE hierarchy_nodes ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES unit_categories(id) ON DELETE SET NULL;

-- ============================================================
-- 3. ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    rank_level INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO roles (name, description, rank_level) VALUES
    ('super_admin', 'Full system access across all levels', 1),
    ('state_admin', 'State/PHQ level administration', 2),
    ('range_admin', 'Range level administration', 3),
    ('district_admin', 'District level management', 4),
    ('unit_admin', 'Unit level management', 5),
    ('staff', 'View-only access to own records', 6)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 4. APP USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE,
    name TEXT NOT NULL,
    belt_number TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    node_id UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    personnel_id UUID,
    mobile_number TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_belt_number ON app_users(belt_number);
CREATE INDEX IF NOT EXISTS idx_app_users_node_id ON app_users(node_id);

-- ============================================================
-- 5. MASTER FIELD TYPES (Dropdown)
-- ============================================================
CREATE TABLE IF NOT EXISTS master_field_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL REFERENCES hierarchy_nodes(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    personnel_field_name TEXT,
    helper_example TEXT DEFAULT 'Value1, Value2, Value3',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(node_id, field_name)
);

-- ============================================================
-- 6. MASTER DROPDOWN VALUES
-- ============================================================
CREATE TABLE IF NOT EXISTS master_dropdown_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_type_id UUID NOT NULL REFERENCES master_field_types(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES hierarchy_nodes(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    access_level TEXT DEFAULT 'all',
    parent_value TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(field_type_id, node_id, value)
);

CREATE INDEX IF NOT EXISTS idx_master_dropdown_field_type ON master_dropdown_values(field_type_id);
CREATE INDEX IF NOT EXISTS idx_master_dropdown_node ON master_dropdown_values(node_id);

-- ============================================================
-- 7. PERSONNEL LAYOUTS
-- ============================================================
CREATE TABLE IF NOT EXISTS personnel_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL UNIQUE REFERENCES hierarchy_nodes(id) ON DELETE CASCADE,
    sections JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 8. ATTENDANCE TYPES (Master)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO attendance_types (type_name, description) VALUES
    ('Present', 'Full day present on duty'),
    ('Absent', 'Full day absent'),
    ('Leave', 'On approved leave'),
    ('Duty Outside', 'On duty outside the unit')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. DUTY TYPES (Master)
-- ============================================================
CREATE TABLE IF NOT EXISTS duty_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    duty_type_name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO duty_types (duty_type_name, description) VALUES
    ('Naaka', 'Checking/barrier duty'),
    ('Escort', 'Escort duty'),
    ('Patrol', 'Area patrol duty'),
    ('Office Duty', 'Office/desk duty')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. RANKS (Master)
-- ============================================================
CREATE TABLE IF NOT EXISTS ranks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rank_name TEXT NOT NULL UNIQUE,
    rank_level INTEGER NOT NULL,
    abbreviation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO ranks (rank_name, rank_level, abbreviation) VALUES
    ('DGP', 1, 'DGP'),
    ('IGP', 3, 'IGP'),
    ('SSP', 5, 'SSP'),
    ('SP', 6, 'SP'),
    ('DSP', 7, 'DSP'),
    ('Inspector', 8, 'Insp'),
    ('Sub Inspector', 9, 'SI'),
    ('ASI', 10, 'ASI'),
    ('Head Constable', 11, 'HC'),
    ('Constable', 12, 'Ct')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 11. PERSONNEL
-- ============================================================
CREATE TABLE IF NOT EXISTS personnel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    belt_number TEXT,
    pay_code TEXT,
    full_name TEXT NOT NULL,
    father_name TEXT,
    photo_url TEXT,
    date_of_birth DATE,
    gender TEXT,
    blood_group TEXT,
    mobile_number TEXT NOT NULL,
    alternate_contact TEXT,
    religion TEXT,
    caste TEXT,
    category TEXT,
    aadhar_number TEXT,
    pan TEXT,
    village TEXT,
    police_station TEXT,
    home_district TEXT,
    rank TEXT,
    cadre TEXT,
    service_type TEXT,
    service_status TEXT DEFAULT 'Active',
    service_book_number TEXT,
    date_of_enlistment DATE,
    date_of_last_promotion DATE,
    retirement_date DATE,
    ps_duty_type TEXT,
    io_status TEXT,
    io_category TEXT,
    parade_group TEXT,
    spo_trade TEXT,
    company TEXT,
    r_batch TEXT,
    t_duty_order TEXT,
    remarks TEXT,
    node_id UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    date_of_posting DATE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by_user_id UUID,
    updated_by_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    extra_fields JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_personnel_node ON personnel(node_id);
CREATE INDEX IF NOT EXISTS idx_personnel_belt ON personnel(belt_number);
CREATE INDEX IF NOT EXISTS idx_personnel_name ON personnel(full_name);
CREATE INDEX IF NOT EXISTS idx_personnel_deleted ON personnel(is_deleted);

-- ============================================================
-- 12. PERSONNEL POSTING HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS personnel_posting (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    from_node_id UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    to_node_id UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    posting_date DATE,
    relieved_date DATE,
    posting_type TEXT DEFAULT 'Active',
    is_active BOOLEAN DEFAULT TRUE,
    order_number TEXT,
    order_date DATE,
    remarks TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posting_personnel ON personnel_posting(personnel_id);
CREATE INDEX IF NOT EXISTS idx_posting_to_node ON personnel_posting(to_node_id);

-- ============================================================
-- 13. TRANSFER REGISTER
-- ============================================================
CREATE TABLE IF NOT EXISTS transfer_register (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    from_node_id UUID REFERENCES hierarchy_nodes(id),
    to_node_id UUID REFERENCES hierarchy_nodes(id),
    order_number TEXT,
    transfer_date DATE,
    reason TEXT,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 14. LINK PERSONNEL TO APP_USERS
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'app_users_personnel_id_fkey'
    ) THEN
        ALTER TABLE app_users
        ADD CONSTRAINT app_users_personnel_id_fkey
        FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- 15. FIR REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS fir_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    year TEXT NOT NULL,
    quarter TEXT NOT NULL,
    police_station TEXT NOT NULL,
    fir_count INTEGER DEFAULT 0,
    charge_sheet_filed INTEGER DEFAULT 0,
    conviction INTEGER DEFAULT 0,
    pending INTEGER DEFAULT 0,
    cognizable INTEGER DEFAULT 0,
    non_cognizable INTEGER DEFAULT 0,
    created_by_user_id UUID REFERENCES app_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 16. GRIEVANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS grievances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    applicant_name TEXT NOT NULL,
    applicant_mobile TEXT,
    grievance_type TEXT,
    description TEXT,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Resolved', 'Closed')),
    assigned_to_user_id UUID REFERENCES app_users(id),
    resolution_text TEXT,
    created_by_user_id UUID REFERENCES app_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 17. LEAVES
-- ============================================================
CREATE TABLE IF NOT EXISTS leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
    node_id UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    leave_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER,
    reason TEXT,
    status TEXT DEFAULT 'Applied' CHECK (status IN ('Applied', 'Approved', 'Rejected', 'Cancelled')),
    approved_by_user_id UUID REFERENCES app_users(id),
    approval_date TIMESTAMP WITH TIME ZONE,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 18. TRANSFERS
-- ============================================================
CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personnel_id UUID REFERENCES personnel(id) ON DELETE CASCADE,
    from_node_id UUID REFERENCES hierarchy_nodes(id),
    to_node_id UUID REFERENCES hierarchy_nodes(id),
    order_number TEXT,
    order_date DATE,
    relieving_date DATE,
    joining_date DATE,
    status TEXT DEFAULT 'Ordered' CHECK (status IN ('Ordered', 'Relieved', 'Joined', 'Cancelled')),
    remarks TEXT,
    created_by_user_id UUID REFERENCES app_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 19. ATTENDANCE REGISTER
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_register (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    attendance_type TEXT NOT NULL,
    attendance_source TEXT DEFAULT 'Register',
    marking_method TEXT DEFAULT 'Manual',
    node_id UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    marked_by_user_id UUID REFERENCES app_users(id),
    marked_by_role TEXT,
    is_late BOOLEAN DEFAULT false,
    marked_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(personnel_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_register(date);
CREATE INDEX IF NOT EXISTS idx_attendance_node ON attendance_register(node_id);
CREATE INDEX IF NOT EXISTS idx_attendance_personnel ON attendance_register(personnel_id);

-- ============================================================
-- 20. CHITTHAS (Duty Deployment)
-- ============================================================
CREATE TABLE IF NOT EXISTS chitthas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    chittha_date DATE NOT NULL,
    status TEXT DEFAULT 'Draft',
    created_by_user_id UUID REFERENCES app_users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    UNIQUE(node_id, chittha_date)
);

CREATE TABLE IF NOT EXISTS chittha_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chittha_id UUID NOT NULL REFERENCES chitthas(id) ON DELETE CASCADE,
    personnel_id UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    section_name TEXT NOT NULL,
    duty_type TEXT,
    duty_location TEXT,
    remark_text TEXT,
    node_id UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    is_locked_by_osi BOOLEAN DEFAULT false,
    is_vip_duty BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chittha_date ON chitthas(chittha_date);
CREATE INDEX IF NOT EXISTS idx_chittha_node ON chitthas(node_id);
CREATE INDEX IF NOT EXISTS idx_assign_chittha ON chittha_assignments(chittha_id);
CREATE INDEX IF NOT EXISTS idx_assign_personnel ON chittha_assignments(personnel_id);

`;

async function runMigration() {
  const client = await pool.connect();
  console.log('\n🚀 Neon Database Migration Start...\n');
  
  try {
    await client.query('BEGIN');
    await client.query(MIGRATION_SQL);
    await client.query('COMMIT');
    console.log('✅ Saari tables successfully ban gayi!\n');
    
    // Verify tables created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📋 Created Tables:');
    result.rows.forEach(row => console.log(`   ✓ ${row.table_name}`));
    console.log('\n🎉 Migration complete! Ab app chalao.\n');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', err.message);
    console.error('Detail:', err.detail || '');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
