# PowerShell setup script for EcoSense.ai Frontend Dashboard

Write-Host "Setting up EcoSense.ai Frontend Dashboard..." -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node -v
    Write-Host "Node.js version: $nodeVersion ✓" -ForegroundColor Green
    
    # Check if version is 18+
    $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($versionNumber -lt 18) {
        Write-Host "Error: Node.js version 18+ is required. Current version: $nodeVersion" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error: Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "Dependencies installed successfully ✓" -ForegroundColor Green
    Write-Host ""
    Write-Host "Setup complete! You can now start the development server with:" -ForegroundColor Green
    Write-Host "  npm run dev" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The dashboard will be available at: http://localhost:3000" -ForegroundColor Cyan
} else {
    Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
    exit 1
}