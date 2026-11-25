#Requires -Version 5.1
<#
.SYNOPSIS
  Restores a ZhanX DentalCare PostgreSQL backup, safely.
.DESCRIPTION
  Verifies the archive, takes a pre-restore backup, stops the API task, terminates
  open database sessions, restores with pg_restore --clean --if-exists, runs sanity
  checks and restarts the API. A typed RESTORE confirmation is required unless -Force.
.EXAMPLE
  .\restore.ps1 -Archive "D:\ClinicBackups\zhanx-20261029-210000.dump"
.EXAMPLE
  .\restore.ps1 -Archive "zhanx-20261029-210000.dump" -Force
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Archive,
  [string]$InstallDir = "",
  [string]$PgBin = "",
  [switch]$Force,
  [switch]$KeepServiceStopped
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "    $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "    $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host "`nERROR: $text" -ForegroundColor Red; exit 1 }

# PostgreSQL tools write NOTICE/INFO lines to stderr. With $ErrorActionPreference
# set to Stop, PowerShell 5.1 turns that output into a terminating error even when
# the tool succeeded, so native calls are wrapped to capture stdout, stderr and the
# exit code instead of relying on $LASTEXITCODE alone.
function Invoke-Native([string]$exe, [string[]]$arguments) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $exe @arguments 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  [pscustomobject]@{
    Output = ($output | Out-String).Trim()
    Lines  = @($output | ForEach-Object { "$_" })
    Code   = $code
  }
}

if (-not $InstallDir) { $InstallDir = Split-Path $PSScriptRoot -Parent }
$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)
$envPath = Join-Path $InstallDir ".env"
if (-not (Test-Path $envPath)) { Fail "Server configuration not found: $envPath" }

function Read-DotEnv([string]$path) {
  $map = @{}
  foreach ($line in Get-Content $path) {
    if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$") {
      $map[$matches[1]] = $matches[2].Trim().Trim('"')
    }
  }
  return $map
}

function Find-PgTool([string]$configured, [string]$binDir, [string]$name) {
  if ($configured -and (Test-Path $configured)) { return $configured }
  if ($binDir) {
    $candidate = Join-Path $binDir "$name.exe"
    if (Test-Path $candidate) { return $candidate }
  }
  $cmd = Get-Command "$name.exe" -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($root in @("C:\Program Files\PostgreSQL", "C:\Program Files (x86)\PostgreSQL")) {
    if (Test-Path $root) {
      $found = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Name -replace '\D', '0') } -Descending |
        ForEach-Object { Join-Path $_.FullName "bin\$name.exe" } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1
      if ($found) { return $found }
    }
  }
  return $null
}

$envMap = Read-DotEnv $envPath
foreach ($required in @("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER")) {
  if (-not $envMap.ContainsKey($required)) { Fail ".env is missing $required." }
}

if (-not $PgBin) { $PgBin = if ($envMap.ContainsKey("PG_BIN_DIR")) { $envMap["PG_BIN_DIR"] } else { "" } }
$pgRestoreConfigured = if ($envMap.ContainsKey("PG_RESTORE_BIN")) { $envMap["PG_RESTORE_BIN"] } else { "" }
$pgRestore = Find-PgTool $pgRestoreConfigured $PgBin "pg_restore"
$psql = Find-PgTool "" $PgBin "psql"
if (-not $pgRestore) { Fail "pg_restore.exe not found. Install PostgreSQL client tools or set PG_BIN_DIR in .env." }
if (-not $psql) { Fail "psql.exe not found. Install PostgreSQL client tools or set PG_BIN_DIR in .env." }

if (-not (Test-Path $Archive)) {
  $candidate = Join-Path (Split-Path $PSScriptRoot -Parent) $Archive
  if (Test-Path $candidate) { $Archive = $candidate } else { Fail "Backup file not found: $Archive" }
}
$Archive = (Resolve-Path $Archive).Path

$dbName = $envMap["DB_NAME"]
Write-Step "Verifying archive $([System.IO.Path]::GetFileName($Archive))"
$verify = Invoke-Native $pgRestore @("--list", $Archive)
if ($verify.Code -ne 0) { Fail "The archive could not be read:`n$($verify.Output)" }
$list = @($verify.Lines | Where-Object { $_ -ne "" })
$entries = $list.Count
Write-Ok "Archive is valid ($entries entries, $([math]::Round((Get-Item $Archive).Length / 1MB, 2)) MB)"

if (-not $Force) {
  Write-Host "`nThis will replace the CURRENT contents of database '$dbName' on $($envMap['DB_HOST']):$($envMap['DB_PORT'])." -ForegroundColor Yellow
  Write-Host "A pre-restore backup is taken automatically first." -ForegroundColor Yellow
  $answer = Read-Host "Type RESTORE (all caps) to continue"
  if ($answer -ne "RESTORE") { Fail "Restore cancelled." }
}

Write-Step "Taking a pre-restore backup"
$backupScript = Join-Path $PSScriptRoot "backup.ps1"
if (-not (Test-Path $backupScript)) { Fail "backup.ps1 not found next to restore.ps1; cannot create the safety backup." }
& $backupScript -InstallDir $InstallDir -Prefix "pre-restore"
if ($LASTEXITCODE -ne 0) { Fail "Pre-restore backup failed. Database was not changed." }

