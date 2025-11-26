@echo off
echo Stopping any existing server on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo.
echo Starting server...
node server.js
pause

