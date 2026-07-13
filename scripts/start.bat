@echo off
setlocal
cd /d "%~dp0.."

if not exist node_modules (
  echo ERROR: node_modules missing. Run scripts\setup.bat first.
  exit /b 1
)

if not exist .env (
  copy .env.example .env >nul
  echo WARNING: Created .env - configure your LLM provider in .env
)

echo.
echo ========================================
echo  GoalPilot AI - Starting Application
echo ========================================
echo.
echo Starting GoalPilot AI at http://localhost:3000 ...
echo.

timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
call npm run dev
endlocal
