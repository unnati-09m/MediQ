#!/bin/bash
# start.sh — Start MediQ backend server

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🏥 Starting MediQ Backend..."

# Ensure Redis is running
if ! redis-cli ping &>/dev/null; then
    echo "⚡ Starting Redis..."
    brew services start redis
    sleep 1
fi

# Ensure PostgreSQL is running
if ! /opt/homebrew/opt/postgresql@16/bin/pg_isready -U mediq -d mediq &>/dev/null; then
    echo "🐘 Starting PostgreSQL..."
    brew services start postgresql@16
    sleep 2
fi

echo "✓ Redis and PostgreSQL ready"
echo "🚀 Starting FastAPI server on http://localhost:8000 ..."
echo "📖 API docs: http://localhost:8000/docs"
echo ""

# Start uvicorn with hot-reload
backend/venv/bin/uvicorn backend.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --reload-dir backend
