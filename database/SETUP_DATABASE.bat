@echo off
TITLE OASI Portal - Database Setup
color 0A

echo =========================================
echo  OASI PORTAL - Database Setup
echo  PostgreSQL User: postgres
echo =========================================
echo.

SET PGPASSWORD=123456

REM Auto-detect PostgreSQL version
SET PSQL="C:\Program Files\PostgreSQL\18\bin\psql.exe"
IF NOT EXIST %PSQL% SET PSQL="C:\Program Files\PostgreSQL\17\bin\psql.exe"
IF NOT EXIST %PSQL% SET PSQL="C:\Program Files\PostgreSQL\16\bin\psql.exe"
IF NOT EXIST %PSQL% SET PSQL="C:\Program Files\PostgreSQL\15\bin\psql.exe"
IF NOT EXIST %PSQL% (
    echo [ERROR] PostgreSQL psql.exe nahi mila!
    echo Installed version check karo: C:\Program Files\PostgreSQL\
    pause
    exit /b 1
)

echo [STEP 1] Database aur User banana...
%PSQL% -U postgres -f "%~dp001_create_db.sql"
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Step 1 fail hua. Password check karo.
    pause
    exit /b 1
)
echo [OK] Database ready.
echo.

echo [STEP 2] Schema (Tables) banana...
%PSQL% -U postgres -d oasi_portal -f "%~dp002_schema.sql"
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Step 2 fail hua.
    pause
    exit /b 1
)
echo [OK] Tables ready.
echo.

echo [STEP 3] Seed Data insert karna...
%PSQL% -U postgres -d oasi_portal -f "%~dp003_seed_data.sql"
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Step 3 fail hua.
    pause
    exit /b 1
)
echo [OK] Data inserted.
echo.

echo [STEP 4] Verification...
%PSQL% -U postgres -d oasi_portal -f "%~dp004_verify.sql"
echo.

echo =========================================
echo  SETUP COMPLETE!
echo  Login: Belt=SA001 / Password=Admin@1234
echo =========================================
pause
