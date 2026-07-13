#!/bin/bash

echo "========================================"
echo "GoalPilot AI - Ollama Setup Script"
echo "========================================"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "[ERROR] Ollama is not installed or not in PATH."
    echo "Please install Ollama from: https://ollama.ai/download"
    exit 1
fi

echo "[OK] Ollama is installed"
echo ""

# Start Ollama server
echo "[1/5] Starting Ollama server..."
ollama serve > /dev/null 2>&1 &
OllAMA_PID=$!
sleep 3
echo "[OK] Ollama server started (PID: $OllAMA_PID)"
echo ""

# Check if DeepSeek model exists
echo "[2/5] Checking for DeepSeek model..."
if ! ollama list | grep -q "deepseek"; then
    echo "DeepSeek model not found. Pulling deepseek-r1:8b..."
    ollama pull deepseek-r1:8b
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to pull DeepSeek model"
        exit 1
    fi
    echo "[OK] DeepSeek model pulled"
else
    echo "[OK] DeepSeek model already exists"
fi
echo ""

# Check if Qwen model exists
echo "[3/5] Checking for Qwen model..."
if ! ollama list | grep -q "qwen"; then
    echo "Qwen model not found. Pulling qwen2.5:7b..."
    ollama pull qwen2.5:7b
    if [ $? -ne 0 ]; then
        echo "[WARNING] Failed to pull Qwen model (optional)"
    else
        echo "[OK] Qwen model pulled"
    fi
else
    echo "[OK] Qwen model already exists"
fi
echo ""

# Verify Ollama API connectivity
echo "[4/5] Verifying Ollama API connectivity..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "[ERROR] Cannot connect to Ollama API at http://localhost:11434"
    exit 1
fi
echo "[OK] Ollama API is accessible"
echo ""

# Configure .env file
echo "[5/5] Configuring environment..."
if [ ! -f "nova/.env" ]; then
    echo "Creating .env file from .env.example..."
    cp "nova/.env.example" "nova/.env"
    echo "[OK] .env file created"
else
    echo ".env file already exists"
fi
echo ""

echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Available models:"
ollama list
echo ""
echo "To switch models, edit nova/.env and set:"
echo "  LLM_MODEL=deepseek-r1:8b"
echo "or"
echo "  LLM_MODEL=qwen2.5:7b"
echo ""
echo "Then restart the backend server."
echo ""
