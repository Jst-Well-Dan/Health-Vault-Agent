Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
projectPath = WshShell.ExpandEnvironmentStrings("%HEALTH_PROJECT_PATH%")
If projectPath = "%HEALTH_PROJECT_PATH%" Then
    ' 脚本位于 .codex/skills/health-app/scripts/，向上 4 级为项目根目录
    scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
    projectPath = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(scriptDir))))
End If
WshShell.Run "cmd /c cd /d """ & projectPath & "\backend"" && python -m uvicorn main:app --host 0.0.0.0 --port 8000", 0, False
