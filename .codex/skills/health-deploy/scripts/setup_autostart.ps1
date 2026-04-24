param(
    [string]$ProjectPath = ""
)

if ([string]::IsNullOrEmpty($ProjectPath)) {
    # 脚本位于 .codex/skills/health-deploy/scripts/，向上 4 级为项目根目录
    $ProjectPath = (Get-Item "$PSScriptRoot\..\..\..\..").FullName
}

$taskName = "家庭健康档案"
$healthAppScriptDir = Join-Path $PSScriptRoot "..\..\health-app\scripts"
$vbsPath = (Resolve-Path (Join-Path $healthAppScriptDir "start_hidden.vbs")).Path

# 将项目路径写入环境变量（用户级）
[Environment]::SetEnvironmentVariable("HEALTH_PROJECT_PATH", $ProjectPath, "User")

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 0) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force

Write-Host "✓ 已注册开机自启任务：$taskName" -ForegroundColor Green
Write-Host "  项目路径：$ProjectPath"
Write-Host "  下次登录后将自动启动，或运行以下命令立即启动："
Write-Host "  Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Cyan
