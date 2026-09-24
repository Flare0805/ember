@echo off
rem Ember - download your Garmin health data (double-click to run)
setlocal
cd /d "%~dp0"
title Ember - Garmin sync

set "PY="
py -3 -c "import sys" >nul 2>nul && set "PY=py -3"
if not defined PY python -c "import sys" >nul 2>nul && set "PY=python"
if not defined PY (
  echo Python is not installed on this PC.
  echo Install it once by running this in a terminal:
  echo.
  echo     winget install Python.Python.3.12
  echo.
  echo Then close this window and run sync-garmin again.
  pause
  exit /b 1
)

if not exist ".venv-garmin\Scripts\python.exe" (
  echo Setting up the Garmin downloader - first run only...
  %PY% -m venv .venv-garmin || goto :fail
  ".venv-garmin\Scripts\python.exe" -m pip install --quiet --upgrade pip
  ".venv-garmin\Scripts\python.exe" -m pip install --quiet garminconnect || goto :fail
  echo.
)

".venv-garmin\Scripts\python.exe" tools\garmin_sync.py %*
echo.
pause
exit /b 0

:fail
echo.
echo Setup failed. Check your internet connection and try again.
pause
exit /b 1
