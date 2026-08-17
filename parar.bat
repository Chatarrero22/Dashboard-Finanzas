@echo off
echo Cerrando las apps de finanzas...
taskkill /F /IM node.exe >nul 2>&1
echo Listo.
timeout /t 2 >nul
