#!/usr/bin/env pwsh
# Verify the bundled official Typst sidecar is present and matches the pinned
# checksum from config/versions.toml. Fails loudly; never reports success when
# the sidecar is missing or mismatched.

$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot/.."
$versions = Join-Path $root "config/versions.toml"
$sidecar = Join-Path $root "src-tauri/binaries/typst-x86_64-pc-windows-msvc.exe"

if (-not (Test-Path $sidecar)) {
    Write-Error "Typst sidecar not found at $sidecar. Run scripts/fetch_typst.ps1 first."
    exit 1
}

# Checksum verification is enforced once a version is pinned in versions.toml.
$content = Get-Content $versions -Raw
if ($content -match 'checksum_sha256\s*=\s*"([0-9a-fA-F]{64})"') {
    $expected = $Matches[1]
    $actual = (Get-FileHash -Algorithm SHA256 -Path $sidecar).Hash.ToLower()
    if ($actual -ne $expected) {
        Write-Error "Typst sidecar checksum mismatch. Expected $expected, got $actual."
        exit 1
    }
    Write-Host "Typst sidecar verified ($actual)."
} else {
    Write-Host "Typst sidecar present; checksum not yet pinned (skipping verification)."
}