$taskName = "ZhanX DentalCare API"
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
$apiWasRunning = $false
if ($task -and $task.State -eq "Running") {
  Write-Step "Stopping API service"
  Stop-ScheduledTask -TaskName $taskName
  $apiWasRunning = $true
  Start-Sleep -Seconds 2
  Write-Ok "Service stopped"
}

$previous = $env:PGPASSWORD
if ($envMap.ContainsKey("DB_PASSWORD")) { $env:PGPASSWORD = $envMap["DB_PASSWORD"] }
$tocPath = Join-Path ([System.IO.Path]::GetTempPath()) ("zhanx-restore-" + [guid]::NewGuid().ToString("N") + ".list")
try {
  Write-Step "Preparing extension and backup table of contents"
  # btree_gist backs the appointment exclusion constraint. It is trusted, so the
  # database owner can create it; it is excluded from the restore TOC because the
  # application role does not own the existing extension.
  $ext = Invoke-Native $psql @("-h", $envMap["DB_HOST"], "-p", $envMap["DB_PORT"], "-U", $envMap["DB_USER"], "-d", $dbName, "-v", "ON_ERROR_STOP=1", "-tAc", "CREATE EXTENSION IF NOT EXISTS btree_gist;")
  if ($ext.Code -ne 0) { Fail "Could not ensure btree_gist is installed: $($ext.Output)" }
  $list | Where-Object { $_ -notmatch ' EXTENSION - ' -and $_ -notmatch ' COMMENT - EXTENSION ' } |
    Set-Content -Path $tocPath -Encoding ASCII
  if (-not (Test-Path $tocPath)) { Fail "Could not write the restore table of contents." }
  Write-Ok "Table of contents prepared (superuser-owned extensions preserved)"

  Write-Step "Closing open database sessions"
  $terminateSql = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$dbName' AND pid <> pg_backend_pid();"
  $closed = Invoke-Native $psql @("-h", $envMap["DB_HOST"], "-p", $envMap["DB_PORT"], "-U", $envMap["DB_USER"], "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tAc", $terminateSql)
  if ($closed.Code -ne 0) {
    Write-Warn "Could not terminate every session (continuing): $($closed.Output)"
  } else {
    Write-Ok "Open sessions closed"
  }

  Write-Step "Restoring database $dbName"
  $restoreArgs = @(
    "-h", $envMap["DB_HOST"], "-p", $envMap["DB_PORT"], "-U", $envMap["DB_USER"],
    "-d", $dbName, "--clean", "--if-exists", "--no-owner", "--no-privileges", "--single-transaction",
    "--use-list", $tocPath, $Archive
  )
  $output = Invoke-Native $pgRestore $restoreArgs
  if ($output.Code -ne 0) {
    Fail "pg_restore failed. The database may be partially restored; re-run this script with the pre-restore backup.`n$($output.Output)"
  }
  Write-Ok "Restore completed"

  Write-Step "Running sanity checks"
  $checks = @(
    @{ Label = "Users"; Sql = "SELECT count(*) FROM users;" },
    @{ Label = "Patients"; Sql = "SELECT count(*) FROM patients;" },
    @{ Label = "Invoices"; Sql = "SELECT count(*) FROM invoices;" },
    @{ Label = "Audit entries"; Sql = "SELECT count(*) FROM audit_logs;" }
  )
  $summary = @()
  foreach ($check in $checks) {
    $result = Invoke-Native $psql @("-h", $envMap["DB_HOST"], "-p", $envMap["DB_PORT"], "-U", $envMap["DB_USER"], "-d", $dbName, "-tAc", $check.Sql)
    if ($result.Code -ne 0) { Fail "Sanity check '$($check.Label)' failed: $($result.Output)" }
    $line = "$($check.Label): $($result.Output)"
    $summary += $line
    Write-Ok $line
  }
  Invoke-Native $psql @("-h", $envMap["DB_HOST"], "-p", $envMap["DB_PORT"], "-U", $envMap["DB_USER"], "-d", $dbName, "-tAc", "ANALYZE;") | Out-Null
} finally {
  if ($tocPath -and (Test-Path $tocPath)) { Remove-Item $tocPath -Force -ErrorAction SilentlyContinue }
  $env:PGPASSWORD = $previous
}

if ($apiWasRunning -and -not $KeepServiceStopped) {
  Write-Step "Restarting API service"
  Start-ScheduledTask -TaskName $taskName
  Start-Sleep -Seconds 3
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$($envMap['PORT'])/api/health" -TimeoutSec 5
    if ($health.data.status -eq "ok" -and $health.data.database -eq $true) {
      Write-Ok "API is healthy and connected"
    } else {
      Write-Warn "API answered but reports a problem. Check logs\server.log."
    }
  } catch {
    Write-Warn "API did not answer yet. Check logs\server.log or start the '$taskName' task."
  }
}

Write-Host "`n========== Restore finished ==========" -ForegroundColor Green
Write-Host "Database : $dbName"
Write-Host "Archive  : $Archive"
Write-Host "Checks   :"
foreach ($line in $summary) { Write-Host "  $line" }
Write-Host "`nSign in with the credentials that were valid when this backup was taken." -ForegroundColor Cyan
exit 0
