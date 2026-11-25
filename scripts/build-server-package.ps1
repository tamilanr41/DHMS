#Requires -Version 5.1
<#
.SYNOPSIS
  Builds the distributable ZhanX DentalCare server package for Windows.
.DESCRIPTION
  Stages the server source, database files, scripts and documentation, installs
  production-only dependencies, and produces release\server\ZhanX-...-Server-<version>.zip.
  The .env, data folder and local PostgreSQL cluster are never included.
.EXAMPLE
  .\scripts\build-server-package.ps1
.EXAMPLE
  .\scripts\build-server-package.ps1 -OutputDir D:\Builds
#>
param(
  [string]$OutputDir = "",
  [switch]$SkipInstall,
  [switch]$KeepStaging
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "    $text" -ForegroundColor Green }
function Fail($text) { Write-Host "`nERROR: $text" -ForegroundColor Red; exit 1 }

function Invoke-Npm([string[]]$npmArgs, [string]$workDir) {
  $npmPath = $null
  foreach ($name in @("npm.cmd", "npm.exe")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { $npmPath = $cmd.Source; break }
  }
  if (-not $npmPath) {
    $nodePath = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
    $cli = if ($nodePath) { Join-Path (Split-Path $nodePath) "node_modules\npm\bin\npm-cli.js" } else { $null }
    if ($cli -and (Test-Path $cli)) { $npmPath = $cli }
  }
  if (-not $npmPath) {
    $cmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($cmd) { $npmPath = $cmd.Source }
  }
  if (-not $npmPath) { Fail "npm was not found. Reinstall Node.js with npm included, then re-run." }
  Push-Location $workDir
  try {
    if ($npmPath.EndsWith(".js")) { & node $npmPath @npmArgs } else { & $npmPath @npmArgs }
    if ($LASTEXITCODE -ne 0) { Fail "npm $($npmArgs -join ' ') failed with exit code $LASTEXITCODE" }
  } finally { Pop-Location }
}

$repoRoot = Split-Path $PSScriptRoot -Parent
$serverSrc = Join-Path $repoRoot "apps\server"
if (-not (Test-Path (Join-Path $serverSrc "src\server.js"))) {
  Fail "Run this script from the repository: apps\server\src\server.js was not found."
}
if (-not (Test-Path (Join-Path $repoRoot "database\migrations"))) {
  Fail "database\migrations was not found next to apps."
}

$serverPkg = Get-Content (Join-Path $serverSrc "package.json") -Raw | ConvertFrom-Json
$version = $serverPkg.version
if (-not $version) { $version = "1.0.0" }

if (-not $OutputDir) { $OutputDir = Join-Path $repoRoot "release\server" }
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
$staging = Join-Path $OutputDir "staging"

if (Test-Path $staging) {
  Write-Step "Cleaning previous staging folder"
  Remove-Item $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging -Force | Out-Null

Write-Step "Staging server files"
$serverTarget = Join-Path $staging "server"
New-Item -ItemType Directory -Path $serverTarget -Force | Out-Null
Copy-Item (Join-Path $serverSrc "package.json") $serverTarget -Force
Copy-Item (Join-Path $serverSrc "src") (Join-Path $serverTarget "src") -Recurse -Force

$dbTarget = Join-Path $staging "database"
New-Item -ItemType Directory -Path $dbTarget -Force | Out-Null
Copy-Item (Join-Path $repoRoot "database\migrations") (Join-Path $dbTarget "migrations") -Recurse -Force

$scriptsTarget = Join-Path $staging "scripts"
New-Item -ItemType Directory -Path $scriptsTarget -Force | Out-Null
Get-ChildItem (Join-Path $repoRoot "scripts") -Filter "*.ps1" -File | Copy-Item -Destination $scriptsTarget -Force

$docsSource = Join-Path $repoRoot "docs"
if (Test-Path $docsSource) {
  Copy-Item $docsSource (Join-Path $staging "docs") -Recurse -Force
} else {
  Write-Host "    WARNING: docs folder is missing; the package will not include documentation." -ForegroundColor Yellow
}

Copy-Item (Join-Path $repoRoot ".env.example") (Join-Path $staging ".env.example") -Force

$startScript = @(
  "@echo off",
  "setlocal",
  "cd /d `"%~dp0`"",
  "if not exist `"logs`" mkdir `"logs`"",
  "node `"server\src\server.js`" >> `"logs\server.log`" 2>&1"
)
Set-Content -Path (Join-Path $staging "start-server.cmd") -Value $startScript -Encoding ASCII

$buildInfo = @(
  "ZhanX DentalCare Server",
  "Version: $version",
  "Built:   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
  "",
  "Install with:  scripts\setup-server.ps1  (elevated PowerShell)",
  "Documentation: docs\INSTALLATION.md"
)
Set-Content -Path (Join-Path $staging "VERSION.txt") -Value $buildInfo -Encoding ASCII

$forbidden = @(".env", "data", ".pgdata", "logs")
foreach ($name in $forbidden) {
  $path = Join-Path $staging $name
  if (Test-Path $path) { Fail "Package staging unexpectedly contains '$name'. Aborting." }
}
Write-Ok "Server source, migrations, scripts and docs staged"

Write-Step "Installing production dependencies"
if ($SkipInstall) {
  Write-Host "    Skipped (-SkipInstall). The package will NOT contain node_modules." -ForegroundColor Yellow
} else {
  Invoke-Npm @("install", "--omit=dev", "--no-audit", "--no-fund") $serverTarget
  if (-not (Test-Path (Join-Path $serverTarget "node_modules\express"))) {
    Fail "node_modules\express is missing after npm install."
  }
  if (Test-Path (Join-Path $serverTarget "node_modules\electron")) {
    Fail "Development dependencies leaked into the server package."
  }
  Write-Ok "Production dependencies installed"
}

$badDirs = @("data", ".pgdata", "logs")
foreach ($name in $badDirs) {
  $path = Join-Path $serverTarget $name
  if (Test-Path $path) { Remove-Item $path -Recurse -Force; Write-Host "    Removed $name from package" -ForegroundColor Yellow }
}
Get-ChildItem $staging -Recurse -Filter "*.env" -File -ErrorAction SilentlyContinue | Remove-Item -Force
if (Test-Path (Join-Path $staging ".env")) { Fail "A .env file slipped into the package. Aborting to protect credentials." }

$secretFiles = Get-ChildItem $staging -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '\.(pem|key|pfx|p12)$' -or $_.FullName -match 'license-generator' }
if ($secretFiles) {
  Fail "Signing key material or the private license generator slipped into the server package: $($secretFiles.FullName -join ', ')"
}
Write-Ok "No private keys or license-generator files in the server package"

Write-Step "Creating archive"
$zipName = "ZhanX-DentalCare-Server-$version.zip"
$zipPath = Join-Path $OutputDir $zipName
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
if (-not (Test-Path $zipPath)) { Fail "Archive was not created." }
$sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)

if (-not $KeepStaging) {
  Remove-Item $staging -Recurse -Force
}

Write-Host "`n========== Server package ready ==========" -ForegroundColor Green
Write-Host "Archive  : $zipPath"
Write-Host "Size     : $sizeMb MB"
Write-Host "Version  : $version"
Write-Host "`nOn the clinic server: extract the archive, then from an elevated PowerShell run" -ForegroundColor Cyan
Write-Host "  scripts\setup-server.ps1" -ForegroundColor Cyan
exit 0
