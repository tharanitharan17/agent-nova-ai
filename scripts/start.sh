#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/.."

if [ ! -d node_modules ]; then
  echo "ERROR: node_modules missing. Run scripts/setup.sh first."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "WARNING: Created .env - configure your LLM provider in .env"
fi

echo ""
echo "========================================"
echo " GoalPilot AI - Starting Application"
echo "========================================"
echo ""
echo "Starting GoalPilot AI at http://localhost:3000 ..."
echo ""

sleep 2
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:3000" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open "http://localhost:3000" >/dev/null 2>&1 &
fi

npm run dev
