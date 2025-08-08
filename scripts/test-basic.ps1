# Basic EcoSense.ai Testing Script

Write-Host "🧪 Running Basic EcoSense.ai Tests..." -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

$allPassed = $true

# Test 1: TypeScript Build
Write-Host "1. Testing TypeScript compilation..." -ForegroundColor Yellow
try {
    $buildResult = cmd /c "npm run build" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Build successful" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Build failed" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "   ❌ Build test failed" -ForegroundColor Red
    $allPassed = $false
}

# Test 2: Code Linting
Write-Host "2. Testing code quality..." -ForegroundColor Yellow
try {
    $lintResult = cmd /c "npm run lint" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Linting passed" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Linting failed" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "   ❌ Lint test failed" -ForegroundColor Red
    $allPassed = $false
}

# Test 3: Unit Tests
Write-Host "3. Running unit tests..." -ForegroundColor Yellow
try {
    $testResult = cmd /c "npm test" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Unit tests passed" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Unit tests failed" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "   ❌ Unit tests failed" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""
if ($allPassed) {
    Write-Host "🎉 All basic tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Start Docker services: docker-compose up -d"
    Write-Host "2. Start development: npm run dev"
} else {
    Write-Host "❌ Some tests failed. Please check the output above." -ForegroundColor Red
}

Write-Host ""
Write-Host "Available commands:" -ForegroundColor Gray
Write-Host "  npm run build    # Build TypeScript"
Write-Host "  npm run lint     # Check code quality"
Write-Host "  npm test         # Run unit tests"
Write-Host "  npm run dev      # Start development server"