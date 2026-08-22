# Generates SHA-256 checksums for built release artifacts (work-plan Stage 19).
#
# Runs after `pnpm tauri build --bundles nsis`. Writes a `.sha256` file next to
# each artifact in the bundler output directory.

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$bundleDir = Join-Path $root "src-tauri\target\release\bundle"

if (-not (Test-Path $bundleDir)) {
    Write-Error "Bundle directory not found at $bundleDir. Run `pnpm tauri build --bundles nsis` first."
    exit 1
}

$artifacts = Get-ChildItem -Path (Join-Path $bundleDir "nsis") -File -ErrorAction SilentlyContinue
if (-not $artifacts) {
    # Also collect MSI/zip if present in the bundle root.
    $artifacts = Get-ChildItem -Path $bundleDir -File -ErrorAction SilentlyContinue
}
if (-not $artifacts) {
    Write-Error "No release artifacts found under $bundleDir."
    exit 1
}

foreach ($a in $artifacts) {
    $hash = Get-FileHash -LiteralPath $a.FullName -Algorithm SHA256
    $checksumFile = "$($a.FullName).sha256"
    "$($hash.Hash.ToLowerInvariant())  $($a.Name)" | Set-Content -LiteralPath $checksumFile -Encoding utf8NoBOM
    Write-Host "SHA256  $($a.Name) -> $checksumFile"
}

Write-Host "Checksums written."
exit 0
