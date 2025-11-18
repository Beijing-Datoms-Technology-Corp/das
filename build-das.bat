@echo off
REM DAS: Data Assets Studio Build Script (Windows)
REM This script builds the complete DAS IDE with all extensions

echo 🚀 Starting DAS Build Process...
echo ================================

REM Get script directory and root
set "SCRIPT_DIR=%~dp0"
set "ROOT=%SCRIPT_DIR%.."

echo Build root: %ROOT%

REM Check if we're in the right directory
if not exist "%ROOT%\package.json" (
    echo Error: Not in DAS root directory
    exit /b 1
)

if not exist "%ROOT%\product.json" (
    echo Error: Not in DAS root directory
    exit /b 1
)

echo.
echo Step 1: Installing root dependencies...
cd /d "%ROOT%"
call npm install

if %ERRORLEVEL% neq 0 (
    echo Error: Failed to install root dependencies
    exit /b 1
)

echo.
echo Step 2: Building das-core extension...
cd "%ROOT%\extensions\das-core"

if not exist "node_modules" (
    echo Installing das-core dependencies...
    call npm install
)

if %ERRORLEVEL% neq 0 (
    echo Error: Failed to install das-core dependencies
    exit /b 1
)

echo Compiling das-core extension...
call npm run compile

if %ERRORLEVEL% neq 0 (
    echo Error: Failed to compile das-core extension
    exit /b 1
)

echo ✓ das-core extension built successfully

REM Return to root
cd /d "%ROOT%"

echo.
echo Step 3: Running hygiene checks...
call npm run hygiene

if %ERRORLEVEL% neq 0 (
    echo Warning: Hygiene checks failed, but continuing...
)

echo.
echo Step 4: Starting main build process...
echo Running gulp build (this may take several minutes)...

call npm run gulp vscode-win32-x64

if %ERRORLEVEL% neq 0 (
    echo Error: Build failed
    exit /b 1
)

echo.
echo 🎉 DAS Build Completed Successfully!
echo.
echo Built artifacts should be available in the build output directory
echo You can now distribute the DAS IDE installer

pause
