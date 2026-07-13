@echo off
setlocal
cd /d "%~dp0.."

echo ========================================
echo  GoalPilot AI - Local Setup
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed. Install Node.js 18+ from https://nodejs.org
  exit /b 1
)
echo [OK] Node.js is installed

echo.
echo [1/5] Installing npm dependencies...
call npm install
if errorlevel 1 (
  echo ERROR: Failed to install dependencies
  exit /b 1
)
echo [OK] Dependencies installed

echo.
echo [2/5] Configuring environment...
if not exist .env (
  copy .env.example .env >nul
  echo [OK] Created .env from .env.example
  echo IMPORTANT: Edit .env and configure your LLM provider
) else (
  echo [OK] .env already exists
)

echo.
echo [3/5] Verifying TypeScript...
call npx tsc --noEmit
if errorlevel 1 (
  echo WARNING: TypeScript compilation has errors (non-fatal)
) else (
  echo [OK] TypeScript compilation successful
)

echo.
echo [4/5] Checking for Ollama (optional)...
where ollama >nul 2>&1
if errorlevel 1 (
  echo [INFO] Ollama not found. Install from https://ollama.ai/download for local models
) else (
  echo [OK] Ollama is installed
  echo Run scripts\setup-ollama.bat to configure Ollama models
)

echo.
echo [5/5] Setup complete!
echo.
echo Next steps:
echo   1. Edit .env and configure your LLM provider (ollama or gemini)
echo   2. If using Ollama, run: scripts\setup-ollama.bat
echo   3. Start the application: scripts\start.bat
echo.
echo For more information, see README.md
endlocal
