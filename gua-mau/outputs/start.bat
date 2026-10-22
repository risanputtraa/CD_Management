@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js, then run this file again.
  pause
  exit /b 1
)
node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
if not errorlevel 1 (
  echo Project Workspace is already running at http://127.0.0.1:4173/
  choice /C OR /M "Press O to open it, or R to restart and load the latest code"
  if errorlevel 2 goto restart_server
  start "" "http://127.0.0.1:4173/"
  pause
  exit /b 0
)
goto start_server

:restart_server
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":4173" ^| findstr "LISTENING"') do (
  echo Stopping the existing Project Workspace server...
  taskkill /PID %%P /F >nul 2>nul
)
timeout /t 1 /nobreak >nul
node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
if not errorlevel 1 (
  echo Could not stop the old server. Close its server window manually, then run this file again.
  pause
  exit /b 1
)

:start_server
echo Starting Project Workspace...
node server.js
if errorlevel 1 echo The server stopped because of an error.
pause
