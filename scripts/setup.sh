#!/bin/bash

# EcoSense.ai Development Setup Script

set -e

echo "🌱 Setting up EcoSense.ai development environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please update it with your configuration."
fi

# Create logs directory
mkdir -p logs
echo "📁 Created logs directory"

# Create uploads directory
mkdir -p uploads
echo "📁 Created uploads directory"

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check if PostgreSQL is ready
echo "🔍 Checking PostgreSQL connection..."
until docker-compose exec postgres pg_isready -U postgres -d ecosense_ai; do
    echo "Waiting for PostgreSQL..."
    sleep 5
done

echo "✅ PostgreSQL is ready"

# Check if Redis is ready
echo "🔍 Checking Redis connection..."
until docker-compose exec redis redis-cli ping; do
    echo "Waiting for Redis..."
    sleep 5
done

echo "✅ Redis is ready"

echo ""
echo "🎉 Setup complete! Your development environment is ready."
echo ""
echo "Available services:"
echo "  - Application: http://localhost:3000"
echo "  - Database Admin: http://localhost:8080"
echo "  - RabbitMQ Management: http://localhost:15672"
echo "  - MailHog: http://localhost:8025"
echo ""
echo "To start developing:"
echo "  npm run dev"
echo ""
echo "To run tests:"
echo "  npm test"
echo ""