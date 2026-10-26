$ErrorActionPreference = 'Stop'
$repo = 'springs59/FGO-Max-Bond-Team-Setup'
$work = Join-Path $env:RUNNER_TEMP 'FGO binary comparison'
$out = Join-Path $PWD 'binary-diagnostics'
New-Item -ItemType Directory -Force $work,$out | Out-Null
$cases = @(
    @{label='old';tag='native-v2.1.24';name='FGO-Bond-Windows-2.1.24.exe';sha='2ff00410e84ecb4be0e8621c6a939db9669a097b38236aaadb204e6d3461737a'},
    @{label='original';tag='native-v2.1.25';name='FGO-Bond-Windows-2.1.25.exe';sha='ef3b91e31c47152d2cf7d18ff24c1b3d7173a72f5aec8cc85955c63cf542083a'},
    @{label='rebuilt';tag='native-v2.1.25';name='FGO-Bond-Windows-2.1.25-rebuilt.exe';sha='f966a712327b2bb340ecfe12af03eedc29c69e537243ac42f4e31412f982c5d3'}
)
$sevenZip = 'C:\Program Files\7-Zip\7z.exe'
foreach ($case in $cases) {
    $dir = Join-Path $work $case.label
    New-Item -ItemType Directory -Force $dir | Out-Null
    gh release download $case.tag --repo $repo --pattern $case.name --dir $dir
    if ($LASTEXITCODE -ne 0) { throw "Cannot download $($case.name)" }
    $installer = Join-Path $dir $case.name
    if ((Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $case.sha) { throw 'Published asset checksum mismatch' }
    $outer = Join-Path $dir 'installer-payload'
    & $sevenZip x $installer "-o$outer" -y | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'NSIS extraction failed' }
    $archives = @(Get-ChildItem $outer -Recurse -Filter 'app-64.7z')
    if ($archives.Count -ne 1) { throw 'App x64 archive missing' }
    $app = Join-Path $work ('FGO compare '+$case.label)
    & $sevenZip x $archives[0].FullName "-o$app" -y | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Application extraction failed' }
}
$env:WIN_COMPARE_ROOT = $work
python scripts/compare-windows-binaries.py
if ($LASTEXITCODE -ne 0) { throw 'PE binary inspection failed' }
$runs = @()
foreach ($case in $cases) {
    $app = Join-Path $work ('FGO compare '+$case.label)
    $exe = Join-Path $app 'FGO Bond.exe'
    $env:FGO_SMOKE_PROFILE = Join-Path $work ('profile-'+$case.label)
    $env:FGO_SMOKE_OUTPUT = Join-Path $out ($case.label+'-smoke.json')
    $process = Start-Process -FilePath $exe -ArgumentList '--smoke' -PassThru
    if (!$process.WaitForExit(180000)) { $process.Kill(); throw "Smoke timeout: $($case.label)" }
    if ($process.ExitCode -ne 0) { throw "Executable launch failed: $($case.label), $($process.ExitCode)" }
    $smoke = Get-Content $env:FGO_SMOKE_OUTPUT -Raw | ConvertFrom-Json
    if ($smoke.state -ne 'done') { throw "Incomplete app smoke: $($case.label)" }
    $runs += @{artifact=$case.label;state=$smoke.state;fileVersion=(Get-Item $exe).VersionInfo.FileVersion;sha256=(Get-FileHash $exe -Algorithm SHA256).Hash.ToLowerInvariant()}
    # Exercise the exact single-file helper on all three published executables.
    $env:FGO_DIAG_AUTOMATED = '1'
    $env:FGO_DIAG_EXE = $exe
    $env:FGO_DIAG_OUT = Join-Path $out ($case.label+'-local-diagnostic.json')
    $helper = (Resolve-Path 'scripts/Diagnose-FGO-2.1.25.cmd').Path
    $diag = Start-Process -FilePath $helper -PassThru -Wait -NoNewWindow
    if ($diag.ExitCode -ne 0) { throw 'Local diagnostic helper failed' }
    $info = Get-Content $env:FGO_DIAG_OUT -Raw | ConvertFrom-Json
    $expectedMatch = if ($case.label -eq 'old') { '2.1.24' } else { '2.1.25-original-or-rebuilt' }
    if ($info.exe.matchesPublished -ne $expectedMatch -or !$info.exe.pe.valid -or $info.exe.pe.machine -ne '0x8664') { throw 'Local diagnostic helper misidentified published executable' }
}
# A damaged executable must yield a report without being executed.
$broken = Join-Path $work 'broken.exe'
Set-Content -LiteralPath $broken -Value 'not an executable' -Encoding ascii
$env:FGO_DIAG_EXE = $broken
$env:FGO_DIAG_OUT = Join-Path $out 'broken-local-diagnostic.json'
$diag = Start-Process -FilePath $helper -PassThru -Wait -NoNewWindow
$info = Get-Content $env:FGO_DIAG_OUT -Raw | ConvertFrom-Json
if ($info.exe.pe.valid -or $info.exe.matchesPublished -ne 'unknown') { throw 'Damaged executable was not detected' }
$runtime = @{os=[Environment]::OSVersion.VersionString;osArchitecture=[Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString();results=$runs}
Set-Content (Join-Path $out 'runtime-comparison.json') ($runtime | ConvertTo-Json -Depth 6) -Encoding utf8
Write-Output ('ACTUAL_RUNTIME_COMPARISON='+($runtime | ConvertTo-Json -Depth 6 -Compress))
