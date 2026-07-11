@echo off
REM HomoDentHealth Backend - Windows Setup Script

echo.
echo 🚀 HomoDentHealth Backend Setup
echo ================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js 16+
    pause
    exit /b 1
)
echo ✅ Node.js is installed
node -v

REM Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm not found
    pause
    exit /b 1
)
echo ✅ npm is installed
npm -v

REM Create logs directory
if not exist "logs" mkdir logs
echo ✅ Created logs directory

REM Install dependencies
echo.
echo 📦 Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)
echo ✅ Dependencies installed

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo 📝 Creating .env file...
    copy .env.example .env
    echo ⚠️  Update .env with your configuration before running the server
) else (
    echo ✅ .env file exists
)

REM Check MongoDB
echo.
echo 🗄️  Database Setup
echo ====================
echo Ensure MongoDB is running locally or update MONGODB_URI in .env
echo For Docker: docker run -d -p 27017:27017 mongo:6
echo.

echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Update .env with your MongoDB URI and SMTP credentials
echo 2. Run database migrations: npm run migrate
echo 3. Seed sample data: npm run seed
echo 4. Start the server: npm run dev
echo.
pause
