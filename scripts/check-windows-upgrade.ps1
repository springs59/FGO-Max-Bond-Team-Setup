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
Write-Output 'NSIS original install and in-place update passed; user profile and IndexedDB precomputation survived.'
