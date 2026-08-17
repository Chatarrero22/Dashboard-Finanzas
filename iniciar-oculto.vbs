' Arranca la app SIN ventanas de consola.
' Un solo proceso atiende a todas las personas (cada una entra con su usuario).
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
carpeta = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = carpeta
If Not fso.FolderExists(carpeta & "\logs") Then fso.CreateFolder(carpeta & "\logs")
sh.Run "cmd /c node server\index.js >> logs\finanzas.log 2>&1", 0, False
