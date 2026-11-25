#Requires -Version 5.1
<#
.SYNOPSIS
  Creates a verified, compressed PostgreSQL backup for ZhanX DentalCare.
.DESCRIPTION
  Reads connection details from the server .env, runs pg_dump in custom format,
  verifies the archive with pg_restore --list and applies the retention policy.
.EXAMPLE
  .\backup.ps1
.EXAMPLE
  .\backup.ps1 -InstallDir "C:\ZhanX\Server" -BackupDir "D:\ClinicBackups" -RetentionDays 60
#>
param(
  [string]$InstallDir = "",
  [string]$BackupDir = "",
  [int]$RetentionDays = 0,
  [string]$PgBin = "",
  [string]$Prefix = "zhanx"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step($text) { Write-Host "==> $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host "ERROR: $text" -ForegroundColor Red; exit 1 }

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
if (-not $envMap.ContainsKey("DB_NAME")) { Fail ".env is missing DB_NAME." }

if (-not $PgBin) { $PgBin = if ($envMap.ContainsKey("PG_BIN_DIR")) { $envMap["PG_BIN_DIR"] } else { "" } }
$pgDumpConfigured = if ($envMap.ContainsKey("PG_DUMP_BIN")) { $envMap["PG_DUMP_BIN"] } else { "" }
$pgRestoreConfigured = if ($envMap.ContainsKey("PG_RESTORE_BIN")) { $envMap["PG_RESTORE_BIN"] } else { "" }
$pgDump = Find-PgTool $pgDumpConfigured $PgBin "pg_dump"
$pgRestore = Find-PgTool $pgRestoreConfigured $PgBin "pg_restore"
if (-not $pgDump -or -not (Test-Path $pgDump)) { Fail "pg_dump.exe not found. Install PostgreSQL client tools or set PG_BIN_DIR in .env." }

if (-not $BackupDir) {
  $dataDir = if ($envMap.ContainsKey("DATA_DIR") -and $envMap["DATA_DIR"]) { $envMap["DATA_DIR"] } else { "./data" }
  if ([System.IO.Path]::IsPathRooted($dataDir)) { $BackupDir = Join-Path $dataDir "backups" }
  else { $BackupDir = Join-Path (Join-Path $InstallDir $dataDir) "backups" }
}
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

if ($RetentionDays -le 0) {
  $RetentionDays = if ($envMap.ContainsKey("BACKUP_RETENTION_DAYS") -and $envMap["BACKUP_RETENTION_DAYS"]) { [int]$envMap["BACKUP_RETENTION_DAYS"] } else { 30 }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$fileName = "$Prefix-$timestamp.dump"
$target = Join-Path $BackupDir $fileName
$logPath = Join-Path $BackupDir "backup.log"

function Write-Log([string]$message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message"
  Add-Content -Path $logPath -Value $line -Encoding ASCII
}

Write-Step "Dumping database $($envMap['DB_NAME']) to $target"
$previous = $env:PGPASSWORD
if ($envMap.ContainsKey("DB_PASSWORD")) { $env:PGPASSWORD = $envMap["DB_PASSWORD"] }
try {
  $args = @(
    "-h", $envMap["DB_HOST"], "-p", $envMap["DB_PORT"], "-U", $envMap["DB_USER"],
    "-d", $envMap["DB_NAME"], "--format=custom", "--compress=9", "--file=$target"
  )
  $output = & $pgDump @args 2>&1
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $target)) {
    Write-Log "FAILED $fileName :: $($output | Out-String)"
    Fail "pg_dump failed:`n$($output | Out-String)"
  }
  $size = (Get-Item $target).Length
  if ($size -le 0) { Fail "pg_dump produced an empty file." }
  Write-Step "Verifying archive"
  $list = & $pgRestore --list $target 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Log "VERIFY FAILED $fileName"
    Fail "Backup verification failed:`n$($list | Out-String)"
  }
  $entries = ($list | Measure-Object -Line).Lines
  Write-Log "OK $fileName size=$size entries=$entries"
  Write-Host "Backup created: $target" -ForegroundColor Green
  Write-Host "Size: $([math]::Round($size / 1MB, 2)) MB, archive entries: $entries" -ForegroundColor Green
} finally {
  $env:PGPASSWORD = $previous
}

Write-Step "Applying retention policy ($RetentionDays days)"
$cutoff = (Get-Date).AddDays(-$RetentionDays)
$removed = 0
Get-ChildItem $BackupDir -Filter "*.dump" -File | Where-Object { $_.LastWriteTime -lt $cutoff } | ForEach-Object {
  Write-Host "Removing expired backup $($_.Name)" -ForegroundColor Yellow
  Write-Log "RETENTION removed $($_.Name)"
  Remove-Item $_.FullName -Force
  $removed++
}
Write-Host "Removed $removed expired backup(s)." -ForegroundColor Green
exit 0
