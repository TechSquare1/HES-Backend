@echo off
echo ===========================================
echo    HES BACKEND - RAILWAY DEPLOYMENT
echo ===========================================
echo.
echo This script will prepare your backend for Railway
echo Make sure you have:
echo - GitHub account
echo - Railway account (railway.app)
echo - Created GitHub repository: HES-Backend
echo.
pause

echo.
echo Step 1: Checking current directory...
cd /d "%~dp0"
echo Current directory: %CD%

echo.
echo Step 2: Installing dependencies...
call npm install

echo.
echo Step 3: Initializing Git repository...
if exist .git (
    echo Git repository already exists
) else (
    git init
)

echo.
echo Step 4: Adding files to Git...
git add .

echo.
echo Step 5: Committing files...
git commit -m "Deploy to Railway: HES Backend API"

echo.
echo ===========================================
echo         GIT SETUP COMPLETE!
echo ===========================================
echo.
echo Next steps:
echo 1. Create GitHub repository: HES-Backend (public)
echo 2. Run: git remote add origin https://github.com/YOUR_USERNAME/HES-Backend.git
echo 3. Run: git push -u origin master
echo 4. Go to railway.app and deploy from GitHub
echo 5. Set environment variables in Railway dashboard
echo.
echo Your backend code is ready for deployment!
echo.
pause
