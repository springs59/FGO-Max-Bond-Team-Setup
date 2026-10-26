param([ValidateSet('Repair','Installer')][string]$Mode)
$ErrorActionPreference = 'Stop'
$repo = 'springs59/FGO-Max-Bond-Team-Setup'
$work = Join-Path $env:RUNNER_TEMP ('FGO integrity '+$Mode)
$out = Join-Path $PWD 'integrity-output'
New-Item -ItemType Directory -Force $work,$out | Out-Null
$installerName = 'FGO-Bond-Windows-2.1.25.exe'
$mainHash = '774080fcd33f4a735f3187651e55f00458636aa1916ae262651544bf4a6eae0f'
$mainSize = 246238720
gh release download native-v2.1.25 --repo $repo --pattern $installerName --dir $work
if ($LASTEXITCODE -ne 0) { throw 'Release download failed' }
$original = Join-Path $work $installerName
if ((Get-FileHash $original -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'ef3b91e31c47152d2cf7d18ff24c1b3d7173a72f5aec8cc85955c63cf542083a') { throw 'Published installer digest mismatch' }
$sevenZip = 'C:\Program Files\7-Zip\7z.exe'
$outer = Join-Path $work 'outer'
& $sevenZip x $original "-o$outer" -y | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Installer extraction failed' }
$archives = @(Get-ChildItem $outer -Filter app-64.7z -Recurse)
if ($archives.Count -ne 1) { throw 'Expected application archive missing' }
$app = Join-Path $work 'Complete app'
& $sevenZip x $archives[0].FullName "-o$app" -y | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Application extraction failed' }
$exe = Join-Path $app 'FGO Bond.exe'
function Assert-Exe([string]$Path) {
    if ((Get-Item -LiteralPath $Path).Length -ne $mainSize -or (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $mainHash) { throw 'Executable does not match the complete published program' }
}
Assert-Exe $exe
if ($Mode -eq 'Repair') {
    $payload = Join-Path $work 'repair-payload'
    New-Item -ItemType Directory $payload | Out-Null
    Copy-Item $exe (Join-Path $payload 'FGO Bond.exe')
    $readme = @'
FGO Bond 2.1.25 主程序替换包

1. 退出 FGO Bond（如托盘仍有图标，右键选择退出）。
2. 将本 ZIP 全部解压，复制其中的 FGO Bond.exe。
3. 粘贴到已安装 FGO Bond 的目录，替换原来同名的残缺文件。
4. 从安装目录双击 FGO Bond.exe。不要在本 ZIP 或只含 EXE 的解压目录里直接运行。

完整主程序大小必须为 246,238,720 字节（约 234.83 MiB），不能是 241,172,480 字节（230 MiB）。
SHA-256: 774080fcd33f4a735f3187651e55f00458636aa1916ae262651544bf4a6eae0f
替换时确认目标磁盘有可用空间；若提示写入失败，需先解决该写入问题。
本包只替换主程序，不删除账号、方案、设置或计算数据，也不运行旧版卸载程序。
'@
    Set-Content (Join-Path $payload 'README-替换说明.txt') $readme -Encoding utf8
    Set-Content (Join-Path $payload 'SHA256SUMS.txt') "$mainHash  FGO Bond.exe" -Encoding ascii
    $zip = Join-Path $out 'FGO-Bond-Windows-2.1.25-exe-repair.zip'
    & $sevenZip a -tzip -mx=5 $zip (Join-Path $payload '*') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Repair ZIP creation failed' }
    $test = Join-Path $work 'reopened ZIP'
    Expand-Archive -LiteralPath $zip -DestinationPath $test
    Assert-Exe (Join-Path $test 'FGO Bond.exe')
    # Reproduce the exact confirmed 230 MiB truncation, then apply the repair ZIP.
    $stream = [IO.File]::Open($exe,[IO.FileMode]::Open,[IO.FileAccess]::Write)
    $stream.SetLength(241172480)
    $stream.Dispose()
    if ((Get-FileHash $exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'c64b807574a292f09b00ea503dc3669eefc35e0249e7e0b42440cd66844a800e') { throw 'Synthetic truncation did not reproduce the reported public-binary prefix' }
    Copy-Item (Join-Path $test 'FGO Bond.exe') $exe -Force
    Assert-Exe $exe
    $env:FGO_SMOKE_PROFILE = Join-Path $work 'repair-profile'
    $env:FGO_SMOKE_OUTPUT = Join-Path $out 'repair-smoke.json'
    $p = Start-Process $exe -ArgumentList '--smoke' -PassThru
    if (!$p.WaitForExit(180000)) { $p.Kill(); throw 'Repaired executable timed out' }
    $state = Get-Content $env:FGO_SMOKE_OUTPUT -Raw | ConvertFrom-Json
    if ($p.ExitCode -ne 0 -or $state.state -ne 'done') { throw 'Repaired program did not start and complete precomputation' }
    $result = @{size=$mainSize;exeSHA256=$mainHash;reproduced230MiBTruncation=$true;repairedFromFinalZip=$true;smoke=$state.state;zipSHA256=(Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()}
    Set-Content (Join-Path $out 'Windows-exe-repair-2.1.25-verification.json') ($result | ConvertTo-Json) -Encoding utf8
    gh release upload native-v2.1.25 $zip (Join-Path $out 'Windows-exe-repair-2.1.25-verification.json') --repo $repo
    if ($LASTEXITCODE -ne 0) { throw 'Repair ZIP publication failed' }
    Write-Output ('EXE_REPAIR_VERIFIED='+($result | ConvertTo-Json -Compress))
    exit 0
}
$source = (Resolve-Path rebuild-source).Path
$desktop = Join-Path $source 'native/desktop'
$packed = Join-Path $desktop 'release/win-unpacked'
New-Item -ItemType Directory -Force (Split-Path $packed) | Out-Null
Copy-Item $app $packed -Recurse
Copy-Item scripts/windows-integrity.nsh (Join-Path $desktop 'windows-integrity.nsh')
Push-Location $desktop
try {
    npx electron-builder --win nsis --x64 --prepackaged release/win-unpacked --publish never --config.nsis.include=windows-integrity.nsh --config.artifactName=FGO-Bond-Windows-2.1.25-checked.exe
    if ($LASTEXITCODE -ne 0) { throw 'Checked installer compilation failed' }
} finally { Pop-Location }
Assert-Exe (Join-Path $packed 'FGO Bond.exe')
# Reuse the already-verified complete install/upgrade/repair/shortcut suite, changing only artifact names.
$fixture = (Get-Content scripts/check-windows-rebuild.ps1 -Raw).Replace('FGO-Bond-Windows-2.1.25-rebuilt.exe','FGO-Bond-Windows-2.1.25-checked.exe').Replace('Windows-rebuilt-2.1.25','Windows-checked-2.1.25')
$fixturePath = Join-Path $work 'check-checked.ps1'
Set-Content $fixturePath $fixture -Encoding utf8
& $fixturePath -SourceRoot $source
if ($LASTEXITCODE -ne 0) { throw 'Checked installer regression failed' }
$faults = @('truncate','corrupt')
foreach ($fault in $faults) {
    $hook = if ($fault -eq 'truncate') {
@'
!macro FGO_TEST_BEFORE_VERIFY
  System::Call 'kernel32::CreateFileW(w "$INSTDIR\FGO Bond.exe", i 0x40000000, i 3, p 0, i 3, i 0, p 0) p.r0'
  System::Call 'kernel32::SetFilePointer(p r0, i 241172480, p 0, i 0) i.r1'
  System::Call 'kernel32::SetEndOfFile(p r0) i.r1'
  System::Call 'kernel32::CloseHandle(p r0)'
!macroend
'@
    } else {
@'
!macro FGO_TEST_BEFORE_VERIFY
  FileOpen $R9 "$INSTDIR\FGO Bond.exe" a
  FileSeek $R9 2 SET
  FileWriteByte $R9 0
  FileClose $R9
!macroend
'@
    }
    $hook += "`n!include windows-integrity.nsh`n"
    Set-Content (Join-Path $desktop 'windows-integrity-test.nsh') $hook -Encoding utf8
    Push-Location $desktop
    try {
        npx electron-builder --win nsis --x64 --prepackaged release/win-unpacked --publish never --config.nsis.include=windows-integrity-test.nsh "--config.artifactName=FGO-integrity-$fault-test.exe"
        if ($LASTEXITCODE -ne 0) { throw 'Negative-test installer compilation failed' }
    } finally { Pop-Location }
    $target = Join-Path $work ('fault-'+$fault)
    $negative = Join-Path $desktop "release/FGO-integrity-$fault-test.exe"
    $p = Start-Process $negative -ArgumentList @('/S',"/D=$target") -PassThru
    if (!$p.WaitForExit(180000)) { $p.Kill(); throw 'Negative-test installer timed out' }
    $status = Get-Content (Join-Path $target 'install-integrity.ini') -Raw
    if ($p.ExitCode -eq 0 -or $status -notmatch 'Status=failed') { throw 'Corrupt installation was incorrectly accepted' }
    if ($fault -eq 'truncate' -and (Get-Item (Join-Path $target 'FGO Bond.exe')).Length -ne 241172480) { throw 'Wrong truncation fixture size' }
    if ($fault -eq 'corrupt' -and (Get-Item (Join-Path $target 'FGO Bond.exe')).Length -ne $mainSize) { throw 'Hash-check fixture must preserve original size' }
    Write-Output "EXPECTED_INSTALL_REJECTION: $fault, exit=$($p.ExitCode), $status"
}
# Restore the last rejected test installation with the production checked installer.
$good = Join-Path $desktop 'release/FGO-Bond-Windows-2.1.25-checked.exe'
$p = Start-Process $good -ArgumentList @('/S',"/D=$target") -PassThru
if (!$p.WaitForExit(180000) -or $p.ExitCode -ne 0) { throw 'Production installer could not repair rejected installation' }
Assert-Exe (Join-Path $target 'FGO Bond.exe')
if ((Get-Content (Join-Path $target 'install-integrity.ini') -Raw) -notmatch 'Status=verified') { throw 'Installed integrity confirmation missing' }
Copy-Item $good (Join-Path $out 'FGO-Bond-Windows-2.1.25-checked.exe')
$result = @{size=$mainSize;exeSHA256=$mainHash;truncationRejected=$true;sameSizeCorruptionRejected=$true;repairAfterRejection=$true;directExeLaunch=$true;installerSHA256=(Get-FileHash $good -Algorithm SHA256).Hash.ToLowerInvariant()}
Set-Content (Join-Path $out 'Windows-checked-2.1.25-verification.json') ($result | ConvertTo-Json) -Encoding utf8
gh release upload native-v2.1.25 $good (Join-Path $out 'Windows-checked-2.1.25-verification.json') --repo $repo
if ($LASTEXITCODE -ne 0) { throw 'Checked installer publication failed' }
Write-Output ('CHECKED_INSTALLER_VERIFIED='+($result | ConvertTo-Json -Compress))
