-- ============================================================
-- OASI PORTAL — Seed Data (Initial Master Data + First Admin)
-- Run: psql -U postgres -d oasi_portal -f 03_seed_data.sql
-- ============================================================

-- ============================================================
-- 1. HARYANA STATE
-- ============================================================
INSERT INTO states (id, name) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Haryana')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. HARYANA RANGES
-- ============================================================
INSERT INTO ranges (name, state_id) VALUES
    ('Ambala Range',     'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    ('Hisar Range',      'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    ('Rohtak Range',     'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    ('Karnal Range',     'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    ('Gurgaon Range',    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    ('Rewari Range',     'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    ('Faridabad Commissionerate', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    ('Gurugram Commissionerate',  'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. UNIT CATEGORIES
-- ============================================================
INSERT INTO unit_categories (name) VALUES
    ('Police Station'),
    ('CIA'),
    ('Headquarters'),
    ('Traffic'),
    ('Special Branch'),
    ('Reserve Lines'),
    ('DSP Office'),
    ('SSP Office'),
    ('SDPO Office')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 4. HIERARCHY NODE — Haryana PHQ (Root Level)
-- UnitSetup page uses hierarchy_nodes
-- ============================================================
INSERT INTO hierarchy_nodes (node_code, name, level, parent_id, is_fixed, assigned_module)
VALUES ('1', 'PHQ Haryana', 1, NULL, TRUE, 'attendance')
ON CONFLICT (node_code) DO NOTHING;

-- ============================================================
-- 5. SUPER ADMIN USER
-- Belt: SA001 | Password: Admin@1234
-- bcrypt hash using pgcrypto (compatible with bcryptjs)
-- ============================================================
INSERT INTO app_users (
    name,
    belt_number,
    password_hash,
    role_id,
    state_id,
    is_active
)
SELECT
    'Super Admin',
    'SA001',
    -- bcrypt hash of 'Admin@1234' with cost factor 10
    crypt('Admin@1234', gen_salt('bf', 10)),
    r.id,
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    true
FROM roles r
WHERE r.name = 'super_admin'
ON CONFLICT (belt_number) DO NOTHING;

-- ============================================================
-- 6. MASTER FIELD TYPES for Haryana (Dropdown Config)
-- ============================================================
INSERT INTO master_field_types (state_id, field_name, display_name, personnel_field_name, is_active)
SELECT
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    v.field_name,
    v.display_name,
    v.personnel_field_name,
    true
FROM (VALUES
    ('rank',          'Rank',           'rank'),
    ('serviceStatus', 'Service Status', 'serviceStatus'),
    ('gender',        'Gender',         'gender'),
    ('bloodGroup',    'Blood Group',    'bloodGroup'),
    ('religion',      'Religion',       'religion'),
    ('category',      'Category',       'category'),
    ('psDutyType',    'PS Duty Type',   'psDutyType')
) AS v(field_name, display_name, personnel_field_name)
ON CONFLICT (state_id, field_name) DO NOTHING;

-- ============================================================
-- 7. DROPDOWN VALUES
-- ============================================================

-- Ranks
INSERT INTO master_dropdown_values (field_type_id, state_id, value, display_order, is_active)
SELECT ft.id, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v.val, v.ord, true
FROM master_field_types ft,
(VALUES
    ('DGP',1),('IGP',2),('SSP',3),('SP',4),('DSP',5),
    ('Inspector',6),('Sub Inspector',7),('ASI',8),
    ('Head Constable',9),('Constable',10)
) AS v(val, ord)
WHERE ft.field_name = 'rank'
  AND ft.state_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
ON CONFLICT DO NOTHING;

-- Service Status
INSERT INTO master_dropdown_values (field_type_id, state_id, value, display_order, is_active)
SELECT ft.id, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v.val, v.ord, true
FROM master_field_types ft,
(VALUES ('Active',1),('Retired',2),('Suspended',3),('Deceased',4)) AS v(val, ord)
WHERE ft.field_name = 'serviceStatus'
  AND ft.state_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
ON CONFLICT DO NOTHING;

-- Gender
INSERT INTO master_dropdown_values (field_type_id, state_id, value, display_order, is_active)
SELECT ft.id, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v.val, v.ord, true
FROM master_field_types ft,
(VALUES ('Male',1),('Female',2),('Other',3)) AS v(val, ord)
WHERE ft.field_name = 'gender'
  AND ft.state_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
ON CONFLICT DO NOTHING;

-- Blood Group
INSERT INTO master_dropdown_values (field_type_id, state_id, value, display_order, is_active)
SELECT ft.id, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', v.val, v.ord, true
FROM master_field_types ft,
(VALUES ('A+',1),('A-',2),('B+',3),('B-',4),('O+',5),('O-',6),('AB+',7),('AB-',8)) AS v(val, ord)
WHERE ft.field_name = 'bloodGroup'
  AND ft.state_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
ON CONFLICT DO NOTHING;

\echo ''
\echo '✅ Seed data inserted successfully!'
\echo ''
\echo '🔑 LOGIN CREDENTIALS:'
\echo '   Belt Number : SA001'
\echo '   Password    : Admin@1234'
\echo ''
\echo 'Ab run karo: psql -U postgres -d oasi_portal -f 04_verify.sql'
