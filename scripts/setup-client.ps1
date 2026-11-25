#Requires -Version 5.1
<#
.SYNOPSIS
  Installs and configures the ZhanX DentalCare desktop client on a clinic PC.
.DESCRIPTION
  Optionally runs the client installer silently, then stores the clinic server
  address in the current user's app settings and verifies that the API answers.

.EXAMPLE
  .\setup-client.ps1 -ServerUrl http://192.168.1.10:4000
.EXAMPLE
  .\setup-client.ps1 -ServerUrl http://192.168.1.10:4000 -InstallerPath .\ZhanX-DentalCare-Setup.exe -Launch
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$ServerUrl,
  [string]$InstallerPath = "",
  [switch]$SkipConnectionTest,
  [switch]$Launch
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "    $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "    $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host "`nERROR: $text" -ForegroundColor Red; exit 1 }

$ServerUrl = $ServerUrl.Trim().TrimEnd("/")
if ($ServerUrl -notmatch "^https?://[^\s/]+") { Fail "ServerUrl must start with http:// or https:// (for example http://192.168.1.10:4000)." }

if ($InstallerPath) {
  $resolved = Resolve-Path $InstallerPath -ErrorAction SilentlyContinue
  if (-not $resolved) { Fail "Installer not found: $InstallerPath" }
  Write-Step "Installing desktop client"
  $process = Start-Process -FilePath $resolved.Path -ArgumentList "/S" -Wait -PassThru
  if ($process.ExitCode -ne 0) { Fail "Client installer exited with code $($process.ExitCode)." }
  Write-Ok "Client installed silently"
}

$candidates = @()
$possiblePaths = @(
  (Join-Path $env:LOCALAPPDATA "Programs\ZhanX DentalCare\ZhanX DentalCare.exe")
)
if ($env:ProgramFiles) { $possiblePaths += (Join-Path $env:ProgramFiles "ZhanX DentalCare\ZhanX DentalCare.exe") }
if (${env:ProgramFiles(x86)}) { $possiblePaths += (Join-Path ${env:ProgramFiles(x86)} "ZhanX DentalCare\ZhanX DentalCare.exe") }
$candidates = $possiblePaths | Where-Object { Test-Path $_ }

if (-not $candidates) {
  Write-Warn "ZhanX DentalCare.exe was not found in the usual install locations. Configure the server address from the sign-in screen instead."
} else {
  Write-Ok "Client executable: $($candidates[0])"
}

$configDir = Join-Path $env:APPDATA "ZhanX DentalCare"
New-Item -ItemType Directory -Path $configDir -Force | Out-Null
$configPath = Join-Path $configDir "server-config.json"
Set-Content -Path $configPath -Value (@{ serverUrl = $ServerUrl } | ConvertTo-Json) -Encoding ASCII
Write-Ok "Saved server address to $configPath"

if (-not $SkipConnectionTest) {
  Write-Step "Testing API connection"
  try {
    $health = Invoke-RestMethod -Uri "$ServerUrl/api/health" -TimeoutSec 8
    if ($health.data.status -ne "ok") { Fail "Server answered but reported status '$($health.data.status)'." }
    if ($health.data.database -ne $true) { Fail "Server answered but cannot reach PostgreSQL. Check the server logs." }
    Write-Ok "Connected to API $($health.data.version); database reachable"
  } catch {
    Fail "Could not reach $ServerUrl/api/health. Check the server is running, the LAN address is correct and the firewall allows port $(([Uri]$ServerUrl).Port). Detail: $($_.Exception.Message)"
  }
}

if ($Launch) {
  if ($candidates) {
    Start-Process -FilePath $candidates[0] | Out-Null
    Write-Ok "Client launched"
  } else {
    Write-Warn "Cannot launch: executable not found."
  }
}

Write-Host "`nZhanX DentalCare client configured for $ServerUrl" -ForegroundColor Green
Write-Host "Uninstalling the client does not delete the clinic database, backups or patient files - they live on the server." -ForegroundColor Cyan
