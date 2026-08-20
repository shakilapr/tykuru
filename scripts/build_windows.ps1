#!/usr/bin/env pwsh
# Stub for the Windows release build. Delegates to the Tauri bundler once the
# bundling stage is implemented; fails loudly until then.

$ErrorActionPreference = "Stop"
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Error "pnpm is required to build."
    exit 1
}
pnpm build:windows
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
