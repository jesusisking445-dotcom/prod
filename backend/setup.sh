#!/bin/bash

# HomoDentHealth Backend - Setup Script
# Run this after cloning the repository

set -e

echo "🚀 HomoDentHealth Backend Setup"
echo "================================"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 16+"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi
echo "✅ npm $(npm -v)"

# Create logs directory
mkdir -p logs
echo "✅ Created logs directory"

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Update .env with your configuration before running the server"
else
    echo "✅ .env file exists"
fi

# Check MongoDB
echo ""
echo "🗄️  Database Setup"
echo "===================="
echo "Ensure MongoDB is running locally or update MONGODB_URI in .env"
echo "For Docker: docker run -d -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=admin123 mongo:6"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your MongoDB URI and SMTP credentials"
echo "2. Run database migrations: npm run migrate"
echo "3. Seed sample data: npm run seed"
echo "4. Start the server: npm run dev"
echo ""
