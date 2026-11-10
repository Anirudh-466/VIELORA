@echo off
title VEILORA — Push to GitHub
color 0B
cls

echo ===================================================================
echo     VEILORA — 1-Click Push to GitHub
echo ===================================================================
echo.
echo This script pushes clean source files to GitHub, automatically
echo excluding node_modules and large temporary files.
echo.
echo Please create a new repository on GitHub (https://github.com/new)
echo and paste the repository URL below.
echo.
echo Example: https://github.com/your-username/veilora.git
echo.
set /p REPO_URL="Enter your GitHub Repository URL: "

if "%REPO_URL%"=="" (
    echo.
    echo [ERROR] No URL entered. Operation cancelled.
    pause
    exit /b
)

echo.
echo [1/3] Staging clean source files...
git add .

echo [2/3] Setting default branch to main...
git branch -M main

echo [3/3] Linking remote and pushing to GitHub...
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================================
    echo  SUCCESS! Your code has been pushed to GitHub without large files.
    echo  You can now import your repository into Vercel (https://vercel.com/new).
    echo ===================================================================
) else (
    echo.
    echo ===================================================================
    echo  If push failed, make sure your GitHub repository is empty
    echo  and you are signed into Git/GitHub CLI.
    echo ===================================================================
)

echo.
pause
