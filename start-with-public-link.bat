@echo off
title ZhanX DentalCare - Server with Permanent Link
cd /d "%~dp0"
echo ========================================================
echo   ZhanX DentalCare - Live Server + Permanent Public Link
echo ========================================================
echo.
echo Local LAN Link   : http://192.168.1.6:5173
echo Permanent Link   : https://zhanx-dentalcare-clinic.loca.lt
echo Tunnel Password  : (If asked, enter your IP: 103.170.161.7)
echo.
echo Starting server...
npm run share
pause
