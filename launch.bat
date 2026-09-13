@echo off
title Made N More — 3D Printing Business Management & Farm Server
color 0B
cls
echo ================================================================
echo    🖨️  MADE N MORE — 3D PRINTING BUSINESS MANAGEMENT SYSTEM
echo ================================================================
echo.

cd /d "%~dp0"

:: Start concurrently (API server on :4000 + Vite on :3000)
echo  [i] Starting Backend API Server (Port 4000) and Frontend (Port 3000)...
start /b "" cmd /c "npm start"
timeout /t 3 /nobreak >nul

echo  [i] Launching Made N More in your browser...
start "" "http://localhost:3000"

echo.
echo ================================================================
echo    Application & Farm Server active!
echo    • Local Access: http://localhost:3000
echo    • API Backend:  http://localhost:4000/api
echo ================================================================
timeout /t 3 >nul
exit
