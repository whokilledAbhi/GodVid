@echo off
setlocal
echo ===================================================
echo Stopping GodVid Background Engine (Port 8000)
echo ===================================================

powershell -Command "$conns = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue; if ($conns) { $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $pids) { try { Stop-Process -Id $p -Force -ErrorAction Stop; Write-Host \"[OK] Terminated GodVid engine process PID $p\" } catch { Write-Host ('[!] Failed to kill PID ' + $p) } } } else { Write-Host '[i] No GodVid engine process found running on port 8000.' }"

echo.
pause
