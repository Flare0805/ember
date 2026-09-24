@echo off
rem Ember - download Garmin data and put a copy in OneDrive\Ember so you can import it on your iPhone
call "%~dp0sync-garmin.cmd" --onedrive %*
