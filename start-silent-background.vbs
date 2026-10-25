' GodVid Silent Background Runner
' Starts the GodVid backend engine on port 8000 with zero visible console windows.
' Designed for 24/7 always-on operation.

Option Explicit
Dim WshShell, fso, currentDir, pythonExe, runPy

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
pythonExe = currentDir & "\venv\Scripts\python.exe"
runPy = currentDir & "\backend\run.py"

If Not fso.FileExists(pythonExe) Then
    ' Fallback to system python if venv not present
    pythonExe = "python"
End If

' Set working directory to project root
WshShell.CurrentDirectory = currentDir

' Launch backend process hidden (0 = hide window, False = return immediately)
WshShell.Run """" & pythonExe & """ """ & runPy & """", 0, False
