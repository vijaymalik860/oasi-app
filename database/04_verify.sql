-- ============================================================
-- OASI PORTAL — Verification Queries
-- Run: psql -U postgres -d oasi_portal -f 04_verify.sql
-- ============================================================

\echo '--- Tables Created ---'
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

\echo ''
\echo '--- Roles ---'
SELECT name, description FROM roles ORDER BY rank_level;

\echo ''
\echo '--- States ---'
SELECT name FROM states;

\echo ''
\echo '--- Admin User ---'
SELECT u.belt_number, u.name, r.name AS role, u.is_active
FROM app_users u JOIN roles r ON r.id = u.role_id;

\echo ''
\echo '--- Master Field Types ---'
SELECT field_name, display_name FROM master_field_types;

\echo ''
\echo '--- Dropdown Values Count per Field ---'
SELECT ft.field_name, COUNT(dv.id) AS value_count
FROM master_field_types ft
LEFT JOIN master_dropdown_values dv ON dv.field_type_id = ft.id
GROUP BY ft.field_name ORDER BY ft.field_name;

\echo ''
\echo '✅ Verification complete!'
