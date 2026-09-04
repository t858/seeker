@echo off
setlocal
cd /d "%~dp0"
set "PATH=%APPDATA%\npm;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%LOCALAPPDATA%\Programs\node;%PATH%"

if exist "%~dp0node_modules\.bin\electron.cmd" (
    start "" "%~dp0node_modules\.bin\electron.cmd" .
) else (
    start "" cmd /c "npm start"
)
