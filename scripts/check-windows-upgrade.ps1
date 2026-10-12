$ErrorActionPreference = 'Stop'
$installer = (Get-ChildItem native/desktop/release/*.exe | Select-Object -First 1).FullName
$installDir = Join-Path $env:RUNNER_TEMP 'FGO-Upgrade-Test'
$profileDir = Join-Path $env:RUNNER_TEMP 'FGO-Upgrade-Profile'
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
$env:FGO_SMOKE_PROFILE = $profileDir
$env:FGO_SMOKE_OUTPUT = Join-Path $env:RUNNER_TEMP 'fgo-upgrade-smoke.json'

function Install-App {
    param([bool]$Updating)
    $arguments = @('/S')
    if ($Updating) { $arguments += '--updated' }
    $arguments += "/D=$installDir"
    $process = Start-Process -FilePath $installer -ArgumentList $arguments -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
}
function Run-Smoke {
    $exe = Join-Path $installDir 'FGO Bond.exe'
    if (!(Test-Path $exe)) { throw 'Installed application is missing' }
    $process = Start-Process -FilePath $exe -ArgumentList '--smoke' -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw "Installed application smoke failed: $($process.ExitCode)" }
    $report = Get-Content $env:FGO_SMOKE_OUTPUT -Raw | ConvertFrom-Json
    if ($report.state -ne 'done') { throw 'Installed application did not finish local precomputation' }
    return $report
}
Install-App $false
$first = Run-Smoke
$sentinel = Join-Path $profileDir 'upgrade-preserve.json'
Set-Content -Path $sentinel -Value '{"account":"upgrade-sentinel","keep":true}' -Encoding utf8
$before = (Get-FileHash $sentinel -Algorithm SHA256).Hash
if (!(Test-Path (Join-Path $profileDir 'IndexedDB'))) { throw 'Local precomputation database is missing' }
Install-App $true
$second = Run-Smoke
if ((Get-FileHash $sentinel -Algorithm SHA256).Hash -ne $before) { throw 'Upgrade changed the user profile' }
if ($second.precomputeNeeded -ne $false) { throw 'Upgrade did not reuse unchanged local indexes' }
if ($first.queryLibraryReused -ne $false -or $second.queryLibraryReused -ne $true) { throw 'Portable query library did not survive application replacement' }
if ($second.queryLibrarySchemes -lt 1 -or $second.queryLibraryBackupBytes -lt 1) { throw 'Global schemes or portable backup are missing after replacement' }
if ($first.queryLibrarySingleFile -ne $true -or $second.queryLibrarySingleFile -ne $true) { throw 'Native single-file stream backup did not complete before and after replacement' }
$env:FGO_SMOKE_OUTPUT = Join-Path $env:RUNNER_TEMP 'fgo-live-update-check.json'
$exe = Join-Path $installDir 'FGO Bond.exe'
$process = Start-Process -FilePath $exe -ArgumentList '--software-update-smoke' -PassThru -Wait
if ($process.ExitCode -ne 0) { throw 'Installed app failed to check the real GitHub release feed' }
$update = Get-Content $env:FGO_SMOKE_OUTPUT -Raw | ConvertFrom-Json
if ($update.state -notin @('current', 'available', 'ready')) { throw "Live software update check failed: $($update.error)" }
Write-Output "Installed app checked the real GitHub release feed: $($update.state), latest $($update.latestVersion)"
Write-Output 'NSIS original install and in-place update passed; user profile, IndexedDB precomputation and global query library survived.'
