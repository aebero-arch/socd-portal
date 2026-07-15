@echo off
title SOCD Portal - Startup Script
echo ==========================================
echo       STARTING SOCD PORTAL SERVERS
echo ==========================================

:: 1. Check Python Virtual Environment
if not exist ".venv" (
    echo [1/4] Creating Python virtual environment...
    python -m venv .venv
)

echo [2/4] Activating virtual environment and checking dependencies...
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend/requirements.txt

:: 2. Check Node Dependencies
if not exist "node_modules" (
    echo [3/4] Installing Node dependencies...
    npm install
) else (
    echo [3/4] Node dependencies already installed.
)

echo [4/4] Starting servers...

:: Start FastAPI backend in a separate terminal window
echo Starting FastAPI Backend...
start "SOCD Portal Backend" cmd /k "call .venv\Scripts\activate.bat && cd backend && uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

:: Start Next.js frontend in the current window
echo Starting Next.js Frontend...
echo The portal will be available at http://localhost:3000
npm run dev

pause
