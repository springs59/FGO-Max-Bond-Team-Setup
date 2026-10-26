$ErrorActionPreference = 'Stop'
$repo = 'springs59/FGO-Max-Bond-Team-Setup'
$version = '2.1.25'
$tag = "native-v$version"
$expectedInstallerHash = 'ef3b91e31c47152d2cf7d18ff24c1b3d7173a72f5aec8cc85955c63cf542083a'
$expectedSource = '3e400384963b25ea67df7840a06f608d0c7f1b67'
$work = Join-Path $env:RUNNER_TEMP 'FGO Recovery Verification'
$out = Join-Path $PWD 'recovery-output'
New-Item -ItemType Directory -Force $work, $out | Out-Null
$installerName = "FGO-Bond-Windows-$version.exe"
gh release download $tag --repo $repo --pattern $installerName --dir $work
if ($LASTEXITCODE -ne 0) { throw 'Cannot download published installer' }
$installer = Join-Path $work $installerName
if ((Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedInstallerHash) { throw 'Published installer checksum mismatch' }
$sevenZip = 'C:\Program Files\7-Zip\7z.exe'
$outer = Join-Path $work 'installer-payload'
& $sevenZip x $installer "-o$outer" -y | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot extract NSIS payload' }
$archives = @(Get-ChildItem $outer -Recurse -Filter 'app-64.7z')
if ($archives.Count -ne 1) { throw "Expected one x64 application archive, found $($archives.Count)" }
$folderName = "FGO-Bond-Windows-$version"
$payload = Join-Path $work $folderName
& $sevenZip x $archives[0].FullName "-o$payload" -y | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot extract application archive' }
Get-ChildItem $payload | Select-Object Name, Length | Format-Table -AutoSize
$required = @('FGO Bond.exe', 'ffmpeg.dll', 'resources.pak', 'icudtl.dat', 'resources/app.asar', 'resources/site/index.html')
foreach ($relative in $required) {
    if (!(Test-Path (Join-Path $payload $relative) -PathType Leaf)) { throw "Application file missing: $relative" }
}
$manifest = Get-Content (Join-Path $payload 'resources/site/generated/native-data-manifest.json') -Raw | ConvertFrom-Json
if ($manifest.revision -ne $expectedSource) { throw 'Application source revision mismatch' }
$launcher = '@echo off' + "`r`n" + 'cd /d "%~dp0"' + "`r`n" + 'start "" "%~dp0FGO Bond.exe"' + "`r`n"
Set-Content -LiteralPath (Join-Path $payload 'Start-FGO-Bond.cmd') -Value $launcher -Encoding ascii
$readme = @'
FGO Bond 2.1.25 Windows 解压运行包

1. 右键 ZIP，选择“全部解压”，解压到一个新目录。不要直接在压缩包内运行。
2. 打开解压后的 FGO-Bond-Windows-2.1.25 文件夹。
3. 双击 FGO Bond.exe；也可双击 Start-FGO-Bond.cmd。
4. 需要桌面入口时，为 FGO Bond.exe 创建快捷方式。

本包从已发布的 2.1.25 安装包原样解出，无需执行旧版卸载程序，不要求删除旧安装或账号数据。
账号、设置和本地方案仍使用软件原有的用户配置目录，本包不是将数据写入解压目录的便携模式。
若解压后主程序或 DLL 消失，请查看 Windows 安全中心“保护历史记录”及所用安全软件的拦截记录；先核对实际记录，不需要关闭防护。
FILES-SHA256.json 是包内原始文件清单，可用于检查本机解压后的文件完整性。
'@
Set-Content -LiteralPath (Join-Path $payload 'README-启动说明.txt') -Value $readme -Encoding utf8
$files = @(Get-ChildItem $payload -File -Recurse | Sort-Object FullName | ForEach-Object {
    [ordered]@{path=[IO.Path]::GetRelativePath($payload, $_.FullName).Replace('\','/'); size=$_.Length; sha256=(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
})
$fileManifest = [ordered]@{version=$version; source=$expectedSource; originalInstallerSHA256=$expectedInstallerHash; files=$files}
Set-Content (Join-Path $payload 'FILES-SHA256.json') -Value ($fileManifest | ConvertTo-Json -Depth 6) -Encoding utf8
$zipName = "FGO-Bond-Windows-$version-unpacked.zip"
$zip = Join-Path $out $zipName
& $sevenZip a -tzip -mx=5 $zip (Join-Path $work $folderName) | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot create recovery ZIP' }
# Verify what the user downloads, rather than only the pre-ZIP build directory.
$extractRoot = Join-Path $work '中文路径 解压启动验证'
Expand-Archive -LiteralPath $zip -DestinationPath $extractRoot
$extracted = Join-Path $extractRoot $folderName
foreach ($file in $files) {
    $actual = Join-Path $extracted $file.path
    if (!(Test-Path -LiteralPath $actual -PathType Leaf)) { throw "ZIP file missing: $($file.path)" }
    if ((Get-Item -LiteralPath $actual).Length -ne $file.size -or (Get-FileHash -LiteralPath $actual -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256) { throw "ZIP file changed: $($file.path)" }
}
$env:FGO_SMOKE_PROFILE = Join-Path $work 'isolated-user-profile'
$env:FGO_SMOKE_OUTPUT = Join-Path $out 'windows-unpacked-smoke.json'
$exe = Join-Path $extracted 'FGO Bond.exe'
# First launch the exact CMD entry shipped to the user, and require a real visible window.
# --smoke uses an isolated profile; the normal run below uses the runner's disposable account.
Start-Process -FilePath (Join-Path $extracted 'Start-FGO-Bond.cmd') -WorkingDirectory $extracted -Wait
$visible = $null
for ($attempt=0; $attempt -lt 30; $attempt++) {
    $visible = Get-Process | Where-Object { $_.Path -eq $exe -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($visible) { break }
    Start-Sleep -Seconds 1
}
if (!$visible) { throw 'Shipped launcher did not open an application window' }
Write-Output "Verified actual launcher window: $($visible.MainWindowTitle)"
Get-Process | Where-Object { $_.Path -eq $exe } | Stop-Process -Force
Start-Sleep -Seconds 2
$process = Start-Process -FilePath $exe -ArgumentList '--smoke' -PassThru
if (!$process.WaitForExit(180000)) { $process.Kill(); throw 'Extracted application timed out' }
if ($process.ExitCode -ne 0) { throw "Extracted application failed: $($process.ExitCode)" }
$report = Get-Content $env:FGO_SMOKE_OUTPUT -Raw | ConvertFrom-Json
if ($report.state -ne 'done') { throw 'Extracted app failed local data and precomputation check' }
$checksum = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content (Join-Path $out "Windows-unpacked-$version-SHA256.txt") -Value "$checksum  $zipName" -Encoding ascii
$result = [ordered]@{version=$version; source=$expectedSource; installerHashVerified=$true; extractedFiles=$files.Count; allFileHashesMatch=$true; requiredRuntimeFiles=$required; actualLauncherWindowVerified=$true; launchedFromUnicodeAndSpacePath=$true; smokeState=$report.state; archiveSHA256=$checksum}
Set-Content (Join-Path $out 'windows-unpacked-verification.json') -Value ($result | ConvertTo-Json -Depth 5) -Encoding utf8
Write-Output ($result | ConvertTo-Json -Depth 5)
