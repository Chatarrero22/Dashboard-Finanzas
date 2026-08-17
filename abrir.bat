@echo off
REM Abre la app en el navegador. Si no esta corriendo, la arranca primero.
cd /d "%~dp0"
curl -s -o nul --max-time 2 http://localhost:3001/ 2>nul
if errorlevel 1 (
  echo Arrancando la app...
  cscript //nologo "%~dp0iniciar-oculto.vbs"
  timeout /t 5 >nul
)
start "" "http://localhost:3001"
exit
