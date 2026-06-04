@echo off
TITLE OASI Portal — Development Server
color 0A

echo =========================================
echo  OASI Portal - Starting Dev Environment
echo =========================================
echo.
echo [1] Backend (Express API) Port 5000 start ho raha hai...
start "OASI Backend" cmd /k "cd /d D:\oasi-app\server && node index.js"

echo [2] 3 seconds wait...
timeout /t 3 /nobreak >nul

echo [3] Frontend (Vite) Port 5173 start ho raha hai...
start "OASI Frontend" cmd /k "cd /d D:\oasi-app && npm run dev"

echo.
echo =========================================
echo  Done! Do windows khulenge:
echo  Backend  → http://localhost:5000/api/health
echo  Frontend → http://localhost:5173
echo =========================================
echo.
pause
