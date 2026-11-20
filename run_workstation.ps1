# OSGA-Net Bone Age Workstation Launcher
$projectDir = Join-Path $PSScriptRoot "osga_net"
Set-Location -Path $projectDir

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "  OSGA-Net: Pediatric Bone Age Assessment Workstation" -ForegroundColor Cyan
Write-Host "  Research Prototype - Real-Time PyTorch Inference Platform" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

$venvPython = Join-Path $projectDir ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "[ERROR] Virtual environment not found at $venvPython" -ForegroundColor Red
    exit 1
}

Write-Host "[1/2] Activating Python environment..." -ForegroundColor Green
$env:PYTHONPATH = $projectDir

Write-Host "[2/2] Launching OSGA-Net Workstation on http://127.0.0.1:8000 ..." -ForegroundColor Green
Write-Host "[INFO] API Docs: http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host "[INFO] Press Ctrl+C in this console to stop the server." -ForegroundColor Yellow
Write-Host ""

Start-Process "http://127.0.0.1:8000"
& $venvPython -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
