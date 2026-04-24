$taskName = "家庭健康档案"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host "✓ 已移除开机自启任务：$taskName" -ForegroundColor Yellow
