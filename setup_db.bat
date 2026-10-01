@echo off
title KVS - Database Setup
echo ============================================
echo   KVS Asset Management - Database Setup
echo ============================================
echo.
echo This script sets up the database schema and
echo loads test data into your PostgreSQL instance.
echo.
echo You can use a FREE cloud database from:
echo   https://neon.tech  (sign up with GitHub)
echo.
echo After creating a Neon project, copy the
echo connection string and update server\.env
echo.
echo ============================================
echo.

:: Check if .env exists
if not exist "server\.env" (
    copy "server\.env.example" "server\.env"
    echo Created server\.env from template.
    echo.
)

:: Prompt for connection string
set /p DB_URL="Paste your PostgreSQL connection URL (or press Enter to use server\.env): "

if "%DB_URL%"=="" (
    echo Using connection from server\.env...
    echo.
    echo Make sure your server\.env has correct DB credentials.
    echo Then run these SQL files manually in your DB console:
    echo.
    echo   1. db\001_schema.sql
    echo   2. db\002_triggers.sql
    echo   3. db\003_seed.sql
    echo.
    echo You can paste them directly into:
    echo   - Neon SQL Editor (https://console.neon.tech)
    echo   - pgAdmin Query Tool
    echo   - psql CLI
    echo.
    pause
    exit /b
)

:: Run SQL files using psql
echo.
echo Running schema...
psql "%DB_URL%" -f db\001_schema.sql
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Schema failed. Check your connection URL.
    pause
    exit /b 1
)

echo Running triggers...
psql "%DB_URL%" -f db\002_triggers.sql
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Triggers failed.
    pause
    exit /b 1
)

echo Running seed data...
psql "%DB_URL%" -f db\003_seed.sql
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Seed failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   DATABASE SETUP COMPLETE!
echo ============================================
echo.
echo   Now update server\.env with:
echo     DB_HOST=your-neon-host.neon.tech
echo     DB_NAME=your-db-name
echo     DB_USER=your-username
echo     DB_PASSWORD=your-password
echo     DB_PORT=5432
echo.
echo   Or set DATABASE_URL in .env for Neon:
echo     DATABASE_URL=%DB_URL%
echo.
echo   Test login: admin@kvs.gov.in / test1234
echo ============================================
pause
