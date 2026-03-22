@echo off
echo Starting BLITZ...

:: Start backend
start "BLITZ Backend" cmd /k "cd /d C:\Users\nihal\fantasy-optimizer\backend && venv\Scripts\activate && uvicorn server:app --reload --port 8000"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

:: Start frontend
start "BLITZ Frontend" cmd /k "cd /d C:\Users\nihal\fantasy-optimizer\frontend && if exist node_modules\.vite-temp rmdir /s /q node_modules\.vite-temp && npm run dev"

echo.
echo Backend starting on http://localhost:8000
echo Frontend starting on http://localhost:5173
echo.
echo Opening browser in 5 seconds...
timeout /t 5 /nobreak >nul
start http://localhost:5173