# setup-task.ps1
# Registriert einen Windows Scheduled Task, der den Brainstorm-Worker taeglich um 21:00 ausfuehrt.
#
# Ausfuehren (einmalig, als Administrator):
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#   .\bridge\worker\setup-task.ps1
#
# Was der Task tut:
#   Taeglich 21:00 -> `claude --print --file brainstorm-prompt.md` ausfuehren
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

# Trigger: taeglich um 21:00
$trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At "21:00"

# Einstellungen: bei AC+Batterie laufen, Netz nicht zwingend noetig
$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

# Unter aktuellem Benutzer ausfuehren (kein Admin-Kontext noetig fuer den Task selbst)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

# Eventuell bestehenden Task entfernen (kann fehlschlagen wenn Task unter anderem Kontext registriert)
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
        Write-Host "Alter Task '$taskName' entfernt."
    } catch {
        Write-Warning "Task konnte nicht entfernt werden (kein Zugriff) - wird mit -Force ueberschrieben. Fehler: $_"
    }
}

try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Brainstorm-Worker: gruppiert neue Thoughts zu Threads via Claude Code" `
        -Force -ErrorAction Stop | Out-Null
} catch {
    Write-Host ""
    Write-Error ("Registrierung fehlgeschlagen: $_`n`n" +
        "Der Task '$taskName' existiert unter einem anderen Sicherheitskontext (z.B. SYSTEM/Administrator).`n" +
        "Loesung: Dieses Skript als Administrator ausfuehren:`n" +
        "  Start-Process powershell -Verb RunAs -ArgumentList '-File ""$PSCommandPath""'")
    exit 1
}

Write-Host ""
Write-Host "Task '$taskName' erfolgreich registriert." -ForegroundColor Green
Write-Host "  Zeitplan: taeglich 21:00"
Write-Host "  Logs:     $logDir"
Write-Host ""
Write-Host "Jetzt sofort manuell ausfuehren (Test):"
Write-Host "  Start-ScheduledTask -TaskName '$taskName'"
Write-Host ""
Write-Host "Task wieder entfernen:"
Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
