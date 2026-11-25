$ErrorActionPreference = "Stop"
$env:WINCODESIGN_PATH = "C:\Users\acer\AppData\Local\electron-builder\Cache\winCodeSign\002414367"
$repo = "C:\DHMS\9fd0fe3a"
$desktop = Join-Path $repo "apps\desktop"

Set-Location $desktop
& npx electron-builder --win nsis
Write-Host "INSTALLER_BUILD_SUCCESS"
