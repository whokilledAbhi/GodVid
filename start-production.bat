@echo off
setlocal
echo ===================================================
echo Starting GodVid - High-Performance Video Downloader
echo [PRODUCTION MODE]
echo ===================================================

cd /d "%~dp0"

REM 1. Verify / Setup Python Environment
if not exist "venv\Scripts\python.exe" (
    echo [1/3] Python virtual environment not found. Initializing venv...
    python -m venv venv
    call .\venv\Scripts\pip install --no-cache-dir -r backend\requirements.txt
) else (
    echo [1/3] Python environment verified.
)

REM 2. Verify / Build Production Frontend
cd frontend
if not exist "node_modules" (
    echo [2/3] Installing frontend dependencies...
    call npm ci || call npm install
)

if not exist ".next\BUILD_ID" (
    echo [2/3] Building production Next.js optimized bundle...
    call npm run build
) else (
    echo [2/3] Production build verified.
)
cd ..

REM 3. Launch Backend Service
echo [3/3] Starting GodVid Backend Service on http://127.0.0.1:8000...
start "GodVid Backend Engine" cmd /k ".\venv\Scripts\python backend\run.py"

REM 4. Launch Production Frontend Server
echo Starting GodVid Web Application on http://localhost:3000...
cd frontend
call npm run start -- -p 3000
