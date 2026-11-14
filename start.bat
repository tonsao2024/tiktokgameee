@echo off
cd /d "%~dp0"
title Morlam Stage - TikTok LIVE
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js is not installed.
  echo     Download and install the LTS version from https://nodejs.org then run this file again.
  start https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing... first time only, please wait.
  call npm install
  if errorlevel 1 (
    echo [!] Install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)
echo.
echo Stage is starting at http://localhost:3000
echo Keep this window open while you are live. Close it to stop.
echo.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
node server.js
pause
