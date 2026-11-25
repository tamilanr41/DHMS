#Requires -Version 5.1
<#
.SYNOPSIS
  Starts or stops the local PostgreSQL cluster used for development.
.DESCRIPTION
  The cluster lives outside the project folder (OneDrive/backup tools must not sync
  a live database). Set PGDATA_DIR to override the location.

  The server log is written outside the data directory: a log inside it makes
  PostgreSQL fail at startup with "sharing violation" while it recovers.
.EXAMPLE
  .\scripts\dev-db.ps1 start
.EXAMPLE
  .\scripts\dev-db.ps1 stop
#>
param([ValidateSet("start", "stop", "status")][string]$Action = "start")

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent

# The live development cluster lives in %LOCALAPPDATA% (outside OneDrive). A .pgdata
# folder inside the project is only used when LOCALAPPDATA has no cluster.
$localCluster = Join-Path $env:LOCALAPPDATA "ZhanX\dev-pgdata"
$repoCluster = Join-Path $repoRoot ".pgdata"

if ($env:PGDATA_DIR) {
  $dataDir = $env:PGDATA_DIR
} elseif (Test-Path (Join-Path $repoCluster "PG_VERSION")) {
  $dataDir = $repoCluster
} elseif ((Test-Path (Join-Path $localCluster "PG_VERSION") -ErrorAction SilentlyContinue)) {
  $dataDir = $localCluster
} else {
  $dataDir = $repoCluster
}

if (-not (Test-Path (Join-Path $dataDir "PG_VERSION"))) {
  Write-Host "No development cluster found at $dataDir" -ForegroundColor Red
  Write-Host "See README section 2 for first-time setup." -ForegroundColor Yellow
  exit 1
}

$pgBin = $env:PG_BIN_DIR
if (-not $pgBin) {
  $pgBin = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName "bin" } |
    Where-Object { Test-Path (Join-Path $_ "pg_ctl.exe") } |
    Select-Object -First 1
}
if (-not $pgBin) {
  Write-Host "PostgreSQL bin folder not found. Set PG_BIN_DIR." -ForegroundColor Red
  exit 1
}

$port = "55432"
$envFile = Join-Path $repoRoot ".env"
if (Test-Path $envFile) {
  $match = Select-String -Path $envFile -Pattern "^DB_PORT=(\d+)" | Select-Object -First 1
  if ($match) { $port = $match.Matches[0].Groups[1].Value }
}

$pgCtl = Join-Path $pgBin "pg_ctl.exe"
$pgIsReady = Join-Path $pgBin "pg_isready.exe"
$logDir = Join-Path (Split-Path $dataDir -Parent) "logs"
$logFile = Join-Path $logDir "postgres.log"

& $pgIsReady -h 127.0.0.1 -p $port -U postgres -d postgres *> $null
$running = $LASTEXITCODE -eq 0

switch ($Action) {
  "start" {
    if ($running) {
      Write-Host "PostgreSQL is already running on port $port." -ForegroundColor Green
      exit 0
    }
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    # Backends inherit PATH; developer shells that add MSYS/Qoder DLL folders make
    # PostgreSQL children die with 0xC0000142, so start with the plain system PATH.
    $env:PATH = "$env:SystemRoot\System32;$env:SystemRoot;$env:SystemRoot\System32\Wbem;$pgBin"
    & $pgCtl -D $dataDir -l $logFile -o "-p $port" -w -t 60 start
    if ($LASTEXITCODE -ne 0) {
      Write-Host "PostgreSQL did not start. See $logFile" -ForegroundColor Red
      exit 1
    }
    & $pgIsReady -h 127.0.0.1 -p $port -U postgres -d postgres
  }
  "stop" {
    if (-not $running) {
      Write-Host "PostgreSQL is not running." -ForegroundColor Yellow
      exit 0
    }
    & $pgCtl -D $dataDir -m fast stop
  }
  "status" {
    & $pgIsReady -h 127.0.0.1 -p $port -U postgres -d postgres
    if ($running) {
      Write-Host "PostgreSQL is running on port $port ($dataDir)" -ForegroundColor Green
    } else {
      Write-Host "PostgreSQL is not running ($dataDir)" -ForegroundColor Yellow
      Write-Host "Log: $logFile" -ForegroundColor DarkGray
      exit 1
    }
  }
}
