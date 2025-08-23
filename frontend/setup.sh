#!/bin/bash

echo "Setting up EcoSense.ai Frontend Dashboard..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "Node.js version: $(node -v) ✓"

# Install dependencies
echo "Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "Dependencies installed successfully ✓"
    echo ""
    echo "Setup complete! You can now start the development server with:"
    echo "  npm run dev"
    echo ""
    echo "The dashboard will be available at: http://localhost:3000"
else
    echo "Error: Failed to install dependencies"
    exit 1
fi