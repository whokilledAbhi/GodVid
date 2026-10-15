#!/bin/bash
set -e

echo "==================================================="
echo "Starting GodVid - High-Performance Video Downloader"
echo "[PRODUCTION MODE]"
echo "==================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Python venv setup
if [ ! -f "venv/bin/python" ]; then
    echo "[1/3] Setting up Python virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install --no-cache-dir -r backend/requirements.txt
else
    echo "[1/3] Python environment verified."
fi

# 2. Frontend build
cd frontend
if [ ! -d "node_modules" ]; then
    echo "[2/3] Installing frontend dependencies..."
    npm ci || npm install
fi

if [ ! -f ".next/BUILD_ID" ]; then
    echo "[2/3] Building production Next.js bundle..."
    npm run build
else
    echo "[2/3] Production build verified."
fi
cd ..

# 3. Launch Backend in background
echo "[3/3] Starting GodVid Backend Engine on port 8000..."
./venv/bin/python backend/run.py &
BACKEND_PID=$!

trap "kill $BACKEND_PID" EXIT

# 4. Launch Production Frontend
echo "Starting GodVid Web Application on port 3000..."
cd frontend
npm run start -- -p 3000
