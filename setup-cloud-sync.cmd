@echo off
rem Ember - one-time setup for automatic Garmin sync in the cloud (double-click to run)
setlocal
cd /d "%~dp0"
title Ember - cloud sync setup

if not exist ".venv-garmin\Scripts\python.exe" (
  echo Run sync-garmin.cmd once first: it sets things up and signs you in to Garmin.
  pause
  exit /b 1
)

".venv-garmin\Scripts\python.exe" tools\cloud_setup.py
echo.
pause
