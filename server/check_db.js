require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

const seedSQL = `
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
ON CONFLICT DO NOTHING;

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
`;

client.connect().then(async () => {
  await client.query(`ALTER TABLE master_field_types DROP CONSTRAINT IF EXISTS master_field_types_node_id_fkey`);
  await client.query(`ALTER TABLE master_dropdown_values DROP CONSTRAINT IF EXISTS master_dropdown_values_node_id_fkey`);
  await client.query(seedSQL);
  console.log("Constraints removed and DB Seeded successfully!");
  return client.end();
}).catch(console.error);
