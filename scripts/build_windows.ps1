#!/usr/bin/env pwsh
# Full Windows release build: fetch/verify the pinned Typst sidecar, build the
# frontend + Rust, bundle the NSIS installer, and generate SHA-256 checksums.
#
# Requires the MSVC Rust toolchain + Visual C++ Build Tools (architecture §6.2).
# NOT runnable in the mingw-only dev environment (see AGENTS.md).

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Error "pnpm is required to build."
    exit 1
}

# The sidecar is git-ignored; fetch it (idempotent, verifies checksum).
Write-Host "Fetching pinned Typst sidecar..."
& pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/fetch_typst.ps1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Frontend gates before the release build (cheap insurance).
& pnpm typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& pnpm lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& pnpm test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Frontend build + Rust release build + NSIS bundling + checksums.
& pnpm build:windows
exit $LASTEXITCODE
