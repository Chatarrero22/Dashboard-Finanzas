@echo off
title Finanzas
cd /d "%~dp0"
if not exist logs mkdir logs
echo Arrancando en segundo plano...
cscript //nologo "%~dp0iniciar-oculto.vbs"
timeout /t 4 >nul
echo.
echo   En esta PC:  http://localhost:3001
echo   Desde el celular: mira la direccion 192.168... en logs\finanzas.log
echo.
echo Cada persona entra con su usuario y contrasena.
echo Se cierra con parar.bat
pause
