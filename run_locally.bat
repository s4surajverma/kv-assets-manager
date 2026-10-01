@echo off
title KVS Asset Management - Local Server
echo ============================================
echo   KVS Asset Management System
echo   Starting Local Development Servers...
echo ============================================
echo.

:: Kill any existing node processes
echo [1/4] Stopping existing Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Check if .env exists for server
if not exist "server\.env" (
    echo [!] server\.env not found. Creating from .env.example...
    copy "server\.env.example" "server\.env" >nul
    echo [!] EDIT server\.env with your database credentials before running!
    echo.
)

:: Install dependencies if node_modules missing
if not exist "server\node_modules" (
    echo [2/4] Installing server dependencies...
    cd server && npm install && cd ..
) else (
    echo [2/4] Server dependencies OK.
)

if not exist "client\node_modules" (
    echo [3/4] Installing client dependencies...
    cd client && npm install && cd ..
) else (
    echo [3/4] Client dependencies OK.
)

:: Start backend server
echo [4/4] Starting servers...
echo.
echo   Backend  : http://localhost:5000
echo   Frontend : http://localhost:3000
echo.
echo   Press Ctrl+C to stop both servers.
echo ============================================
echo.

:: Start backend in background, frontend in foreground
start "KVS-Backend" /min cmd /c "cd /d %~dp0server && npm run dev"
timeout /t 3 /nobreak >nul

:: Start frontend (foreground - keeps window open)
cd /d %~dp0client
npm run dev
