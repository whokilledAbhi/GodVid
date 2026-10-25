@echo off
setlocal
echo ===================================================
echo GodVid Engine Health & Status Check
echo ===================================================

powershell -Command "try { $res = Invoke-RestMethod -Uri 'http://localhost:8000/api/status' -TimeoutSec 3 -ErrorAction Stop; Write-Host '[STATUS] ONLINE (Healthy)' -ForegroundColor Green; Write-Host ('FFmpeg Available:   ' + $res.ffmpeg_available); Write-Host ('Aria2c Turbo (16x): ' + $res.aria2_available); Write-Host ('Concurrency Limit:  ' + $res.concurrency_limit); Write-Host ('Active Workers:     ' + $res.active_workers); Write-Host ('Free Disk Space:    ' + $res.disk_free_gb + ' GB'); Write-Host ('Total Jobs:         ' + $res.total_jobs); } catch { Write-Host '[STATUS] OFFLINE - Port 8000 is not responding.' -ForegroundColor Red; Write-Host 'Start it using start-silent-background.vbs or install-autostart-service.bat'; }"

echo.
pause
