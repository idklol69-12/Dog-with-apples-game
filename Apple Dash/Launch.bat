@echo off
setlocal
set "GAME_PAGE=%~dp0..\index.html"
set "GAME_URL=file:///%GAME_PAGE:\=/%"

if not exist "%GAME_PAGE%" (
  echo Could not find the game page:
  echo "%GAME_PAGE%"
  pause
  exit /b 1
)

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  set "GAME_BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  set "GAME_BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  set "GAME_BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
  set "GAME_BROWSER=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
) else (
  echo Could not find Microsoft Edge or Google Chrome to run the game app.
  pause
  exit /b 1
)

start "" "%GAME_BROWSER%" --app="%GAME_URL%"
