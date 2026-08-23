# Fetches the official Typst release binary and verifies its SHA-256.
#
# The sidecar is git-ignored (large generated binary). Run this script on a
# fresh clone or in CI to obtain the bundled Typst binary matching the version/
# checksum pinned in config/versions.toml.
#
# Tauri `externalBin` requires the file to carry the target-triple suffix, i.e.
# `typst-x86_64-pc-windows-msvc-x86_64-pc-windows-msvc.exe` for an MSVC build.
# The MSVC suffix is what the bundled official Typst release maps to.

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$versionsPath = Join-Path $root "config/versions.toml"
$binDir = Join-Path $root "src-tauri/binaries"
# externalBin entry + target triple + extension (architecture §6.2.1).
$sidecarName = "typst-x86_64-pc-windows-msvc-x86_64-pc-windows-msvc.exe"
$sidecarPath = Join-Path $binDir $sidecarName

# Parse minimal TOML values we need (no external TOML parser dependency).
$toml = Get-Content $versionsPath -Raw
function Get-TomlValue($key) {
    if ($toml -match "(?m)^\s*$key\s*=\s*`"?([^`"\r\n]+)`"?") { return $Matches[1].Trim() }
    throw "Could not find '$key' in $versionsPath"
}

$version = Get-TomlValue "version"
$expectedChecksum = Get-TomlValue "checksum_sha256"

$url = "https://github.com/typst/typst/releases/download/v$version/typst-x86_64-pc-windows-msvc.zip"
$tmpZip = Join-Path $env:TEMP "typst-$version.zip"

Write-Host "Downloading Typst $version from $url"
Invoke-WebRequest -Uri $url -OutFile $tmpZip -UseBasicParsing

$tmpExtract = Join-Path $env:TEMP "typst-extract-$version"
if (Test-Path $tmpExtract) { Remove-Item -Recurse -Force $tmpExtract }
New-Item -ItemType Directory -Force -Path $tmpExtract | Out-Null
Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract -Force

$extractedExe = Get-ChildItem $tmpExtract -Filter "typst.exe" -Recurse | Select-Object -First 1
if (-not $extractedExe) { throw "typst.exe not found in downloaded archive" }

$actual = (Get-FileHash -Algorithm SHA256 $extractedExe.FullName).Hash
if ($actual -ne $expectedChecksum) {
    throw "Checksum mismatch!`n  expected: $expectedChecksum`n  actual:   $actual"
}
Write-Host "Checksum OK: $actual"

New-Item -ItemType Directory -Force -Path $binDir | Out-Null
Copy-Item $extractedExe.FullName -Destination $sidecarPath -Force
Write-Host "Sidecar written to $sidecarPath"

Remove-Item -Force $tmpZip -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $tmpExtract -ErrorAction SilentlyContinue
