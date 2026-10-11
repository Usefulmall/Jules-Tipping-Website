@echo off
TITLE GitHub Initialization Automation Script
cls
echo ====================================================
echo        GitHub Initialization Automation Script
echo ====================================================
echo.

:: Check for Git installation
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git command line tools not found on your path.
    echo Please download and install Git from https://git-scm.com/
    pause
    exit /b 1
)

:: Check if directory is already a git folder
if exist .git (
    echo [WARNING] A .git folder already exists in this directory.
    set /p REINIT="Do you want to wipe it and re-initialize? (y/n): "
    if /I "%REINIT%"=="y" (
        rd /s /q .git
        echo Cleaned up previous local Git repository.
    ) else (
        echo Aborted script. No changes made.
        pause
        exit /b 0
    )
)

:: Prompt developer for their target repository
echo Please paste your GitHub Remote Repository URL:
echo (Example: https://github.com/username/repository-name.git)
echo.
set /p REPO_URL="Repository URL: "

if "%REPO_URL%"=="" (
    echo [ERROR] Repository URL cannot be empty.
    pause
    exit /b 1
)

echo.
echo [1/5] Initializing clean Git repository...
git init

echo.
echo [2/5] Staging folder files...
git add .

echo.
echo [3/5] Creating initial commit...
git commit -m "feat: initial commit of tipping portal codebase from Google AI Studio"

echo.
echo [4/5] Restructuring Default Branch to 'main'...
git branch -M main

echo.
echo [5/5] Mapping repository to origin URL...
git remote add origin %REPO_URL%

echo.
echo ====================================================
echo Ready to push files to: %REPO_URL%
echo Press any key to run 'git push -u origin main' or close this window to cancel.
echo ====================================================
pause

git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Your repository has been pushed to GitHub successfully.
    echo Visit your repository web page to view the files!
) else (
    echo.
    echo [ERROR] Something went wrong with the git push call.
    echo Check your terminal permissions, credentials, and network connectivity.
)
pause
