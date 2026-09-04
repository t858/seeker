@echo off
REM ==============================================================================
REM Seeker — Automated Terminal Installer for Windows
REM ==============================================================================
echo.
echo ======================================================
echo    SEEKER — Intelligent Messenger Automation Studio
echo ======================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please download and install Node.js (v18+) from https://nodejs.org
    pause
    exit /b 1
)

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo [*] Installing dependencies...
call npm install

echo.
echo [*] Registering desktop and start menu shortcuts...
call "%SCRIPT_DIR%scripts\install-app.bat"

echo.
echo ======================================================
echo  🎉 SEEKER INSTALLATION COMPLETE!
echo.
echo  🚀 HOW TO OPEN SEEKER:
echo     1. Open your Windows Start Menu or search "Seeker".
echo     2. Click "Seeker" to launch directly without opening terminal!
echo ======================================================
echo.
pause
