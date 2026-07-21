<#
.SYNOPSIS
    Predictive Digital Twin SOC - Windows Collector Installer

.DESCRIPTION
    Installs the Windows Event Log collector as a Windows Scheduled Task that
    runs at logon and forwards Security/System/Application events to the SOC
    ingestion endpoint.

.PARAMETER IngestUrl
    The Supabase Edge Function URL (e.g. https://<project>.supabase.co/functions/v1/logs-ingest)

.PARAMETER ApiKey
    The collector API key generated from the SOC Integrations page.

.PARAMETER InstallDir
    Directory to install the collector (default: C:\ProgramData\SOC-Collector)

.EXAMPLE
    .\install.ps1 -IngestUrl "https://xyz.supabase.co/functions/v1/logs-ingest" -ApiKey "soc_xxxxxxxx"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$IngestUrl,

    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [string]$InstallDir = "C:\ProgramData\SOC-Collector"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SOC Windows Collector Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# --- Check Administrator ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Please run this script as Administrator." -ForegroundColor Red
    exit 1
}

# --- Check Python ---
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    $python = Get-Command python3 -ErrorAction SilentlyContinue
}
if (-not $python) {
    Write-Host "ERROR: Python is not installed. Install Python 3.10+ from https://python.org" -ForegroundColor Red
    Write-Host "Make sure to check 'Add Python to PATH' during installation." -ForegroundColor Yellow
    exit 1
}

$pyExe = $python.Source
Write-Host "Python found: $pyExe" -ForegroundColor Green

# --- Create install directory ---
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Write-Host "Created install directory: $InstallDir"
}

# --- Copy collector files ---
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$filesToCopy = @("collector.py", "config.json", "requirements.txt")
foreach ($file in $filesToCopy) {
    $src = Join-Path $scriptDir $file
    if (Test-Path $src) {
        Copy-Item $src -Destination $InstallDir -Force
        Write-Host "Copied $file"
    } else {
        Write-Host "WARNING: $file not found in script directory. Download from your SOC portal." -ForegroundColor Yellow
    }
}

# --- Install Python dependencies ---
Write-Host "`nInstalling Python dependencies..." -ForegroundColor Cyan
& $pyExe -m pip install -r (Join-Path $InstallDir "requirements.txt") --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Some dependencies may not have installed correctly." -ForegroundColor Yellow
}

# --- Write config.json with provided values ---
$configPath = Join-Path $InstallDir "config.json"
$config = @{
    ingest_url = $IngestUrl
    api_key = $ApiKey
    hostname = $env:COMPUTERNAME
    channels = @("Security", "System", "Application")
    poll_interval = 5
    batch_size = 100
    checkpoint_dir = (Join-Path $InstallDir "checkpoints")
    log_file = (Join-Path $InstallDir "collector.log")
    log_level = "INFO"
}
$config | ConvertTo-Json -Depth 3 | Set-Content $configPath -Encoding UTF8
Write-Host "Config written to $configPath" -ForegroundColor Green

# --- Enable required audit policies ---
Write-Host "`nEnabling Windows Audit Policies..." -ForegroundColor Cyan
auditpol /set /subcategory:"Logon" /success:enable /failure:enable | Out-Null
auditpol /set /subcategory:"Logoff" /success:enable /failure:enable | Out-Null
auditpol /set /subcategory:"Process Creation" /success:enable /failure:enable | Out-Null
auditpol /set /subcategory:"Security State Change" /success:enable /failure:enable | Out-Null
auditpol /set /subcategory:"User Account Management" /success:enable /failure:enable | Out-Null
auditpol /set /subcategory:"Security Group Management" /success:enable /failure:enable | Out-Null
Write-Host "Audit policies enabled." -ForegroundColor Green

# --- Create Scheduled Task ---
$taskName = "SOC-Collector"
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Removed existing scheduled task."
}

$action = New-ScheduledTaskAction -Execute $pyExe -Argument "collector.py --config config.json" -WorkingDirectory $InstallDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Predictive Digital Twin SOC - Windows Event Log Collector" | Out-Null
Write-Host "Scheduled task '$taskName' created (runs as SYSTEM at startup)." -ForegroundColor Green

# --- Start the task now ---
Start-ScheduledTask -TaskName $taskName
Write-Host "Collector started." -ForegroundColor Green

# --- Verify ---
Start-Sleep -Seconds 3
$task = Get-ScheduledTask -TaskName $taskName
$taskInfo = $task | Get-ScheduledTaskInfo
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Install Dir:  $InstallDir"
Write-Host "Config:       $configPath"
Write-Host "Log File:     $(Join-Path $InstallDir 'collector.log')"
Write-Host "Task Name:    $taskName"
Write-Host "Last Result:  $($taskInfo.LastTaskResult)"
Write-Host ""
Write-Host "The collector is now running and forwarding events to:" -ForegroundColor White
Write-Host "  $IngestUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "To verify, create a test event on this machine:" -ForegroundColor Yellow
Write-Host '  eventcreate /ID 100 /T INFORMATION /L APPLICATION /SO "SOC Test" /D "Collector test event"' -ForegroundColor Gray
Write-Host "Then check the Live Logs page in your SOC portal." -ForegroundColor Yellow
Write-Host ""
Write-Host "To uninstall: Unregister-ScheduledTask -TaskName 'SOC-Collector' -Confirm:`$false" -ForegroundColor DarkGray
