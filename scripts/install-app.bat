@echo off
setlocal enabledelayedexpansion

REM ======================================================
REM   Seeker - Windows Native App & Shortcut Setup
REM ======================================================

REM Resolve canonical root directory
for %%I in ("%~dp0..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%"

set "ICON_FILE=%ROOT_DIR%\assets\Seeker.ico"
if not exist "%ICON_FILE%" (
    set "ICON_FILE=%ROOT_DIR%\public\icon.png"
)

REM Create robust VBS launcher with PATH safety for freshly installed Node.js
set "VBS_FILE=%ROOT_DIR%\seeker-runner.vbs"
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo Set WshEnv = WshShell.Environment^("PROCESS"^)
echo WshEnv^("PATH"^) = WshShell.ExpandEnvironmentStrings^("%%APPDATA%%\npm;%%ProgramFiles%%\nodejs;%%ProgramFiles(x86)%%\nodejs;%%LOCALAPPDATA%%\Programs\node;"^) ^& WshEnv^("PATH"^)
echo WshShell.CurrentDirectory = "%ROOT_DIR%"
echo If CreateObject^("Scripting.FileSystemObject"^).FileExists^("%ROOT_DIR%\node_modules\.bin\electron.cmd"^) Then
echo     WshShell.Run """%ROOT_DIR%\node_modules\.bin\electron.cmd"" .", 0, False
echo Else
echo     WshShell.Run "cmd /c npm start", 0, False
echo End If
) > "%VBS_FILE%"

REM Create root launcher batch file
set "SEEKER_BAT=%ROOT_DIR%\seeker.bat"
(
echo @echo off
echo cd /d "%%~dp0"
echo set "PATH=%%APPDATA%%\npm;%%ProgramFiles%%\nodejs;%%ProgramFiles(x86)%%\nodejs;%%LOCALAPPDATA%%\Programs\node;%%PATH%%"
echo if exist "%%~dp0node_modules\.bin\electron.cmd" ^(
echo     start "" "%%~dp0node_modules\.bin\electron.cmd" .
echo ^) else ^(
echo     start "" cmd /c "npm start"
echo ^)
) > "%SEEKER_BAT%"

REM Register Desktop (supporting OneDrive) and Start Menu shortcuts via PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$desktopFolder = [Environment]::GetFolderPath('Desktop'); " ^
  "$programsFolder = [Environment]::GetFolderPath('Programs'); " ^
  "$desktopShortcut = [System.IO.Path]::Combine($desktopFolder, 'Seeker.lnk'); " ^
  "$startMenuShortcut = [System.IO.Path]::Combine($programsFolder, 'Seeker.lnk'); " ^
  "$vbsPath = '%VBS_FILE%'.Replace('\', '/'); " ^
  "$iconPath = '%ICON_FILE%'.Replace('\', '/'); " ^
  "$s1 = $ws.CreateShortcut($desktopShortcut); $s1.TargetPath = 'wscript.exe'; $s1.Arguments = '\"' + $vbsPath + '\"'; $s1.IconLocation = $iconPath; $s1.WorkingDirectory = '%ROOT_DIR%'; $s1.Description = 'Seeker - Messenger Automation Studio'; $s1.Save(); " ^
  "$s2 = $ws.CreateShortcut($startMenuShortcut); $s2.TargetPath = 'wscript.exe'; $s2.Arguments = '\"' + $vbsPath + '\"'; $s2.IconLocation = $iconPath; $s2.WorkingDirectory = '%ROOT_DIR%'; $s2.Description = 'Seeker - Messenger Automation Studio'; $s2.Save();"

echo [OK] Seeker desktop and Start Menu shortcuts created successfully.
