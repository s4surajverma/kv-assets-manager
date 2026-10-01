@echo off
REM ============================================================
REM KVS Asset Management — Local Database Setup (Windows)
REM ============================================================
REM This script:
REM   1. Verifies NODE_ENV=development (safety guard)
REM   2. Locates PostgreSQL installation
REM   3. Drops the local dev database (if it exists)
REM   4. Recreates it fresh
REM   5. Runs all migrations sequentially via Node.js
REM
REM SAFETY: This ONLY targets the local development DB.
REM         Neon production DB is never touched.
REM ============================================================

setlocal enabledelayedexpansion

set DB_NAME=kvs_assets_dev
set DB_USER=postgres
set DB_HOST=localhost
set DB_PORT=5432

echo ============================================================
echo   KVS Asset Management - Local DB Setup
echo ============================================================
echo.

REM --- Step 0: NODE_ENV Safety Guard ---
if defined NODE_ENV (
    if /I not "%NODE_ENV%"=="development" (
        echo [ABORT] NODE_ENV is set to "%NODE_ENV%".
        echo         This script ONLY runs in development mode.
        echo         Set NODE_ENV=development or unset it to proceed.
        pause
        exit /b 1
    )
)
set NODE_ENV=development
echo [OK] NODE_ENV=development (safety guard passed)
echo.

REM --- Step 1: Find psql ---
set "PSQL_PATH="

REM Check PATH first
where psql >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "PSQL_PATH=psql"
    goto :found_psql
)

REM Search common install locations
for /d %%D in ("C:\Program Files\PostgreSQL\*") do (
    if exist "%%D\bin\psql.exe" (
        set "PSQL_PATH=%%D\bin\psql.exe"
        goto :found_psql
    )
)

REM Not found
echo [ERROR] PostgreSQL is not installed or psql is not in PATH.
echo.
echo Please install PostgreSQL from:
echo   https://www.postgresql.org/download/windows/
echo.
echo After installation, re-run this script.
pause
exit /b 1

:found_psql
echo [OK] Found psql: %PSQL_PATH%
echo.

REM --- Step 2: Set password ---
set PGPASSWORD=password

REM --- Step 3: Test connection ---
echo.
echo [INFO] Testing connection to PostgreSQL...
"%PSQL_PATH%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "SELECT 1;" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Cannot connect to PostgreSQL at %DB_HOST%:%DB_PORT% as user '%DB_USER%'.
    echo         Make sure the PostgreSQL service is running and the password is correct.
    pause
    exit /b 1
)
echo [OK] Connected to PostgreSQL.
echo.

REM --- Step 4: Drop existing database ---
echo [INFO] Dropping database '%DB_NAME%' if it exists...
"%PSQL_PATH%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "DROP DATABASE IF EXISTS %DB_NAME%;" 2>nul
echo [OK] Database dropped (or did not exist).

REM --- Step 5: Create fresh database ---
echo [INFO] Creating database '%DB_NAME%'...
"%PSQL_PATH%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "CREATE DATABASE %DB_NAME%;"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to create database.
    pause
    exit /b 1
)
echo [OK] Database '%DB_NAME%' created.
echo.

REM --- Step 6: Update .env with correct local password ---
echo [INFO] Updating .env with local DB connection string...
set "ENV_FILE=%~dp0server\.env"

REM Read existing .env and update DATABASE_URL_LOCAL line
set "TEMP_ENV=%~dp0server\.env.tmp"
(
    for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
        if "%%A"=="DATABASE_URL_LOCAL" (
            echo DATABASE_URL_LOCAL=postgresql://%DB_USER%:%PGPASSWORD%@%DB_HOST%:%DB_PORT%/%DB_NAME%
        ) else (
            echo %%A=%%B
        )
    )
) > "%TEMP_ENV%"
move /y "%TEMP_ENV%" "%ENV_FILE%" >nul

REM --- Step 7: Run all migrations via Node.js ---
echo [INFO] Running all database migrations...
echo.
cd /d "%~dp0server"
node migrate.js
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Migration failed. Check errors above.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   LOCAL DATABASE SETUP COMPLETE
echo ============================================================
echo.
echo   Database:  %DB_NAME%
echo   Host:      %DB_HOST%:%DB_PORT%
echo   User:      %DB_USER%
echo   Mode:      development (local)
echo.
echo   You can now run 'npm run dev' in the server directory.
echo ============================================================
echo.
pause
