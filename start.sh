#!/usr/bin/env bash
set -e

echo "==================================================="
echo "Starting Batch Video Downloader (GodVid)"
echo "==================================================="

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install -r backend/requirements.txt
fi

echo "Starting Backend API server on http://localhost:8000..."
./venv/bin/python backend/run.py &
BACKEND_PID=$!

echo "Starting Frontend Dev server on http://localhost:3000..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run dev -- -p 3000 &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
