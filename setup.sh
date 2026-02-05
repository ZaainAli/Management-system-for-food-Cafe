#!/bin/bash

echo "🍽️  Restaurant Desktop App - Setup Script"
echo "==========================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ npm install failed. Please check your Node.js installation."
        exit 1
    fi
else
    echo "✓ Dependencies already installed"
fi

echo ""
echo "🔧 Rebuilding native modules for Electron..."
npm run rebuild

if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️  Native module rebuild failed!"
    echo ""
    echo "This usually happens due to missing build tools."
    echo "Please install the required build tools for your platform:"
    echo ""
    echo "  Linux:   sudo apt-get install build-essential python3"
    echo "  macOS:   xcode-select --install"
    echo "  Windows: npm install --global windows-build-tools"
    echo ""
    echo "After installing, run: npm run rebuild"
    echo ""
    read -p "Press Enter to try running the app anyway (may fail)..."
fi

echo ""
echo "🚀 Starting the application..."
echo ""
echo "Default login credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""

npm run dev
