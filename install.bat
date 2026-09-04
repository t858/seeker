@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

REM ======================================================
REM   SEEKER - Automated Terminal Installer for Windows
REM ======================================================
echo.
echo ======================================================
echo    SEEKER - Intelligent Messenger Automation Studio
echo ======================================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 goto NO_NODE

where npm >nul 2>&1
if %ERRORLEVEL% neq 0 goto NO_NODE

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo [*] Installing Seeker dependencies (this may take a minute)...
call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] npm install encountered an issue. Please ensure your internet connection is active.
    pause
    exit /b 1
)

echo.
echo [*] Registering Windows Start Menu and Desktop shortcuts...
call "%SCRIPT_DIR%scripts\install-app.bat"

echo.
echo ======================================================
echo  [SUCCESS] SEEKER INSTALLATION COMPLETE!
echo.
echo  HOW TO OPEN SEEKER:
echo     1. Open your Windows Start Menu or search "Seeker".
echo     2. Click "Seeker" to launch directly without opening terminal!
echo ======================================================
echo.
pause
exit /b 0

:NO_NODE
echo.
echo [ERROR] Node.js is not detected on your system.
echo.
echo Please download and install Node.js (version 18 or newer):
echo 1. Visit: https://nodejs.org
echo 2. Download the LTS installer for Windows
echo 3. Run the installer, restart your Command Prompt, and run install.bat again.
echo.
pause
exit /b 1
