@echo off
title Made N More — 3D Printing Business Manager
color 0B
cls
echo ================================================================
echo    🖨️  MADE N MORE — 3D PRINTING BUSINESS MANAGEMENT SYSTEM
echo ================================================================
echo.

cd /d "%~dp0"

:: Check if local server is already running on port 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo  [✓] Dev server is already active on http://localhost:3000
) else (
    echo  [i] Starting Vite dev server on port 3000...
    start /b "" cmd /c "npx vite --port 3000"
    timeout /t 2 /nobreak >nul
)

echo  [i] Launching Made N More in your browser...
start "" "http://localhost:3000"

echo.
echo ================================================================
echo    Application launched successfully! (http://localhost:3000)
echo ================================================================
timeout /t 3 >nul
exit
