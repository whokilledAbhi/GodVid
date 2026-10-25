@echo off
setlocal enabledelayedexpansion
echo ===================================================
echo GodVid Cloudflare Tunnel Launcher (24/7 Always-On)
echo ===================================================
echo.

cd /d "%~dp0"

REM 1. Ensure Local Engine is running
powershell -Command "try { $res = Invoke-RestMethod -Uri 'http://localhost:8000/api/status' -TimeoutSec 2 -ErrorAction Stop; Write-Host '[OK] Local engine is online on port 8000.' -ForegroundColor Green; } catch { Write-Host '[*] Local engine is offline. Starting silent background engine...' -ForegroundColor Yellow; Start-Process 'wscript.exe' -ArgumentList '\"%~dp0start-silent-background.vbs\"'; Start-Sleep -Seconds 3; }"

REM 2. Check for cloudflared binary
if not exist "cloudflared.exe" (
    echo [*] Downloading official cloudflared binary from Cloudflare...
    curl.exe -L -o cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
    if not exist "cloudflared.exe" (
        echo [!] Failed to download cloudflared.exe. Please download manually from:
        echo     https://github.com/cloudflare/cloudflared/releases
        pause
        exit /b 1
    )
)

echo.
echo ===================================================
echo Starting Cloudflare Quick Tunnel for port 8000...
echo.
echo Look for the URL ending with '.trycloudflare.com' below!
echo Copy that HTTPS URL and paste it into the GodVid extension settings.
echo ===================================================
echo.

.\cloudflared.exe tunnel --url http://localhost:8000
pause
