@echo off
echo ========================================
echo GoalPilot AI - Ollama Setup Script
echo ========================================
echo.

REM Check if Ollama is installed
where ollama >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Ollama is not installed or not in PATH.
    echo Please install Ollama from: https://ollama.ai/download
    pause
    exit /b 1
)

echo [OK] Ollama is installed
echo.

REM Start Ollama server
echo [1/5] Starting Ollama server...
start /B ollama serve
timeout /t 3 /nobreak >nul
echo [OK] Ollama server started
echo.

REM Check if DeepSeek model exists
echo [2/5] Checking for DeepSeek model...
ollama list | findstr "deepseek" >nul 2>&1
if %errorlevel% neq 0 (
    echo DeepSeek model not found. Pulling deepseek-r1:8b...
    ollama pull deepseek-r1:8b
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to pull DeepSeek model
        pause
        exit /b 1
    )
    echo [OK] DeepSeek model pulled
) else (
    echo [OK] DeepSeek model already exists
)
echo.

REM Check if Qwen model exists
echo [3/5] Checking for Qwen model...
ollama list | findstr "qwen" >nul 2>&1
if %errorlevel% neq 0 (
    echo Qwen model not found. Pulling qwen2.5:7b...
    ollama pull qwen2.5:7b
    if %errorlevel% neq 0 (
        echo [WARNING] Failed to pull Qwen model (optional)
    ) else (
        echo [OK] Qwen model pulled
    )
) else (
    echo [OK] Qwen model already exists
)
echo.

REM Verify Ollama API connectivity
echo [4/5] Verifying Ollama API connectivity...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Cannot connect to Ollama API at http://localhost:11434
    pause
    exit /b 1
)
echo [OK] Ollama API is accessible
echo.

REM Configure .env file
echo [5/5] Configuring environment...
if not exist "nova\.env" (
    echo Creating .env file from .env.example...
    copy "nova\.env.example" "nova\.env" >nul
    echo [OK] .env file created
) else (
    echo .env file already exists
)
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Available models:
ollama list
echo.
echo To switch models, edit nova\.env and set:
echo   LLM_MODEL=deepseek-r1:8b
echo or
echo   LLM_MODEL=qwen2.5:7b
echo.
echo Then restart the backend server.
echo.
pause
