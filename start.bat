@echo off
setlocal

echo ========================================
echo  GoalPilot AI - Starting Development
echo ========================================
echo.
echo Starting Backend...
start "GoalPilot Backend" cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting Frontend...
start "GoalPilot Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo  Development servers started!
echo ========================================
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3000
echo.
echo Press any key to stop all servers...
pause >nul

taskkill /FI "WINDOWTITLE eq GoalPilot Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq GoalPilot Frontend*" /T /F >nul 2>&1

echo Servers stopped.
endlocal
