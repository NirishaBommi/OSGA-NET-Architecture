@echo off
setlocal
cd /d "%~dp0osga_net"

echo =====================================================================
echo   OSGA-Net: Pediatric Bone Age Assessment Workstation
echo   Research Prototype - Real-Time PyTorch Inference Platform
echo =====================================================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found in osga_net\.venv.
    echo Please create it and run: pip install -r requirements.txt
    pause
    exit /b 1
)

echo [1/2] Activating Python virtual environment...
call .venv\Scripts\activate.bat

echo [2/2] Launching OSGA-Net Workstation Server on http://127.0.0.1:8000 ...
echo [INFO] API docs available at: http://127.0.0.1:8000/docs
echo [INFO] Press Ctrl+C in this terminal window to stop the server.
echo.

start http://127.0.0.1:8000
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

pause
