-- ============================================================
-- OASI PORTAL — Complete Schema (Pure PostgreSQL)
-- Frontend code se exact column names match kiye gaye hain
-- Run: psql -U postgres -d oasi_portal -f 02_schema.sql
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE 'plpgsql';

-- ============================================================
-- 1. HIERARCHY NODES (UnitSetup page uses this)
-- ============================================================
CREATE TABLE IF NOT EXISTS hierarchy_nodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_code       TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    level           INTEGER NOT NULL,
    parent_id       UUID REFERENCES hierarchy_nodes(id) ON DELETE CASCADE,
    is_fixed        BOOLEAN DEFAULT FALSE,
    assigned_module TEXT DEFAULT 'attendance',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hierarchy_parent ON hierarchy_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_code   ON hierarchy_nodes(node_code);
CREATE INDEX IF NOT EXISTS idx_hierarchy_level  ON hierarchy_nodes(level);

CREATE TRIGGER trg_hierarchy_updated_at
    BEFORE UPDATE ON hierarchy_nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. OLD LOCATION TABLES (frontend code queries these)
-- AuthContext, PersonnelList, AttendanceRegister use these
-- ============================================================
CREATE TABLE IF NOT EXISTS states (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranges (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    state_id   UUID REFERENCES states(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ranges_state ON ranges(state_id);

CREATE TABLE IF NOT EXISTS districts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    range_id   UUID REFERENCES ranges(id) ON DELETE CASCADE,
    state_id   UUID REFERENCES states(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_districts_range ON districts(range_id);
CREATE INDEX IF NOT EXISTS idx_districts_state ON districts(state_id);

CREATE TABLE IF NOT EXISTS unit_categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    unit_type       TEXT,
    state_id        UUID REFERENCES states(id) ON DELETE SET NULL,
    range_id        UUID REFERENCES ranges(id) ON DELETE SET NULL,
    district_id     UUID REFERENCES districts(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES unit_categories(id) ON DELETE SET NULL,
    assigned_module TEXT DEFAULT 'attendance',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_units_district ON units(district_id);
CREATE INDEX IF NOT EXISTS idx_units_state    ON units(state_id);

CREATE TABLE IF NOT EXISTS sub_units (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    unit_id         UUID REFERENCES units(id) ON DELETE CASCADE,
    district_id     UUID REFERENCES districts(id) ON DELETE SET NULL,
    state_id        UUID REFERENCES states(id) ON DELETE SET NULL,
    range_id        UUID REFERENCES ranges(id) ON DELETE SET NULL,
    assigned_module TEXT DEFAULT 'attendance',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_units_unit     ON sub_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_sub_units_district ON sub_units(district_id);

-- ============================================================
-- 3. ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    rank_level  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description, rank_level) VALUES
    ('super_admin',    'Full system access (Headquarters)', 1),
    ('state_admin',    'State/PHQ level administration',    2),
    ('range_admin',    'Range level administration (OASI)', 3),
    ('district_admin', 'District level management (OASI)',  4),
    ('unit_admin',     'Unit level management (MHC)',       5),
    ('staff',          'View-only access to own records',   6)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 4. APP USERS
-- AuthContext queries: roles(name), states(name), ranges(name),
-- districts(name), units(name), sub_units(name)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    belt_number   TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    node_id       UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    state_id      UUID REFERENCES states(id) ON DELETE SET NULL,
    range_id      UUID REFERENCES ranges(id) ON DELETE SET NULL,
    district_id   UUID REFERENCES districts(id) ON DELETE SET NULL,
    unit_id       UUID REFERENCES units(id) ON DELETE SET NULL,
    sub_unit_id   UUID REFERENCES sub_units(id) ON DELETE SET NULL,
    personnel_id  UUID,
    mobile_number TEXT,
    is_active     BOOLEAN DEFAULT TRUE,
    last_login    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_app_users_belt ON app_users(belt_number);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role_id);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON app_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. MASTER DROPDOWN TABLES
-- Frontend queries with state_id (NOT node_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS master_field_types (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_id             UUID REFERENCES states(id) ON DELETE CASCADE,
    field_name           TEXT NOT NULL,
    display_name         TEXT NOT NULL,
    personnel_field_name TEXT,
    helper_example       TEXT DEFAULT 'Value1, Value2, Value3',
    description          TEXT,
    is_active            BOOLEAN DEFAULT TRUE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(state_id, field_name)
);

CREATE TABLE IF NOT EXISTS master_dropdown_values (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_type_id UUID NOT NULL REFERENCES master_field_types(id) ON DELETE CASCADE,
    state_id      UUID REFERENCES states(id) ON DELETE CASCADE,
    value         TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    access_level  TEXT DEFAULT 'all',
    parent_value  TEXT,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(field_type_id, state_id, value)
);
CREATE INDEX IF NOT EXISTS idx_dropdown_field  ON master_dropdown_values(field_type_id);
CREATE INDEX IF NOT EXISTS idx_dropdown_state  ON master_dropdown_values(state_id);

CREATE TABLE IF NOT EXISTS personnel_layouts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id    UUID UNIQUE REFERENCES hierarchy_nodes(id) ON DELETE CASCADE,
    sections   JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. MASTER DATA (Ranks, Attendance Types, Duty Types)
-- ============================================================
CREATE TABLE IF NOT EXISTS ranks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rank_name    TEXT NOT NULL UNIQUE,
    rank_level   INTEGER NOT NULL,
    abbreviation TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ranks (rank_name, rank_level, abbreviation) VALUES
    ('DGP', 1, 'DGP'), ('IGP', 3, 'IGP'), ('SSP', 5, 'SSP'),
    ('SP', 6, 'SP'), ('DSP', 7, 'DSP'), ('Inspector', 8, 'Insp'),
    ('Sub Inspector', 9, 'SI'), ('ASI', 10, 'ASI'),
    ('Head Constable', 11, 'HC'), ('Constable', 12, 'Ct')
ON CONFLICT (rank_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS attendance_types (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name   TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO attendance_types (type_name, description) VALUES
    ('Present',      'Full day present on duty'),
    ('Absent',       'Full day absent'),
    ('Leave',        'On approved leave'),
    ('Duty Outside', 'On duty outside the unit'),
    ('Half Day',     'Half day present'),
    ('Hourly Leave', 'Hourly leave taken')
ON CONFLICT (type_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS duty_types (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    duty_type_name TEXT NOT NULL UNIQUE,
    description    TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO duty_types (duty_type_name, description) VALUES
    ('Naaka', 'Checking/barrier duty'), ('Escort', 'Escort duty'),
    ('Patrol', 'Area patrol duty'), ('Office Duty', 'Office/desk duty')
ON CONFLICT (duty_type_name) DO NOTHING;

-- ============================================================
-- 7. PERSONNEL
-- Uses old location fields (state_id, district_id, etc.)
-- plus node_id for new hierarchy
-- ============================================================
CREATE TABLE IF NOT EXISTS personnel (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    belt_number           TEXT,
    pay_code              TEXT,
    full_name             TEXT NOT NULL,
    father_name           TEXT,
    photo_url             TEXT,
    date_of_birth         DATE,
    gender                TEXT,
    blood_group           TEXT,
    mobile_number         TEXT NOT NULL,
    alternate_contact     TEXT,
    religion              TEXT,
    caste                 TEXT,
    category              TEXT,
    aadhar_number         TEXT,
    pan                   TEXT,
    village               TEXT,
    police_station        TEXT,
    home_district         TEXT,
    home_district_ps      TEXT,
    rank                  TEXT,
    cadre                 TEXT,
    service_type          TEXT,
    service_status        TEXT DEFAULT 'Active',
    service_book_number   TEXT,
    date_of_enlistment    DATE,
    date_of_last_promotion DATE,
    retirement_date       DATE,
    ps_duty_type          TEXT,
    io_status             TEXT,
    io_category           TEXT,
    parade_group          TEXT,
    spo_trade             TEXT,
    company               TEXT,
    r_batch               TEXT,
    t_duty_order          TEXT,
    remarks               TEXT,
    -- Old location FKs (frontend queries these)
    state_id              UUID REFERENCES states(id) ON DELETE SET NULL,
    range_id              UUID REFERENCES ranges(id) ON DELETE SET NULL,
    district_id           UUID REFERENCES districts(id) ON DELETE SET NULL,
    unit_type             TEXT,
    current_unit_id       UUID REFERENCES units(id) ON DELETE SET NULL,
    current_sub_unit_id   UUID REFERENCES sub_units(id) ON DELETE SET NULL,
    date_of_posting       DATE,
    -- New hierarchy FK
    node_id               UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    -- Metadata
    is_deleted            BOOLEAN DEFAULT FALSE,
    created_by_user_id    UUID REFERENCES app_users(id) ON DELETE SET NULL,
    updated_by_user_id    UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    extra_fields          JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_personnel_belt     ON personnel(belt_number);
CREATE INDEX IF NOT EXISTS idx_personnel_name     ON personnel(full_name);
CREATE INDEX IF NOT EXISTS idx_personnel_deleted  ON personnel(is_deleted);
CREATE INDEX IF NOT EXISTS idx_personnel_status   ON personnel(service_status);
CREATE INDEX IF NOT EXISTS idx_personnel_unit     ON personnel(current_unit_id);
CREATE INDEX IF NOT EXISTS idx_personnel_district ON personnel(district_id);
CREATE INDEX IF NOT EXISTS idx_personnel_state    ON personnel(state_id);
CREATE INDEX IF NOT EXISTS idx_personnel_node     ON personnel(node_id);

CREATE TRIGGER trg_personnel_updated_at
    BEFORE UPDATE ON personnel
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Link personnel back to app_users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_personnel'
    ) THEN
        ALTER TABLE app_users
        ADD CONSTRAINT fk_users_personnel
        FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- 8. TRANSFERS & POSTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS personnel_posting (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id  UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    from_node_id  UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    to_node_id    UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    posting_date  DATE,
    relieved_date DATE,
    posting_type  TEXT DEFAULT 'Active',
    is_active     BOOLEAN DEFAULT TRUE,
    order_number  TEXT,
    order_date    DATE,
    remarks       TEXT,
    status        TEXT DEFAULT 'Active',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posting_personnel ON personnel_posting(personnel_id);

CREATE TABLE IF NOT EXISTS transfers (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id       UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    from_node_id       UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    to_node_id         UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    order_number       TEXT,
    order_date         DATE,
    relieving_date     DATE,
    joining_date       DATE,
    status             TEXT DEFAULT 'Ordered'
                       CHECK (status IN ('Ordered','Relieved','Joined','Cancelled')),
    remarks            TEXT,
    created_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transfers_personnel ON transfers(personnel_id);

-- ============================================================
-- 9. ATTENDANCE REGISTER
-- AttendanceRegister.jsx uses: unit_id, sub_unit_id, state_id,
-- range_id, district_id (old fields) + node_id (new)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_register (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id      UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    date              DATE NOT NULL,
    attendance_type   TEXT NOT NULL,
    attendance_source TEXT DEFAULT 'Register',
    marking_method    TEXT DEFAULT 'Manual',
    -- Old location fields (frontend sends these)
    state_id          UUID REFERENCES states(id) ON DELETE SET NULL,
    range_id          UUID REFERENCES ranges(id) ON DELETE SET NULL,
    district_id       UUID REFERENCES districts(id) ON DELETE SET NULL,
    unit_id           UUID REFERENCES units(id) ON DELETE SET NULL,
    sub_unit_id       UUID REFERENCES sub_units(id) ON DELETE SET NULL,
    -- New hierarchy field
    node_id           UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    marked_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    marked_by_role    TEXT,
    is_late           BOOLEAN DEFAULT FALSE,
    marked_at         TIMESTAMPTZ DEFAULT NOW(),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(personnel_id, date)
);
CREATE INDEX IF NOT EXISTS idx_att_date      ON attendance_register(date);
CREATE INDEX IF NOT EXISTS idx_att_personnel ON attendance_register(personnel_id);
CREATE INDEX IF NOT EXISTS idx_att_unit      ON attendance_register(unit_id);
CREATE INDEX IF NOT EXISTS idx_att_node      ON attendance_register(node_id);

-- ============================================================
-- 10. NAUKARI CHITTHA
-- ChitthaList queries: unit_id (FK to units), district_id
-- ============================================================
CREATE TABLE IF NOT EXISTS chitthas (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id            UUID REFERENCES units(id) ON DELETE SET NULL,
    district_id        UUID REFERENCES districts(id) ON DELETE SET NULL,
    node_id            UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    chittha_date       DATE NOT NULL,
    status             TEXT DEFAULT 'Draft'
                       CHECK (status IN ('Draft','Submitted','Approved')),
    created_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW(),
    submitted_at       TIMESTAMPTZ,
    UNIQUE(unit_id, chittha_date)
);
CREATE INDEX IF NOT EXISTS idx_chittha_date ON chitthas(chittha_date);
CREATE INDEX IF NOT EXISTS idx_chittha_unit ON chitthas(unit_id);

CREATE TABLE IF NOT EXISTS chittha_assignments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chittha_id       UUID NOT NULL REFERENCES chitthas(id) ON DELETE CASCADE,
    personnel_id     UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
    section_name     TEXT NOT NULL,
    duty_type        TEXT,
    duty_location    TEXT,
    remark_text      TEXT,
    node_id          UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    is_locked_by_osi BOOLEAN DEFAULT FALSE,
    is_vip_duty      BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assign_chittha   ON chittha_assignments(chittha_id);
CREATE INDEX IF NOT EXISTS idx_assign_personnel ON chittha_assignments(personnel_id);

-- ============================================================
-- 11. LEAVES, FIR REPORTS, GRIEVANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS leaves (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id        UUID REFERENCES personnel(id) ON DELETE CASCADE,
    node_id             UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    leave_type          TEXT NOT NULL,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    total_days          INTEGER,
    reason              TEXT,
    status              TEXT DEFAULT 'Applied'
                        CHECK (status IN ('Applied','Approved','Rejected','Cancelled')),
    approved_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    approval_date       TIMESTAMPTZ,
    remarks             TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leaves_personnel ON leaves(personnel_id);

CREATE TABLE IF NOT EXISTS fir_reports (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id            UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    year               TEXT NOT NULL,
    quarter            TEXT NOT NULL,
    police_station     TEXT NOT NULL,
    fir_count          INTEGER DEFAULT 0,
    charge_sheet_filed INTEGER DEFAULT 0,
    conviction         INTEGER DEFAULT 0,
    pending            INTEGER DEFAULT 0,
    cognizable         INTEGER DEFAULT 0,
    non_cognizable     INTEGER DEFAULT 0,
    created_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grievances (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id             UUID REFERENCES hierarchy_nodes(id) ON DELETE SET NULL,
    applicant_name      TEXT NOT NULL,
    applicant_mobile    TEXT,
    grievance_type      TEXT,
    description         TEXT,
    status              TEXT DEFAULT 'Pending'
                        CHECK (status IN ('Pending','In Progress','Resolved','Closed')),
    assigned_to_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    resolution_text     TEXT,
    created_by_user_id  UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

\echo '✅ Schema successfully created!'
\echo 'Ab run karo: psql -U postgres -d oasi_portal -f 03_seed_data.sql'
