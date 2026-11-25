#Requires -Version 5.1
<#
.SYNOPSIS
  Installs the ZhanX DentalCare API server on a Windows clinic server.
.DESCRIPTION
  Creates the PostgreSQL role and database, writes a production .env with a
  freshly generated JWT secret, installs server dependencies, applies database
  migrations, registers a startup task and opens the LAN firewall port.

  By default the clinic database starts empty: no staff account is created here.
  After installing the desktop client on the server PC, activate the signed
  license and create the first administrator inside the application. Pass
  -CreateAdmin only for an offline/scripted deployment where in-app setup is
  not possible.

  Run from an elevated PowerShell prompt in the extracted server package
  (the folder that contains server\, database\, docs\ and scripts\).

.EXAMPLE
  .\scripts\setup-server.ps1
.EXAMPLE
  .\scripts\setup-server.ps1 -PgPort 5432 -ApiPort 4000 -BackupDir D:\ClinicBackups
#>
param(
  [string]$InstallDir = "",
  [string]$PgHost = "127.0.0.1",
  [int]$PgPort = 5432,
  [string]$PgBin = "",
  [string]$PgSuperUser = "postgres",
  [string]$PgSuperPassword = "",
  [string]$DbName = "zhanx_dentalcare",
  [string]$DbUser = "zhanx_app",
  [string]$DbPassword = "",
  [int]$ApiPort = 4000,
  [string]$BackupDir = "",
  [string]$AdminUsername = "admin",
  [string]$AdminFullName = "Clinic Administrator",
  [string]$AdminPassword = "",
  [switch]$CreateAdmin,
  [switch]$NoStartupTask,
  [switch]$SkipFirewall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "    $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "    $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host "`nERROR: $text" -ForegroundColor Red; exit 1 }

function New-RandomSecret([int]$length) {
  $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%+"
  $bytes = New-Object byte[] ($length * 2)
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $sb = New-Object System.Text.StringBuilder
  foreach ($b in $bytes) {
    if ($sb.Length -ge $length) { break }
    [void]$sb.Append($chars[$b % $chars.Length])
  }
  return $sb.ToString()
}

function New-HexSecret([int]$bytes) {
  $buffer = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return -join ($buffer | ForEach-Object { $_.ToString("x2") })
}

function Test-IsAdmin {
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Find-PgBin([string]$configured) {
  if ($configured -and (Test-Path (Join-Path $configured "pg_dump.exe"))) { return $configured }
  $roots = @("C:\Program Files\PostgreSQL", "C:\Program Files (x86)\PostgreSQL")
  $candidates = @()
  foreach ($root in $roots) {
    if (Test-Path $root) {
      $candidates += Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Name -replace '\D', '0') } -Descending |
        ForEach-Object { Join-Path $_.FullName "bin" }
    }
  }
  foreach ($c in $candidates) {
    if ((Test-Path (Join-Path $c "pg_dump.exe")) -and (Test-Path (Join-Path $c "psql.exe"))) { return $c }
  }
  $cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($cmd) { return (Split-Path $cmd.Source -Parent) }
  return $null
}

function Invoke-Psql([string]$sql, [string]$database, [string]$user, [string]$password) {
  $args = @("-h", $PgHost, "-p", "$PgPort", "-U", $user, "-d", $database, "-v", "ON_ERROR_STOP=1", "-tAc", $sql)
  $previous = $env:PGPASSWORD
  if ($password) { $env:PGPASSWORD = $password }
  try {
    $output = & (Join-Path $script:PgBinPath "psql.exe") @args 2>&1
    if ($LASTEXITCODE -ne 0) { throw ($output | Out-String).Trim() }
    return ($output | Out-String).Trim()
  } finally {
    $env:PGPASSWORD = $previous
  }
}

