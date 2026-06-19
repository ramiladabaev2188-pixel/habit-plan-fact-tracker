@echo off
cd /d "%~dp0"

set TRACKER_PID=
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do set TRACKER_PID=%%p

if defined TRACKER_PID (
  start "" "http://localhost:3000/dashboard"
  exit /b
)

start "Трекер план/факт" cmd /k "cd /d ""%~dp0"" && pnpm dev"
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000/dashboard"
