#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/.."

echo "========================================"
echo " GoalPilot AI - Local Setup"
echo "========================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is not installed. Install Node.js 18+ from https://nodejs.org"
  exit 1
fi
echo "[OK] Node.js is installed"

echo ""
echo "[1/5] Installing npm dependencies..."
npm install
echo "[OK] Dependencies installed"

echo ""
echo "[2/5] Configuring environment..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "[OK] Created .env from .env.example"
  echo "IMPORTANT: Edit .env and configure your LLM provider"
else
  echo "[OK] .env already exists"
fi

echo ""
echo "[3/5] Verifying TypeScript..."
if npx tsc --noEmit; then
  echo "[OK] TypeScript compilation successful"
else
  echo "WARNING: TypeScript compilation has errors (non-fatal)"
fi

echo ""
echo "[4/5] Checking for Ollama (optional)..."
if command -v ollama >/dev/null 2>&1; then
  echo "[OK] Ollama is installed"
  echo "Run scripts/setup-ollama.sh to configure Ollama models"
else
  echo "[INFO] Ollama not found. Install from https://ollama.ai/download for local models"
fi

echo ""
echo "[5/5] Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env and configure your LLM provider (ollama or gemini)"
echo "  2. If using Ollama, run: scripts/setup-ollama.sh"
echo "  3. Start the application: scripts/start.sh"
echo ""
echo "For more information, see README.md"
