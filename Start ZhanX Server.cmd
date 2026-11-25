@echo off
setlocal
title ZhanX DentalCare Server
cd /d "%~dp0"

echo Starting the clinic database...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\dev-db.ps1" start

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $null = Invoke-RestMethod 'http://127.0.0.1:4000/api/health' -TimeoutSec 4 } catch { exit 1 }"
if errorlevel 1 goto startapi
echo Clinic API is already running.
goto report

:startapi
echo Starting the clinic API server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$pkg = Join-Path (Get-Location) 'release\server\ZhanX-DentalCare-Server-1.0.0'; New-Item -ItemType Directory -Force -Path (Join-Path $pkg 'logs') | Out-Null; Start-Process -FilePath 'node' -ArgumentList 'server/src/server.js' -WorkingDirectory $pkg -WindowStyle Hidden -RedirectStandardOutput (Join-Path $pkg 'logs\stdout.log') -RedirectStandardError (Join-Path $pkg 'logs\stderr.log')"
timeout /t 6 /nobreak >nul

:report
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod 'http://127.0.0.1:4000/api/health' -TimeoutSec 10; Write-Host ''; if ($r.data.status -eq 'ok' -and $r.data.database) { Write-Host 'Server is running and the database is connected.' -ForegroundColor Green; Write-Host 'Open ZhanX DentalCare from the desktop shortcut.' -ForegroundColor Green } else { Write-Host ('API is up but the database is not connected (status: ' + $r.data.status + ').') -ForegroundColor Yellow; Write-Host 'Run: powershell -ExecutionPolicy Bypass -File scripts\dev-db.ps1 start' -ForegroundColor Yellow } } catch { Write-Host ''; Write-Host 'Server did not start. Check release\server\ZhanX-DentalCare-Server-1.0.0\logs\stderr.log' -ForegroundColor Red }"
echo.
pause
