@echo off
setlocal
set "GAME_PAGE=%~dp0..\LSindex.html"

if not exist "%GAME_PAGE%" (
  echo Could not find the game page:
  echo "%GAME_PAGE%"
  pause
  exit /b 1
)

start "" "%GAME_PAGE%"
