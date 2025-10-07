# ==============================================
# Cine Vision - Development Startup Script
# ==============================================
# This script automates the process of starting backend and frontend

Write-Host "🎬 Cine Vision - Development Startup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Get project root
$projectRoot = Split-Path -Parent $PSScriptRoot

# Check if .env files exist
Write-Host "📋 Checking environment files..." -ForegroundColor Yellow

$backendEnv = Join-Path $projectRoot "backend\.env"
$frontendEnv = Join-Path $projectRoot "frontend\.env.local"

if (-Not (Test-Path $backendEnv)) {
    Write-Host "❌ Backend .env file not found!" -ForegroundColor Red
    Write-Host "   Please copy backend\.env.example to backend\.env and configure it" -ForegroundColor Red
    exit 1
}

if (-Not (Test-Path $frontendEnv)) {
    Write-Host "⚠️  Frontend .env.local not found!" -ForegroundColor Yellow
    Write-Host "   Creating from .env.example..." -ForegroundColor Yellow
    $frontendEnvExample = Join-Path $projectRoot "frontend\.env.example"
    if (Test-Path $frontendEnvExample) {
        Copy-Item $frontendEnvExample $frontendEnv
        Write-Host "✅ Created frontend\.env.local" -ForegroundColor Green
    }
}

Write-Host "✅ Environment files OK" -ForegroundColor Green
Write-Host ""

# Check if node_modules exist
Write-Host "📦 Checking dependencies..." -ForegroundColor Yellow

$backendModules = Join-Path $projectRoot "backend\node_modules"
$frontendModules = Join-Path $projectRoot "frontend\node_modules"

if (-Not (Test-Path $backendModules)) {
    Write-Host "⚠️  Backend dependencies not installed" -ForegroundColor Yellow
    Write-Host "   Installing backend dependencies..." -ForegroundColor Yellow
    Set-Location (Join-Path $projectRoot "backend")
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Backend dependencies installed" -ForegroundColor Green
}

if (-Not (Test-Path $frontendModules)) {
    Write-Host "⚠️  Frontend dependencies not installed" -ForegroundColor Yellow
    Write-Host "   Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location (Join-Path $projectRoot "frontend")
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
}

Write-Host "✅ Dependencies OK" -ForegroundColor Green
Write-Host ""

# Start backend
Write-Host "🚀 Starting backend..." -ForegroundColor Yellow
Set-Location (Join-Path $projectRoot "backend")

$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\backend'; Write-Host '🔧 Backend Server' -ForegroundColor Cyan; npm run start:dev" -PassThru

# Wait for backend to be healthy
Write-Host "⏳ Waiting for backend to be ready..." -ForegroundColor Yellow

$maxRetries = 30
$retryCount = 0
$backendReady = $false

while ($retryCount -lt $maxRetries) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method Get -TimeoutSec 2 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            break
        }
    } catch {
        # Backend not ready yet
    }
    $retryCount++
    Write-Host "   Attempt $retryCount/$maxRetries..." -ForegroundColor Gray
}

if (-Not $backendReady) {
    Write-Host "❌ Backend failed to start in time" -ForegroundColor Red
    Write-Host "   Check the backend terminal for errors" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Backend is healthy!" -ForegroundColor Green
Write-Host ""

# Start frontend
Write-Host "🚀 Starting frontend..." -ForegroundColor Yellow
Set-Location (Join-Path $projectRoot "frontend")

$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\frontend'; Write-Host '⚛️  Frontend Server' -ForegroundColor Cyan; npm run dev" -PassThru

# Wait a bit for frontend to start
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "✅ All services started successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📡 Services running:" -ForegroundColor Cyan
Write-Host "   Backend:  http://localhost:3001" -ForegroundColor White
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "   Health:   http://localhost:3001/health" -ForegroundColor White
Write-Host "   API Docs: http://localhost:3001/api" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Opening browser..." -ForegroundColor Yellow

Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "✨ Development environment is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Cyan
Write-Host "   - Backend and frontend terminals are open in separate windows" -ForegroundColor White
Write-Host "   - Changes will hot-reload automatically" -ForegroundColor White
Write-Host "   - Press Ctrl+C in each terminal to stop servers" -ForegroundColor White
Write-Host ""
Write-Host "📚 See DEVELOPMENT.md for more information" -ForegroundColor Cyan
Write-Host ""

# Keep this window open
Write-Host "Press any key to exit this window (servers will continue running)..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
