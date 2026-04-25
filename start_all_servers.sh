#!/usr/bin/env bash
set -euo pipefail

PYTHON=/Library/Frameworks/Python.framework/Versions/3.12/bin/python3
MYSQL=/usr/local/mysql-9.7.0-macos15-arm64/bin/mysqladmin
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 1. Check MySQL is reachable ───────────────────────────────────────────────
echo "Checking MySQL..."
if ! "$MYSQL" -u root -pP455w0rd ping --silent 2>/dev/null; then
  echo "ERROR: MySQL is not running. Start it and retry."
  exit 1
fi
echo "  MySQL: ok"

# ── 2. Start backend ──────────────────────────────────────────────────────────
echo "Starting backend..."
cd "$PROJECT_DIR"
"$PYTHON" -m uvicorn backend.main:app --reload --port 8000 \
  > "$PROJECT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

# Wait until the health endpoint responds (max 10s)
for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "ERROR: backend crashed — check backend.log"
    exit 1
  fi
  sleep 0.5
done

echo "  Backend: ready (pid $BACKEND_PID)"

# ── 3. Start frontend ─────────────────────────────────────────────────────────
echo "Starting frontend..."
npm run dev --prefix "$PROJECT_DIR/frontend" \
  > "$PROJECT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

# Wait until port 3000 responds (max 15s)
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000 >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "ERROR: frontend crashed — check frontend.log"
    kill "$BACKEND_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 0.5
done

echo "  Frontend: ready (pid $FRONTEND_PID)"

# ── 4. Print URLs ─────────────────────────────────────────────────────────────
echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│  Dashboard   →  http://localhost:3000        │"
echo "│  PDF Upload  →  http://localhost:3000/upload │"
echo "│  API Health  →  http://localhost:8000/health │"
echo "│  API Insights→  http://localhost:8000/api/insights │"
echo "└─────────────────────────────────────────────┘"
echo ""
echo "Logs: backend.log  frontend.log"
echo "Stop: kill $BACKEND_PID $FRONTEND_PID"
