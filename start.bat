@echo off
echo ===================================================
echo Starting Batch Video Downloader (GodVid)
echo ===================================================

if not exist "venv\Scripts\python.exe" (
    echo Python virtual environment not found. Creating venv...
    python -m venv venv
    call .\venv\Scripts\pip install -r backend\requirements.txt
)

echo Starting Backend API server on http://localhost:8000...
start "GodVid Backend" cmd /k ".\venv\Scripts\python backend\run.py"

echo Starting Frontend Dev server on http://localhost:3000...
cd frontend
if not exist "node_modules" (
    echo Installing node dependencies...
    call npm install
)
call npm run dev -- -p 3000
