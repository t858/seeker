@echo off
REM ==============================================================================
REM Seeker — Native Application Setup & Shortcut Script (Windows)
REM ==============================================================================
echo ⚡ Registering Seeker shortcuts on Windows...

set "SCRIPT_DIR=%~dp0.."
cd /d "%SCRIPT_DIR%"

REM Create silent VBS runner so no CMD window stays open
set "VBS_PATH=%SCRIPT_DIR%\seeker-runner.vbs"
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%SCRIPT_DIR%"
echo WshShell.Run "cmd /c npm start", 0, False
) > "%VBS_PATH%"

REM Create Start Menu and Desktop shortcuts via PowerShell
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s1 = $ws.CreateShortcut([System.IO.Path]::Combine($env:APPDATA, 'Microsoft\Windows\Start Menu\Programs\Seeker.lnk')); $s1.TargetPath = 'wscript.exe'; $s1.Arguments = '\"%VBS_PATH%\"'; $s1.IconLocation = '%SCRIPT_DIR%\public\icon.png'; $s1.Description = 'Seeker Messenger Studio'; $s1.Save(); $s2 = $ws.CreateShortcut([System.IO.Path]::Combine($env:USERPROFILE, 'Desktop\Seeker.lnk')); $s2.TargetPath = 'wscript.exe'; $s2.Arguments = '\"%VBS_PATH%\"'; $s2.IconLocation = '%SCRIPT_DIR%\public\icon.png'; $s2.Description = 'Seeker Messenger Studio'; $s2.Save();"

echo ✅ Seeker shortcuts created on Desktop and Start Menu!
echo 💡 You can now search "Seeker" in Windows Search / Start Menu to open it anytime!
