@echo off
setlocal
set "FGO_DIAG_SCRIPT=%~f0"
set "FGO_DIAG_INPUT=%~1"
powershell.exe -NoLogo -NoProfile -STA -Command "$s=[IO.File]::ReadAllText($env:FGO_DIAG_SCRIPT);$m='#==FGO_POWERSHELL==#';& ([ScriptBlock]::Create($s.Substring($s.LastIndexOf($m)+$m.Length)))"
if not defined FGO_DIAG_AUTOMATED pause
exit /b
#==FGO_POWERSHELL==#
$ErrorActionPreference = 'Stop'
try {
    $inputFile = $env:FGO_DIAG_INPUT
    if (!$inputFile) { $inputFile = $env:FGO_DIAG_EXE }
    if (!$inputFile) {
        $beside = Join-Path (Split-Path -Parent $env:FGO_DIAG_SCRIPT) 'FGO Bond.exe'
        if (Test-Path -LiteralPath $beside -PathType Leaf) { $inputFile = $beside }
    }
    if (!$inputFile) {
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.OpenFileDialog
        $dialog.Title = 'Select the installed FGO Bond.exe'
        $dialog.Filter = 'FGO Bond.exe|FGO Bond.exe|Executable files (*.exe)|*.exe'
        if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
        $inputFile = $dialog.FileName
    }
    $file = Get-Item -LiteralPath $inputFile
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $pe = [ordered]@{valid=$false}
    $stream = [IO.File]::OpenRead($file.FullName)
    try {
        $header = New-Object byte[] 64
        if ($stream.Read($header,0,64) -ne 64 -or $header[0] -ne 77 -or $header[1] -ne 90) { throw 'Invalid DOS executable header' }
        $offset = [BitConverter]::ToUInt32($header,60)
        if ($offset -lt 64 -or $offset + 96 -gt $stream.Length) { throw 'Invalid PE header location' }
        [void]$stream.Seek($offset,[IO.SeekOrigin]::Begin)
        $header = New-Object byte[] 96
        if ($stream.Read($header,0,96) -ne 96 -or [BitConverter]::ToUInt32($header,0) -ne 17744) { throw 'Invalid PE executable signature' }
        $pe = [ordered]@{valid=$true;machine=('0x{0:x4}' -f [BitConverter]::ToUInt16($header,4));optionalMagic=('0x{0:x3}' -f [BitConverter]::ToUInt16($header,24));osMajor=[BitConverter]::ToUInt16($header,64);osMinor=[BitConverter]::ToUInt16($header,66);subsystemMajor=[BitConverter]::ToUInt16($header,72);subsystemMinor=[BitConverter]::ToUInt16($header,74)}
    } catch { $pe.error=$_.Exception.Message } finally { $stream.Dispose() }
    $known = 'unknown'
    if ($hash -eq '774080fcd33f4a735f3187651e55f00458636aa1916ae262651544bf4a6eae0f') { $known='2.1.25-original-or-rebuilt' }
    if ($hash -eq 'dc486056731ad940465a6e09970e81c3bca0969ff62e1400ab93f438373533f7') { $known='2.1.24' }
    $windows = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    $details = [ordered]@{format=1;windows=[ordered]@{productName=$windows.ProductName;displayVersion=$windows.DisplayVersion;edition=$windows.EditionID;build=$windows.CurrentBuildNumber;updateRevision=$windows.UBR;is64BitOS=[Environment]::Is64BitOperatingSystem;processArchitecture=$env:PROCESSOR_ARCHITECTURE;nativeArchitecture=$env:PROCESSOR_ARCHITEW6432};exe=[ordered]@{name=$file.Name;size=$file.Length;sha256=$hash;matchesPublished=$known;fileVersion=$file.VersionInfo.FileVersion;pe=$pe};runtimeFiles=@()}
    $folder = $file.Directory.FullName
    foreach ($name in @('ffmpeg.dll','vk_swiftshader.dll','vulkan-1.dll','resources\app.asar')) {
        $path = Join-Path $folder $name
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            $runtimeFile = Get-Item -LiteralPath $path
            $details.runtimeFiles += [ordered]@{name=$name;exists=$true;size=$runtimeFile.Length;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
        } else { $details.runtimeFiles += [ordered]@{name=$name;exists=$false} }
    }
    $output = $env:FGO_DIAG_OUT
    if (!$output) { $output = Join-Path (Split-Path -Parent $env:FGO_DIAG_SCRIPT) 'FGO-Diagnostic.json' }
    $json = $details | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText($output,$json,(New-Object Text.UTF8Encoding($false)))
    Write-Host ('Published executable match: '+$known)
    Write-Host ('Executable size: '+$file.Length+' bytes')
    Write-Host ('Report saved: '+$output)
} catch {
    Write-Host ('Diagnostic could not finish: '+$_.Exception.Message)
    exit 1
}
