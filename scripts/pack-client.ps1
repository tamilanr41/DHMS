$repo = "C:\DHMS\9fd0fe3a"
$stage = Join-Path $repo ".asar_stage"
$desktop = Join-Path $repo "apps\desktop"
$asarCmd = Join-Path $repo "node_modules\.bin\asar.cmd"
$asarTarget = Join-Path $repo "release\client\win-unpacked\resources\app.asar"

Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item -Recurse (Join-Path $desktop "dist") (Join-Path $stage "dist")
Copy-Item -Recurse (Join-Path $desktop "electron") (Join-Path $stage "electron")
Copy-Item (Join-Path $desktop "package.json") (Join-Path $stage "package.json")

& $asarCmd pack $stage $asarTarget
Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
Write-Host "ASAR_PACKED_CLEANLY_SUCCESS"
