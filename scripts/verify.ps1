#!/usr/bin/env pwsh
# Run the local verification gate. Delegates to pnpm verify.
# Fails loudly if pnpm is missing or the gate does not pass.

$ErrorActionPreference = "Stop"
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Error "pnpm is required to run verification."
    exit 1
}
pnpm verify
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
