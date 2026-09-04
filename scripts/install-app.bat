@echo off
setlocal enabledelayedexpansion

REM ======================================================
REM   Seeker - Windows Native App & Shortcut Setup
REM ======================================================

set "SCRIPT_DIR=%~dp0.."
cd /d "%SCRIPT_DIR%"

set "ICON_FILE=%SCRIPT_DIR%\assets\Seeker.ico"
if not exist "%ICON_FILE%" (
    set "ICON_FILE=%SCRIPT_DIR%\public\icon.png"
)

REM Create invisible VBS launcher
set "VBS_FILE=%SCRIPT_DIR%\seeker-runner.vbs"
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%SCRIPT_DIR%"
echo WshShell.Run "cmd /c npm start", 0, False
) > "%VBS_FILE%"

REM Create Start Menu and Desktop shortcuts using PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$startMenuPath = [System.IO.Path]::Combine($env:APPDATA, 'Microsoft\Windows\Start Menu\Programs\Seeker.lnk'); " ^
  "$desktopPath = [System.IO.Path]::Combine($env:USERPROFILE, 'Desktop\Seeker.lnk'); " ^
  "$icon = '%ICON_FILE%'.Replace('\', '/'); " ^
  "$vbs = '%VBS_FILE%'.Replace('\', '/'); " ^
  "$s1 = $ws.CreateShortcut($startMenuPath); $s1.TargetPath = 'wscript.exe'; $s1.Arguments = '\"' + $vbs + '\"'; $s1.IconLocation = $icon; $s1.Description = 'Seeker - Messenger Automation Studio'; $s1.Save(); " ^
  "$s2 = $ws.CreateShortcut($desktopPath); $s2.TargetPath = 'wscript.exe'; $s2.Arguments = '\"' + $vbs + '\"'; $s2.IconLocation = $icon; $s2.Description = 'Seeker - Messenger Automation Studio'; $s2.Save();"

echo [OK] Seeker shortcuts registered successfully.
