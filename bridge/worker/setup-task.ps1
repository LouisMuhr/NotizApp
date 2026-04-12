# setup-task.ps1
# Registriert einen Windows Scheduled Task, der den Brainstorm-Worker stündlich ausführt.
#
# Ausführen (einmalig, als Administrator):
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#   .\bridge\worker\setup-task.ps1
#
# Was der Task tut:
#   Jede Stunde → `claude --print --file brainstorm-prompt.md` ausführen
#   Logs landen in bridge/worker/logs/brainstorm-<datum>.log

$ErrorActionPreference = "Stop"

$taskName    = "NotizApp-BrainstormWorker"
$workDir     = "C:\NotizApp\NotizApp"
$promptFile  = "bridge\worker\brainstorm-prompt.md"
$logDir      = Join-Path $workDir "bridge\worker\logs"
$claudeCmd   = Get-Command "claude.cmd" -ErrorAction SilentlyContinue
$claudeExe   = if ($claudeCmd) { $claudeCmd.Source } else { $null }

if (-not $claudeExe) {
    Write-Error "Claude Code CLI nicht gefunden. Stelle sicher, dass 'claude' im PATH ist."
    exit 1
}

# Log-Verzeichnis anlegen
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
    Write-Host "Log-Verzeichnis erstellt: $logDir"
}

# Action: claude --print --file brainstorm-prompt.md >> logs\brainstorm-<datum>.log
$action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c cd /d `"$workDir`" && type `"$promptFile`" | `"$claudeExe`" --print --dangerously-skip-permissions >> `"$logDir\brainstorm-%date:~-4,4%%date:~-7,2%%date:~-10,2%.log`" 2>&1" `
    -WorkingDirectory $workDir

# Trigger: jede Stunde, täglich
$trigger = New-ScheduledTaskTrigger `
    -RepetitionInterval (New-TimeSpan -Hours 1) `
    -Once `
    -At (Get-Date).Date.AddHours(9)   # Start: heute 09:00, danach stündlich

# Einstellungen: bei AC+Batterie laufen, Netz nicht zwingend nötig
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Unter aktuellem Benutzer ausführen (kein Admin-Kontext nötig für den Task selbst)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

# Eventuell bestehenden Task entfernen
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Alter Task '$taskName' entfernt."
}

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Brainstorm-Worker: gruppiert neue Thoughts zu Threads via Claude Code" | Out-Null

Write-Host ""
Write-Host "Task '$taskName' erfolgreich registriert." -ForegroundColor Green
Write-Host "  Interval: stündlich"
Write-Host "  Logs:     $logDir"
Write-Host ""
Write-Host "Jetzt sofort manuell ausführen (Test):"
Write-Host "  Start-ScheduledTask -TaskName '$taskName'"
Write-Host ""
Write-Host "Task wieder entfernen:"
Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
