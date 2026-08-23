# Verifies every fully-local fixture compiles against the pinned Typst sidecar
# and produces a non-trivial PDF. Exits non-zero on the first failure.
#
# This is the executable compatibility gate (architecture §24.3, work-plan
# Stage 15). It does not replace the Rust integration tests; it gives a
# runnable sidecar-level check in environments where cargo cannot build.

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$sidecar = Join-Path $root "src-tauri/binaries/typst-x86_64-pc-windows-msvc-x86_64-pc-windows-msvc.exe"
if (-not (Test-Path $sidecar)) {
    Write-Error "Sidecar missing. Run scripts/fetch_typst.ps1 first."
    exit 1
}

# Fully-local fixtures (no network, no packages). `errors` is expected to fail.
$okFixtures = @("basic", "imports", "images", "bibliography", "unicode", "fonts", "multipage", "large")
$workDir = Join-Path $env:TEMP "tykuru-fixtures-check"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null

$failures = @()

foreach ($f in $okFixtures) {
    $entry = Join-Path $root "fixtures/$f/main.typ"
    $out = Join-Path $workDir "$f.pdf"
    Remove-Item -Force $out -ErrorAction SilentlyContinue
    $stderr = & $sidecar compile $entry $out --root (Join-Path $root "fixtures/$f") 2>&1 | Out-String
    if (-not (Test-Path $out)) {
        $failures += "${f}: compile failed`n$stderr"
        continue
    }
    $size = (Get-Item $out).Length
    $head = [System.IO.File]::ReadAllBytes($out)[0..4]
    $sig = [System.Text.Encoding]::ASCII.GetString($head)
    if ($sig -ne "%PDF-") {
        $failures += "${f}: output does not start with %PDF-"
        continue
    }
    if ($size -lt 1024) {
        $failures += "${f}: output too small ($size bytes)"
        continue
    }
    Write-Host "OK   $f ($size bytes)"
}

# Unicode temp-path check (work-plan Stage 15: "runtime temp test for Unicode
# source path"). Copies the `unicode` fixture into a temp directory whose path
# contains non-ASCII characters and compiles it. This exercises the sidecar and
# Tykuru's path handling without bundling any committed non-ASCII path.
$unicodeWork = Join-Path $env:TEMP "tykuru-π测试-fixture"
New-Item -ItemType Directory -Force -Path $unicodeWork | Out-Null
$unicodeEntry = Join-Path $unicodeWork "main.typ"
Copy-Item -Force (Join-Path $root "fixtures/unicode/main.typ") $unicodeEntry
$unicodeOut = Join-Path $unicodeWork "out.pdf"
Remove-Item -Force $unicodeOut -ErrorAction SilentlyContinue
$stderr = & $sidecar compile $unicodeEntry $unicodeOut --root $unicodeWork 2>&1 | Out-String
if (-not (Test-Path $unicodeOut)) {
    $failures += "unicode-temp-path: compile failed under non-ASCII path`n$stderr"
} else {
    $size = (Get-Item $unicodeOut).Length
    $head = [System.IO.File]::ReadAllBytes($unicodeOut)[0..4]
    $sig = [System.Text.Encoding]::ASCII.GetString($head)
    if ($sig -ne "%PDF-") {
        $failures += "unicode-temp-path: output does not start with %PDF-"
    } elseif ($size -lt 1024) {
        $failures += "unicode-temp-path: output too small ($size bytes)"
    } else {
        Write-Host "OK   unicode-temp-path ($size bytes)"
    }
}
Remove-Item -Recurse -Force $unicodeWork -ErrorAction SilentlyContinue

# The errors fixture must FAIL compilation (asserts diagnostic surfacing works).
$entry = Join-Path $root "fixtures/errors/main.typ"
$out = Join-Path $workDir "errors.pdf"
Remove-Item -Force $out -ErrorAction SilentlyContinue
$stderr = & $sidecar compile $entry $out --root (Join-Path $root "fixtures/errors") 2>&1 | Out-String
if (Test-Path $out) {
    $failures += "errors: expected compile failure but produced $out"
} elseif (-not $stderr.Trim()) {
    $failures += "errors: expected a diagnostic on stderr"
} else {
    Write-Host "OK   errors (fails with diagnostic, as expected)"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Fixture verification FAILED:" -ForegroundColor Red
    foreach ($m in $failures) { Write-Host "  - $m" }
    exit 1
}

Write-Host ""
$versionLine = (Get-Content (Join-Path $root 'config/versions.toml') | Where-Object { $_ -match '^\s*version\s*=' } | Select-Object -First 1)
Write-Host "All fixtures verified against Typst $versionLine."
Remove-Item -Recurse -Force $workDir -ErrorAction SilentlyContinue
exit 0
