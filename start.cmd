@echo off
rem Splunk Infrastructure Studio - double-click launcher.
rem ASCII text only: cmd.exe cannot render Persian. All Persian output comes from scripts\run.mjs.
setlocal
set "NODE_EXE="

where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%USERPROFILE%\Documents\Qoder\tools\node\node.exe" set "NODE_EXE=%USERPROFILE%\Documents\Qoder\tools\node\node.exe"
if not defined NODE_EXE if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"

if not defined NODE_EXE (
  echo [!] node.exe not found.
  echo     Option 1: install Node.js 22+ from https://nodejs.org and tick "Add to PATH",
  echo               then run this file again.
  echo     Option 2: point the line below at your own node.exe:
  echo               set "NODE_EXE=C:\path\to\node.exe"
  echo.
  pause
  exit /b 1
)

"%NODE_EXE%" "%~dp0scripts\run.mjs" %*
if errorlevel 1 pause
