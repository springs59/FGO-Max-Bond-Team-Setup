param([string]$SourceRoot = 'rebuild-source')
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path $SourceRoot).Path
$version = '2.1.25'
$filename = 'FGO-Bond-Windows-2.1.25-rebuilt.exe'
$installer = Join-Path $source "native/desktop/release/$filename"
$packed = Join-Path $source 'native/desktop/release/win-unpacked'
$installDir = Join-Path $env:RUNNER_TEMP 'FGO 重装检查 空格'
$profile = Join-Path $env:RUNNER_TEMP 'FGO-Rebuild-Profile'
$out = Join-Path $PWD 'rebuilt-output'
New-Item -ItemType Directory -Force $out, $profile | Out-Null
$env:FGO_SMOKE_PROFILE = $profile
$env:FGO_SMOKE_OUTPUT = Join-Path $out 'installed-smoke.json'
$expectedSource = '3e400384963b25ea67df7840a06f608d0c7f1b67'
$installerVersion = (Get-Item $installer).VersionInfo.FileVersion.Trim()
if ($installerVersion -notmatch '^2\.1\.25(\.0)?$') { throw "Wrong installer version: $installerVersion" }
$exe = Join-Path $installDir 'FGO Bond.exe'
$manifest = Get-Content (Join-Path $packed 'resources/site/generated/native-data-manifest.json') -Raw | ConvertFrom-Json
if ($manifest.revision -ne $expectedSource) { throw 'Rebuild is not from the released 2.1.25 source' }
$expected = @(Get-ChildItem $packed -File -Recurse | ForEach-Object {
    [ordered]@{path=[IO.Path]::GetRelativePath($packed,$_.FullName); hash=(Get-FileHash $_.FullName -Algorithm SHA256).Hash; size=$_.Length}
})
if ($expected.Count -lt 100) { throw 'Packaged application file list is incomplete' }
$results = [System.Collections.Generic.List[string]]::new()
function Install-Rebuilt {
    param([bool]$Update = $false)
    $arguments = @('/S')
    if ($Update) { $arguments += '--updated' }
    # NSIS requires /D to be last and consumes the complete remaining path, including spaces.
    $arguments += "/D=$installDir"
    $p = Start-Process -FilePath $installer -ArgumentList $arguments -PassThru
    if (!$p.WaitForExit(180000)) { $p.Kill(); throw 'Installer timed out' }
    if ($p.ExitCode -ne 0) { throw "Installer failed with exit $($p.ExitCode)" }
}
function Check-Files {
    foreach ($f in $expected) {
        $p = Join-Path $installDir $f.path
        if (!(Test-Path -LiteralPath $p -PathType Leaf)) { throw "Installed file missing: $($f.path)" }
        if ((Get-Item -LiteralPath $p).Length -ne $f.size -or (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne $f.hash) { throw "Installed file differs: $($f.path)" }
    }
    Write-Output "Verified all $($expected.Count) installed application files."
}
function Run-Smoke {
    $p = Start-Process -FilePath $exe -ArgumentList '--smoke' -PassThru
    if (!$p.WaitForExit(180000)) { $p.Kill(); throw 'Installed app smoke timed out' }
    if ($p.ExitCode -ne 0) { throw "Installed app failed: $($p.ExitCode)" }
    $report = Get-Content $env:FGO_SMOKE_OUTPUT -Raw | ConvertFrom-Json
    if ($report.state -ne 'done') { throw 'Installed app failed local precomputation' }
    return $report
}
function Get-AppShortcuts {
    $shell = New-Object -ComObject WScript.Shell
    $found = @()
    foreach ($category in @('desktop','start-menu')) {
        $roots = if ($category -eq 'desktop') {
            @([Environment]::GetFolderPath('DesktopDirectory'),[Environment]::GetFolderPath('CommonDesktopDirectory'))
        } else {
            @([Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('CommonPrograms'))
        }
        $matches = @()
        foreach ($root in $roots) {
            foreach ($link in @(Get-ChildItem -LiteralPath $root -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue)) {
                $target = $shell.CreateShortcut($link.FullName).TargetPath
                Write-Host "Shortcut inspection: $($link.FullName) -> $target"
                if ($target -eq $exe) { $matches += $link }
            }
        }
        if ($matches.Count -lt 1) { throw "No working app $category shortcut under $($roots -join ', ')" }
        $found += $matches
    }
    return $found
}
function Open-Shortcut {
    param([string]$Shortcut)
    Start-Process -FilePath $Shortcut | Out-Null
    $visible = $null
    for ($attempt=0; $attempt -lt 30; $attempt++) {
        $visible = Get-Process | Where-Object { $_.Path -eq $exe -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
        if ($visible) { break }
        Start-Sleep -Seconds 1
    }
    if (!$visible) { throw "Shortcut did not open a window: $Shortcut" }
    Write-Output "Shortcut opened real window: $($visible.MainWindowTitle)"
    return $visible
}
Install-Rebuilt
Check-Files
$shortcuts = @(Get-AppShortcuts)
$first = Run-Smoke
$sentinel = Join-Path $profile 'preserve-rebuild.json'
Set-Content $sentinel '{"keep":true,"fixture":"public-synthetic"}' -Encoding utf8
$sentinelHash = (Get-FileHash $sentinel -Algorithm SHA256).Hash
if (!(Test-Path (Join-Path $profile 'IndexedDB'))) { throw 'Precomputation database is missing' }
$results.Add('fresh-install-all-files-and-desktop-start-menu-shortcuts')
# Test upgrading while the real application opened from its shortcut is still running.
$running = Open-Shortcut $shortcuts[0].FullName | Select-Object -Last 1
Install-Rebuilt $true
Start-Sleep -Seconds 2
if (Get-Process | Where-Object { $_.Path -eq $exe }) { throw 'Upgrade left old application processes running' }
Check-Files
$second = Run-Smoke
if ($second.precomputeNeeded -ne $false) { throw 'Upgrade did not reuse local precomputation' }
$results.Add('upgrade-while-old-application-running')
# Reproduce the reported directory shape: keep folders, license text, PAK/DAT files and uninstaller,
# but remove the main executable and the other top-level runtime files in this disposable test install.
Get-ChildItem -LiteralPath $installDir -File | Where-Object {
    $_.Name -notlike 'Uninstall*.exe' -and $_.Extension -notin @('.pak','.dat','.txt','.html')
} | Remove-Item -Force
if (Test-Path -LiteralPath $exe) { throw 'Damaged-directory fixture still contains the main executable' }
Install-Rebuilt
Check-Files
$third = Run-Smoke
$results.Add('repair-install-with-missing-executable-and-runtime-files')
$uninstallers = @(Get-ChildItem -LiteralPath $installDir -Filter 'Uninstall*.exe' -File)
if ($uninstallers.Count -ne 1) { throw 'Installed uninstaller missing' }
$uninstaller = Start-Process -FilePath $uninstallers[0].FullName -ArgumentList '/S','/KEEP_APP_DATA' -PassThru
if (!$uninstaller.WaitForExit(120000)) { $uninstaller.Kill(); throw 'Uninstaller timed out' }
for ($attempt=0; $attempt -lt 30 -and (Test-Path -LiteralPath $exe); $attempt++) { Start-Sleep -Seconds 1 }
if (Test-Path -LiteralPath $exe) { throw 'Uninstall did not remove application executable' }
Install-Rebuilt
Check-Files
$shortcuts = @(Get-AppShortcuts)
$last = Run-Smoke
if ((Get-FileHash $sentinel -Algorithm SHA256).Hash -ne $sentinelHash) { throw 'Reinstall changed saved profile data' }
if ($last.precomputeNeeded -ne $false) { throw 'Reinstall lost local precomputation' }
$opened = Open-Shortcut $shortcuts[-1].FullName
Get-Process | Where-Object { $_.Path -eq $exe } | Stop-Process -Force -ErrorAction SilentlyContinue
$results.Add('uninstall-reinstall-preserves-profile-and-reopens-from-shortcut')
$hash = (Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -eq 'ef3b91e31c47152d2cf7d18ff24c1b3d7173a72f5aec8cc85955c63cf542083a') { throw 'Expected a freshly rebuilt installer' }
Copy-Item $installer (Join-Path $out $filename)
Set-Content (Join-Path $out 'Windows-rebuilt-2.1.25-SHA256.txt') "$hash  $filename" -Encoding ascii
$verification = [ordered]@{version=$version; source=$expectedSource; freshBuild=$true; filename=$filename; sha256=$hash; size=(Get-Item $installer).Length; checkedFiles=$expected.Count; unicodeAndSpaceInstallPath=$true; checks=$results.ToArray()}
Set-Content (Join-Path $out 'Windows-rebuilt-2.1.25-verification.json') ($verification | ConvertTo-Json -Depth 6) -Encoding utf8
Write-Output ($verification | ConvertTo-Json -Depth 6)
