@echo off
setlocal
echo ===================================================
echo GodVid 24/7 Always-On Background Service Installer
echo ===================================================
echo.

cd /d "%~dp0"

REM 1. Verify Venv & dependencies
if not exist "venv\Scripts\python.exe" (
    echo [*] Initializing virtual environment...
    python -m venv venv
    call .\venv\Scripts\pip install -r backend\requirements.txt
)

REM 2. Create Startup shortcut in Windows Startup Folder
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_SCRIPT=%~dp0start-silent-background.vbs"
set "SHORTCUT_PATH=%STARTUP_DIR%\GodVid-Background-Engine.lnk"

echo [*] Registering silent autostart with Windows...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%VBS_SCRIPT%\"'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'GodVid 24/7 Background Engine'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [OK] Autostart registered successfully!
    echo      The GodVid engine will now start automatically whenever your PC turns on.
) else (
    echo [!] Warning: Could not create startup shortcut in %STARTUP_DIR%
)

echo.
echo [*] Starting GodVid engine in the background now...
wscript.exe "%VBS_SCRIPT%"

timeout /t 2 >nul
echo.
echo ===================================================
echo [SUCCESS] GodVid engine is now running 24/7 in the background!
echo Endpoint: http://localhost:8000
echo Check status anytime with: status-engine.bat
echo Stop anytime with: stop-engine.bat
echo ===================================================
pause
