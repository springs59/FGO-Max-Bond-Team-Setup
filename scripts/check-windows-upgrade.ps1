$ErrorActionPreference = 'Stop'
$installers = Get-ChildItem native/desktop/release/*.exe
$installer = ($installers | Where-Object { $_.Name -notmatch 'NoUpdate' } | Select-Object -First 1).FullName
$noUpdateInstaller = ($installers | Where-Object { $_.Name -match 'NoUpdate' } | Select-Object -First 1).FullName
if (!(Test-Path $installer)) { throw 'Standard Windows installer is missing' }
if (!(Test-Path $noUpdateInstaller)) { throw 'No-update Windows installer is missing' }
$installDir = Join-Path $env:RUNNER_TEMP 'FGO-Upgrade-Test'
$profileDir = Join-Path $env:RUNNER_TEMP 'FGO-Upgrade-Profile'
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
$env:FGO_SMOKE_PROFILE = $profileDir
$env:FGO_SMOKE_OUTPUT = Join-Path $env:RUNNER_TEMP 'fgo-upgrade-smoke.json'

function Install-App {
    param([string]$Installer, [string]$Target, [bool]$Updating)
    $arguments = @('/S')
    if ($Updating) { $arguments += '--updated' }
    $arguments += "/D=$Target"
    $process = Start-Process -FilePath $Installer -ArgumentList $arguments -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
}
function Run-Smoke {
    param([string]$Target)
    $exe = Join-Path $Target 'FGO Bond.exe'
    if (!(Test-Path $exe)) { throw 'Installed application is missing' }
    $process = Start-Process -FilePath $exe -ArgumentList '--smoke' -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw "Installed application smoke failed: $($process.ExitCode)" }
    $report = Get-Content $env:FGO_SMOKE_OUTPUT -Raw | ConvertFrom-Json
    if ($report.state -ne 'done') { throw 'Installed application did not finish local precomputation' }
    return $report
}
Install-App $installer $installDir $false
$first = Run-Smoke $installDir
$sentinel = Join-Path $profileDir 'upgrade-preserve.json'
Set-Content -Path $sentinel -Value '{"account":"upgrade-sentinel","keep":true}' -Encoding utf8
$before = (Get-FileHash $sentinel -Algorithm SHA256).Hash
if (!(Test-Path (Join-Path $profileDir 'IndexedDB'))) { throw 'Local precomputation database is missing' }
Install-App $installer $installDir $true
$second = Run-Smoke $installDir
if ((Get-FileHash $sentinel -Algorithm SHA256).Hash -ne $before) { throw 'Upgrade changed the user profile' }
if ($second.precomputeNeeded -ne $false) { throw 'Upgrade did not reuse unchanged local indexes' }
$env:FGO_SMOKE_OUTPUT = Join-Path $env:RUNNER_TEMP 'fgo-live-update-check.json'
$exe = Join-Path $installDir 'FGO Bond.exe'
$process = Start-Process -FilePath $exe -ArgumentList '--software-update-smoke' -PassThru -Wait
if ($process.ExitCode -ne 0) { throw 'Installed app failed to check the real GitHub release feed' }
$update = Get-Content $env:FGO_SMOKE_OUTPUT -Raw | ConvertFrom-Json
if ($update.state -notin @('current', 'available', 'ready')) { throw "Live software update check failed: $($update.error)" }
Write-Output "Installed app checked the real GitHub release feed: $($update.state), latest $($update.latestVersion)"
$noUpdateDir = Join-Path $env:RUNNER_TEMP 'FGO-NoUpdate-Test'
$noUpdateProfile = Join-Path $env:RUNNER_TEMP 'FGO-NoUpdate-Profile'
New-Item -ItemType Directory -Force -Path $noUpdateProfile | Out-Null
$env:FGO_SMOKE_PROFILE = $noUpdateProfile
$env:FGO_SMOKE_OUTPUT = Join-Path $env:RUNNER_TEMP 'fgo-capabilities-smoke.json'
Install-App $noUpdateInstaller $noUpdateDir $false
$noUpdateExe = Join-Path $noUpdateDir 'FGO Bond.exe'
$process = Start-Process -FilePath $noUpdateExe -ArgumentList '--capability-smoke' -PassThru -Wait
if ($process.ExitCode -ne 0) { throw 'No-update installer capability smoke failed' }
$capabilities = Get-Content $env:FGO_SMOKE_OUTPUT -Raw | ConvertFrom-Json
if ($capabilities.noUpdate -ne $true) { throw 'No-update installer still reports update support' }
if ($capabilities.auto -ne $false) { throw 'No-update installer kept automatic data updates enabled' }
if ($capabilities.softwareAuto -ne $false -or $capabilities.supported -ne $false) { throw 'No-update installer did not disable software updates' }
Write-Output 'NSIS original install and in-place update passed; user profile and IndexedDB precomputation survived.'
Write-Output 'No-update installer passed; software and automatic data updates are disabled.'
