@echo off
cd /d "%~dp0"
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
echo Set sh = CreateObject("WScript.Shell") > "%TEMP%\mkshortcut.vbs"
echo Set lnk = sh.CreateShortcut("%STARTUP%\Finanzas.lnk") >> "%TEMP%\mkshortcut.vbs"
echo lnk.TargetPath = "%~dp0iniciar-oculto.vbs" >> "%TEMP%\mkshortcut.vbs"
echo lnk.WorkingDirectory = "%~dp0" >> "%TEMP%\mkshortcut.vbs"
echo lnk.Description = "Finanzas" >> "%TEMP%\mkshortcut.vbs"
echo lnk.Save >> "%TEMP%\mkshortcut.vbs"
cscript //nologo "%TEMP%\mkshortcut.vbs"
del "%TEMP%\mkshortcut.vbs"
echo.
echo Listo: la app va a arrancar sola cada vez que prendas la PC.
echo Para desactivarlo, borra "Finanzas" de esta carpeta:
echo   %STARTUP%
echo.
pause
