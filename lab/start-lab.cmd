@echo off
rem Splunk Infrastructure Studio - double-click launcher for the isolated laboratory.
rem ASCII text only: cmd.exe cannot render Persian. All Persian output comes from lab\start-lab.mjs.
setlocal
set "NODE_EXE="

where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%USERPROFILE%\Documents\Qoder\tools\node\node.exe" set "NODE_EXE=%USERPROFILE%\Documents\Qoder\tools\node\node.exe"
if not defined NODE_EXE if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"

if not defined NODE_EXE (
  echo [!] node.exe not found.
  echo     Install Node.js 22+ from https://nodejs.org and tick "Add to PATH",
  echo     or point a NODE_EXE line above at your own node.exe.
  echo.
  pause
  exit /b 1
)

"%NODE_EXE%" "%~dp0start-lab.mjs" %*
if errorlevel 1 pause
