@echo off
echo.
echo ========================================
echo   Starting All Services
echo ========================================
echo.
echo Frontend (React) - Port 3000
echo Backend (Node.js) - Port 5000
echo MongoDB - Port 27017 (check if running)
echo.
echo Starting services...
echo.

cd /d "%~dp0"
npm run dev

pause

