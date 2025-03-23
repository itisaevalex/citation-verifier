# Citation Verifier Stop Script
# Stops all components: Node.js servers and GROBID Docker container

Write-Host "`n=== TruthSource: Citation Verifier - Shutdown ===" -ForegroundColor Cyan
Write-Host "This script will shut down all components`n" -ForegroundColor Cyan

# Step 1: Find and kill all Node.js processes
Write-Host "Step 1: Shutting down Node.js servers..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $count = $nodeProcesses.Count
    Write-Host "  Found $count Node.js process(es) to stop" -ForegroundColor Yellow
    foreach ($process in $nodeProcesses) {
        Write-Host "  Stopping Node.js process ID: $($process.Id)" -ForegroundColor Yellow
        Stop-Process -Id $process.Id -Force
    }
    Write-Host "  All Node.js processes stopped" -ForegroundColor Green
} else {
    Write-Host "  No Node.js processes found running" -ForegroundColor Yellow
}

# Step 2: Check if GROBID container is running and stop it
Write-Host "`nStep 2: Checking GROBID container..." -ForegroundColor Yellow
$grobidRunning = docker ps --filter "name=grobid" --format "{{.Names}}" 2>$null

if ($grobidRunning -eq "grobid") {
    Write-Host "  Stopping GROBID container..." -ForegroundColor Yellow
    docker stop grobid
    Write-Host "  GROBID container stopped" -ForegroundColor Green
} else {
    Write-Host "  GROBID container is not running" -ForegroundColor Yellow
}

Write-Host "`n=== All Components Stopped ===`n" -ForegroundColor Green
Write-Host "You can now close any remaining terminal windows.`n" -ForegroundColor Yellow
