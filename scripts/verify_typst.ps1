# Verifies the bundled Typst sidecar exists and matches the pinned checksum.
# Exits non-zero on any failure so CI can block compile tests before they run.

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$versionsPath = Join-Path $root "config/versions.toml"
$sidecarPath = Join-Path $root "src-tauri/binaries/typst-x86_64-pc-windows-msvc.exe"

if (-not (Test-Path $sidecarPath)) {
    Write-Error "Sidecar missing: $sidecarPath. Run scripts/fetch_typst.ps1 first."
    exit 1
}

$toml = Get-Content $versionsPath -Raw
if ($toml -match "(?m)^\s*checksum_sha256\s*=\s*`"?([^`"\r\n]+)`"?") {
    $expected = $Matches[1].Trim()
} else {
    Write-Error "checksum_sha256 not found in $versionsPath"
    exit 1
}

$actual = (Get-FileHash -Algorithm SHA256 $sidecarPath).Hash
if ($actual -ne $expected) {
    Write-Error "Checksum mismatch!`n  expected: $expected`n  actual:   $actual"
    exit 1
}

Write-Host "Sidecar verified: $sidecarPath ($actual)"
exit 0
