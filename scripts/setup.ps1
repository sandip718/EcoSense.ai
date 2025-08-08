# EcoSense.ai Development Setup Script for Windows

Write-Host "🌱 Setting up EcoSense.ai development environment..." -ForegroundColor Green

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is installed
try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not installed. Please install Docker Compose first." -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ .env file created. Please update it with your configuration." -ForegroundColor Green
}

# Create directories
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
    Write-Host "📁 Created logs directory" -ForegroundColor Green
}

if (-not (Test-Path "uploads")) {
    New-Item -ItemType Directory -Path "uploads" | Out-Null
    Write-Host "📁 Created uploads directory" -ForegroundColor Green
}

# Install Node.js dependencies
Write-Host "📦 Installing Node.js dependencies..." -ForegroundColor Yellow
npm install

# Start Docker services
Write-Host "🐳 Starting Docker services..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Wait for services to be ready
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "🎉 Setup complete! Your development environment is ready." -ForegroundColor Green
Write-Host ""
Write-Host "Available services:" -ForegroundColor Cyan
Write-Host "  - Application: http://localhost:3000"
Write-Host "  - Database Admin: http://localhost:8080"
Write-Host "  - RabbitMQ Management: http://localhost:15672"
Write-Host "  - MailHog: http://localhost:8025"
Write-Host ""
Write-Host "To start developing:" -ForegroundColor Cyan
Write-Host "  npm run dev"
Write-Host ""
Write-Host "To run tests:" -ForegroundColor Cyan
Write-Host "  npm test"
Write-Host ""