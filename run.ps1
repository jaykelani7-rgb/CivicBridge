# PowerShell Launcher for CivicBridge AI Policy + Impact Service
$ErrorActionPreference = "Stop"

Write-Host "🚀 Launching CivicBridge AI Policy + Impact Service (Sharmad)..." -ForegroundColor Green

$VenvPython = "C:\googlehacka\.venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "Creating Virtual Environment..." -ForegroundColor Yellow
    python -m venv C:\googlehacka\.venv
    & $VenvPython -m pip install -r C:\googlehacka\requirements.txt
}

$env:PYTHONPATH = "C:\googlehacka"

Write-Host "🌱 Seeding demo data..." -ForegroundColor Cyan
& $VenvPython C:\googlehacka\scripts\seed_demo_data.py

Write-Host "🌐 Starting FastAPI Server on http://127.0.0.1:8000 (Docs: http://127.0.0.1:8000/docs)..." -ForegroundColor Green
& $VenvPython -m uvicorn services.policy_impact.app.main:app --host 127.0.0.1 --port 8000 --reload