function Invoke-Node([string[]]$nodeArgs, [string]$workDir, $envMap) {
  $saved = @{}
  foreach ($key in $envMap.Keys) {
    $saved[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
    [Environment]::SetEnvironmentVariable($key, $envMap[$key], "Process")
  }
  try {
    Push-Location $workDir
    try {
      & node @nodeArgs
      if ($LASTEXITCODE -ne 0) { throw "node $($nodeArgs -join ' ') failed with exit code $LASTEXITCODE" }
    } finally { Pop-Location }
  } finally {
    foreach ($key in $envMap.Keys) {
      [Environment]::SetEnvironmentVariable($key, $saved[$key], "Process")
    }
  }
}

function Invoke-Npm([string[]]$npmArgs, [string]$workDir) {
  $npmPath = $null
  foreach ($name in @("npm.cmd", "npm.exe")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { $npmPath = $cmd.Source; break }
  }
  if (-not $npmPath) {
    $nodePath = $node.Source
    $cli = Join-Path (Split-Path $nodePath) "node_modules\npm\bin\npm-cli.js"
    if (Test-Path $cli) { $npmPath = $cli }
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

if (-not (Test-IsAdmin)) { Fail "Run this script from an elevated PowerShell prompt (Run as administrator)." }

$packageRoot = Split-Path $PSScriptRoot -Parent
$repoMode = Test-Path (Join-Path $packageRoot "apps\server\src\server.js")
$packagedMode = Test-Path (Join-Path $packageRoot "server\src\server.js")
if (-not $repoMode -and -not $packagedMode) {
  Fail "Could not find the server files. Extract the server package and run scripts\setup-server.ps1 from its root."
}

if (-not $InstallDir) { $InstallDir = $packageRoot }
$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)

if ($repoMode) {
  $serverDir = Join-Path $packageRoot "apps\server"
  $dataRoot = $packageRoot
  Write-Warn "Development repository detected. Using apps\server and skipping package copy."
} else {
  $serverDir = Join-Path $InstallDir "server"
  if (-not (Test-Path $serverDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Copy-Item (Join-Path $packageRoot "*") $InstallDir -Recurse -Force
  }
  $dataRoot = $InstallDir
}

Write-Step "Checking prerequisites"
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { Fail "Node.js 20 or newer is required. Install it from https://nodejs.org and re-run." }
$nodeVersion = (& node --version).TrimStart("v")
if ([int]($nodeVersion.Split(".")[0]) -lt 20) { Fail "Node.js 20 or newer is required (found $nodeVersion)." }
Write-Ok "Node.js $nodeVersion at $($node.Source)"

$script:PgBinPath = Find-PgBin $PgBin
if (-not $script:PgBinPath) { Fail "PostgreSQL tools not found. Install PostgreSQL 16 or newer, or pass -PgBin 'C:\Program Files\PostgreSQL\18\bin'." }
Write-Ok "PostgreSQL tools at $script:PgBinPath"

if (-not (Test-Path (Join-Path $serverDir "src\server.js"))) { Fail "Server source missing at $serverDir" }
if (-not (Test-Path (Join-Path $dataRoot "database\migrations"))) { Fail "database\migrations folder is missing next to the server." }

Write-Step "Connecting to PostgreSQL $PgHost`:$PgPort as $PgSuperUser"
if (-not $PgSuperPassword) {
  $secure = Read-Host -Prompt "PostgreSQL superuser password for '$PgSuperUser' (leave blank if trust auth)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $PgSuperPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
try {
  $serverVersion = Invoke-Psql "SHOW server_version;" "postgres" $PgSuperUser $PgSuperPassword
} catch {
  Fail "Could not connect to PostgreSQL: $($_.Exception.Message)"
}
Write-Ok "PostgreSQL server version $serverVersion"

if ($DbName -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") { Fail "DbName must contain only letters, digits and underscores." }
if ($DbUser -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") { Fail "DbUser must contain only letters, digits and underscores." }
if (-not $DbPassword) { $DbPassword = New-RandomSecret 24 }

Write-Step "Creating database role and database"
$escapedPassword = $DbPassword.Replace("'", "''")
$roleExists = Invoke-Psql "SELECT 1 FROM pg_roles WHERE rolname = '$DbUser';" "postgres" $PgSuperUser $PgSuperPassword
if ($roleExists -eq "1") {
  Invoke-Psql "ALTER ROLE `"$DbUser`" WITH LOGIN PASSWORD '$escapedPassword';" "postgres" $PgSuperUser $PgSuperPassword | Out-Null
  Write-Ok "Role $DbUser updated"
} else {
  Invoke-Psql "CREATE ROLE `"$DbUser`" LOGIN PASSWORD '$escapedPassword';" "postgres" $PgSuperUser $PgSuperPassword | Out-Null
  Write-Ok "Role $DbUser created"
}
$dbExists = Invoke-Psql "SELECT 1 FROM pg_database WHERE datname = '$DbName';" "postgres" $PgSuperUser $PgSuperPassword
if ($dbExists -eq "1") {
  Write-Ok "Database $DbName already exists (left untouched)"
} else {
  Invoke-Psql "CREATE DATABASE `"$DbName`" OWNER `"$DbUser`" ENCODING 'UTF8' TEMPLATE template0;" "postgres" $PgSuperUser $PgSuperPassword | Out-Null
  Write-Ok "Database $DbName created"
}

# btree_gist backs the "no overlapping active appointments" exclusion constraint.
$hasGist = Invoke-Psql "SELECT 1 FROM pg_extension WHERE extname = 'btree_gist';" $DbName $PgSuperUser $PgSuperPassword
if ($hasGist -ne "1") {
  Invoke-Psql "CREATE EXTENSION IF NOT EXISTS btree_gist;" $DbName $PgSuperUser $PgSuperPassword | Out-Null
  Write-Ok "Extension btree_gist enabled"
}

if (-not $BackupDir) { $BackupDir = Join-Path $dataRoot "data\backups" }
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

Write-Step "Writing production configuration"
$envPath = Join-Path $dataRoot ".env"
if (Test-Path $envPath) {
  $backupEnv = "$envPath.bak-" + (Get-Date -Format "yyyyMMddHHmmss")
  Copy-Item $envPath $backupEnv
  Write-Warn "Existing .env backed up to $backupEnv"
}
$jwtSecret = New-HexSecret 48
$envLines = @(
  "NODE_ENV=production",
  "PORT=$ApiPort",
  "HOST=0.0.0.0",
  "",
  "DB_HOST=$PgHost",
  "DB_PORT=$PgPort",
  "DB_NAME=$DbName",
  "DB_USER=$DbUser",
  "DB_PASSWORD=$DbPassword",
  "DB_POOL_MAX=10",
  "",
  "JWT_SECRET=$jwtSecret",
  "ACCESS_TOKEN_TTL_MIN=15",
  "REFRESH_TOKEN_TTL_DAYS=7",
  "BCRYPT_ROUNDS=12",
  "LOGIN_MAX_ATTEMPTS=5",
  "LOGIN_LOCK_MINUTES=15",
  "",
  "DATA_DIR=./data",
  "UPLOAD_MAX_MB=10",
  "BACKUP_SCHEDULE=0 21 * * *",
  "BACKUP_RETENTION_DAYS=30",
  "",
  "PG_BIN_DIR=$script:PgBinPath",
  "PG_DUMP_BIN=$(Join-Path $script:PgBinPath 'pg_dump.exe')",
  "PG_RESTORE_BIN=$(Join-Path $script:PgBinPath 'pg_restore.exe')",
  "PG_PSQL_BIN=$(Join-Path $script:PgBinPath 'psql.exe')",
  "",
  "CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173"
)
Set-Content -Path $envPath -Value $envLines -Encoding ASCII
Write-Ok "Wrote $envPath"
try {
  & icacls.exe $envPath /inheritance:r /grant:r "SYSTEM:(R)" "Administrators:(F)" | Out-Null
} catch { Write-Warn "Could not tighten .env permissions automatically." }

Write-Step "Installing server dependencies"
if (Test-Path (Join-Path $serverDir "node_modules\express")) {
  Write-Ok "Production dependencies are already bundled with this package (offline ready)"
} else {
  Invoke-Npm @("install", "--omit=dev", "--no-audit", "--no-fund") $serverDir
  Write-Ok "Dependencies installed"
}

Write-Step "Applying database migrations"
Invoke-Node @("src/database/migrate.js") $serverDir @{}
Write-Ok "Migrations applied"

Write-Step "Administrator account"
if (-not $CreateAdmin) {
  Write-Ok "The database is empty. The first administrator is created inside the app"
  Write-Host "    after the license is activated on this computer." -ForegroundColor Green
} else {
  $adminCount = Invoke-Psql "SELECT count(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'admin';" $DbName $DbUser $DbPassword
  $script:AdminKeptExisting = $false
  if ($adminCount -ne "0") {
    $script:AdminKeptExisting = $true
    Write-Warn "An administrator account already exists; its password was NOT changed."
    Write-Warn "To reset it, run: node src\database\create-admin.js --reset-password"
  } else {
    if (-not $AdminPassword) {
      $AdminPassword = New-RandomSecret 20
      $script:GeneratedAdminPassword = $true
    } else {
      $script:GeneratedAdminPassword = $false
    }
    $adminPasswordForDisplay = $AdminPassword
    Invoke-Node @("src/database/create-admin.js", "--username=$AdminUsername", "--full-name=$AdminFullName") $serverDir @{
      ADMIN_USERNAME = $AdminUsername
      ADMIN_FULL_NAME = $AdminFullName
      ADMIN_PASSWORD = $AdminPassword
    }
    Write-Ok "Administrator $AdminUsername created"
  }
}
$AdminPassword = $null

if (-not $NoStartupTask) {
  Write-Step "Registering startup task"
  $startScript = Join-Path $dataRoot "start-server.cmd"
  $startLines = @(
    "@echo off",
    "setlocal",
    "cd /d `"%~dp0`"",
    "if not exist `"logs`" mkdir `"logs`"",
    "`"$($node.Source)`" `"server\src\server.js`" >> `"logs\server.log`" 2>&1"
  )
  if ($repoMode) {
    $startLines[4] = "`"$($node.Source)`" `"apps\server\src\server.js`" >> `"logs\server.log`" 2>&1"
  }
  Set-Content -Path $startScript -Value $startLines -Encoding ASCII

  $taskName = "ZhanX DentalCare API"
  $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$startScript`""
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Write-Ok "Scheduled task '$taskName' will start the API at boot"
}

if (-not $SkipFirewall) {
  Write-Step "Opening firewall port $ApiPort"
  $existing = Get-NetFirewallRule -DisplayName "ZhanX DentalCare API" -ErrorAction SilentlyContinue
  if ($existing) { Remove-NetFirewallRule -DisplayName "ZhanX DentalCare API" | Out-Null }
  New-NetFirewallRule -DisplayName "ZhanX DentalCare API" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $ApiPort -Profile Private,Domain | Out-Null
  Write-Ok "Inbound TCP $ApiPort allowed on Private and Domain networks"
}

Write-Step "Starting the API service"
if (-not $NoStartupTask) { Start-ScheduledTask -TaskName "ZhanX DentalCare API" }
$healthy = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/api/health" -TimeoutSec 3
    if ($health.data.status -eq "ok" -and $health.data.database -eq $true) { $healthy = $true; break }
  } catch { }
  Start-Sleep -Seconds 1
}
if (-not $healthy) {
  Write-Warn "The API did not answer on http://127.0.0.1:$ApiPort. Check logs\server.log, then start the scheduled task."
} else {
  Write-Ok "API health check passed (database connected)"
}

$lanAddresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
  Select-Object -ExpandProperty IPAddress

Write-Host "`n========== ZhanX DentalCare server installed ==========" -ForegroundColor Green
Write-Host "Install folder : $dataRoot"
Write-Host "API port       : $ApiPort"
Write-Host "Server URL     : http://127.0.0.1:$ApiPort"
foreach ($ip in $lanAddresses) { Write-Host "LAN URL        : http://$($ip):$ApiPort" }
Write-Host "Administrator  : $AdminUsername"
if ($script:AdminKeptExisting) {
  Write-Host "Admin password : unchanged (existing account kept)" -ForegroundColor Yellow
} elseif ($script:GeneratedAdminPassword) {
  Write-Host "Admin password : $adminPasswordForDisplay" -ForegroundColor Yellow
  Write-Host "                 (shown once - store it safely)" -ForegroundColor Yellow
}
Write-Host "Backup folder  : $BackupDir"
Write-Host "Documentation  : $dataRoot\docs"
Write-Host "Start script   : $dataRoot\start-server.cmd"
if (-not $CreateAdmin) {
  Write-Host "`nNext steps:" -ForegroundColor Cyan
  Write-Host "  1. Install the ZhanX DentalCare client on this server PC (or a front-desk PC)." -ForegroundColor Cyan
  Write-Host "  2. Enter the clinic details and import the signed license issued for this PC's Device ID." -ForegroundColor Cyan
  Write-Host "  3. Create the clinic administrator inside the app, then sign in." -ForegroundColor Cyan
  Write-Host "  See docs\LICENSING.md for activation, reinstall and reactivation." -ForegroundColor Cyan
} else {
  Write-Host "Administrator  : $AdminUsername"
  if ($script:AdminKeptExisting) {
    Write-Host "Admin password : unchanged (existing account kept)" -ForegroundColor Yellow
  } elseif ($script:GeneratedAdminPassword) {
    Write-Host "Admin password : $adminPasswordForDisplay" -ForegroundColor Yellow
    Write-Host "                 (shown once - store it safely)" -ForegroundColor Yellow
  }
  Write-Host "`nNext: install the desktop client on each front-desk PC and point it at the LAN URL." -ForegroundColor Cyan
}
