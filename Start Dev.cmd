@echo off
title ZhanX DentalCare Dev
cd /d "%~dp0"

echo [1/2] Starting PostgreSQL Database...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\dev-db.ps1" start

echo [2/2] Launching Development Environment (API + Vite + Electron)...
set "PATH=%~dp0node_modules\.bin;C:\Program Files\nodejs;%PATH%"
set "ELECTRON_RUN_AS_NODE="
npm run dev
pause

