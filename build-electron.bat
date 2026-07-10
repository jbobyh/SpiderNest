@echo off
chcp 65001 >nul 2>&1

echo === Electron build: SpiderNest ===
echo.

REM Check node_modules
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo.
echo Building portable EXE...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npx electron-builder --win portable
set BUILD_RESULT=%errorlevel%

echo.
if %BUILD_RESULT%==0 (
    echo === Done! ===
    echo Output: dist\SpiderNest.exe
) else (
    echo === Build failed! Exit code: %BUILD_RESULT% ===
)
echo.
pause
