# Citation Verifier Start Script
# Starts the GROBID service, backend server, and frontend development server

# Check if GROBID is running
function Check-Grobid {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8070/api/isalive" -Method GET -TimeoutSec 5
        if ($response.Content -eq "true") {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

# Check if Docker is running
function Check-Docker {
    try {
        $dockerInfo = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

# Title and introduction
Write-Host "`n=== TruthSource: Citation Verifier - Quick Start ===" -ForegroundColor Cyan
Write-Host "This script will help you start all the necessary components`n" -ForegroundColor Cyan

# Step 1: Check if GROBID is running, start if necessary
Write-Host "Step 1: Checking GROBID service..." -ForegroundColor Yellow
$grobidRunning = Check-Grobid

if (-not $grobidRunning) {
    Write-Host "  GROBID is not running. Attempting to start with Docker..." -ForegroundColor Yellow
    
    # Check if Docker is running
    $dockerRunning = Check-Docker
    
    if (-not $dockerRunning) {
        Write-Host "  [ERROR] Docker is not running. Please start Docker and try again." -ForegroundColor Red
        exit 1
    }
    
    # Check if grobid container exists
    $containerExists = docker ps -a --filter "name=grobid" --format "{{.Names}}" 2>&1
    
    if ($containerExists -eq "grobid") {
        Write-Host "  Starting existing GROBID container..." -ForegroundColor Yellow
        docker start grobid
    } else {
        Write-Host "  Creating and starting GROBID container..." -ForegroundColor Yellow
        docker run -p 8070:8070 -d --name grobid lfoppiano/grobid:0.7.2
    }
    
    # Wait for GROBID to start
    Write-Host "  Waiting for GROBID to start (this may take a minute)..." -ForegroundColor Yellow
    $maxRetries = 20
    $retryCount = 0
    $grobidReady = $false
    
    while (-not $grobidReady -and $retryCount -lt $maxRetries) {
        Start-Sleep -Seconds 3
        $grobidReady = Check-Grobid
        $retryCount++
        Write-Host "  Checking GROBID status... Attempt $retryCount of $maxRetries" -ForegroundColor Yellow
    }
    
    if ($grobidReady) {
        Write-Host "  ✅ GROBID is now running!" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] GROBID failed to start after multiple attempts. Please check Docker logs." -ForegroundColor Red
        Write-Host "  Try running: docker logs grobid" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "  ✅ GROBID is already running!" -ForegroundColor Green
}

# Step 2: Start the backend server
Write-Host "`nStep 2: Starting the backend server..." -ForegroundColor Yellow

# Check if .env file exists
if (-not (Test-Path -Path ".env")) {
    Write-Host "  [WARNING] .env file not found. Creating a basic .env file..." -ForegroundColor Yellow
    @"
GROBID_URL=http://localhost:8070
NODE_ENV=development
PORT=3000
# Add your GEMINI_API_KEY here
GEMINI_API_KEY=
"@ | Out-File -FilePath ".env" -Encoding utf8
    
    Write-Host "  Created .env file. Please edit it to add your Gemini API key." -ForegroundColor Yellow
}

# Start the backend in a new PowerShell window
Write-Host "  Starting backend server..." -ForegroundColor Yellow
Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; node server.js"

# Step 3: Start the frontend development server
Write-Host "`nStep 3: Starting the frontend development server..." -ForegroundColor Yellow

# Check if frontend directory exists
if (-not (Test-Path -Path "frontend")) {
    Write-Host "  [ERROR] Frontend directory not found. Please check your project structure." -ForegroundColor Red
    exit 1
}

# Start the frontend in a new PowerShell window
Write-Host "  Starting frontend development server..." -ForegroundColor Yellow
Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; npm run dev"

# Final instructions
Write-Host "`n=== All Components Started ===`n" -ForegroundColor Green
Write-Host "📊 Backend server: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🌐 Frontend application: http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔬 GROBID service: http://localhost:8070" -ForegroundColor Cyan
Write-Host "`nYou can close this window, but keep the other terminal windows open to keep the services running.`n" -ForegroundColor Yellow
