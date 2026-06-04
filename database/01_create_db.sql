-- ============================================================
-- OASI PORTAL — Step 1: Database & User Creation
-- Run this as: psql -U postgres -f 01_create_db.sql
-- ============================================================

-- Application user banana (agar pehle se nahi hai)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'oasi_admin') THEN
    CREATE USER oasi_admin WITH PASSWORD 'OasiDB@2024!';
  END IF;
END
$$;

-- Database banana (agar pehle se nahi hai)
SELECT 'CREATE DATABASE oasi_portal OWNER oasi_admin'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'oasi_portal')\gexec

-- Permissions
GRANT ALL PRIVILEGES ON DATABASE oasi_portal TO oasi_admin;

\echo '✅ Database oasi_portal aur user oasi_admin ready hain.'
\echo 'Ab run karo: psql -U oasi_admin -d oasi_portal -f 02_schema.sql'
