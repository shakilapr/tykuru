# Large-fixture performance benchmark (architecture §25, work-plan Stage 20
# decision gate). Measures Typst compile/watch latency and candidate-PDF size
# for fixtures/large across several runs, so the deferred range-capable preview
# protocol decision (architecture §13) can be revisited only with real numbers.
#
# This measures the Typst sidecar directly (the only part that depends on the
# document); Tykuru's own candidate → revision → binary-IPC → PDF.js overhead
# must be measured inside the running app (Stage 20), where the document is
# transferred through Tauri binary IPC. The script is the reproducible baseline.

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$sidecar = Join-Path $root "src-tauri/binaries/typst-x86_64-pc-windows-msvc-x86_64-pc-windows-msvc.exe"
if (-not (Test-Path $sidecar)) {
    Write-Error "Sidecar missing. Run scripts/fetch_typst.ps1 first."
    exit 1
}

$fixture = "large"
$entry = Join-Path $root "fixtures/$fixture/main.typ"
$fixtureRoot = Join-Path $root "fixtures/$fixture"
$workDir = Join-Path $env:TEMP "tykuru-perf-check"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
$out = Join-Path $workDir "$fixture.pdf"
$runs = 5

Write-Host "Benchmarking fixtures/$fixture with $sidecar"
Write-Host ("".PadRight(60, '-'))

$times = @()
$sizes = @()
for ($i = 1; $i -le $runs; $i++) {
    Remove-Item -Force $out -ErrorAction SilentlyContinue
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    & $sidecar compile $entry $out --root $fixtureRoot 2>&1 | Out-Null
    $sw.Stop()
    if (-not (Test-Path $out)) {
        Write-Error "fixtures/$fixture failed to compile on run $i"
    }
    $size = (Get-Item $out).Length
    $times += $sw.Elapsed.TotalSeconds
    $sizes += $size
    Write-Host ("run {0}: {1,7:N2}s   {2,9:N0} bytes" -f $i, $sw.Elapsed.TotalSeconds, $size)
}

$avgTime = ($times | Measure-Object -Average).Average
$avgSize = ($sizes | Measure-Object -Average).Average
Write-Host ("".PadRight(60, '-'))
Write-Host ("avg compile: {0:N2}s   avg size: {1:N0} bytes" -f $avgTime, $avgSize)

# Decision-gate heuristic (not a hard product metric): if the generated PDF
# stays modest (< ~10 MB) for this 20-page document, raw binary IPC transfer is
# not the bottleneck to pre-optimize; the range-capable protocol stays deferred.
if ($avgSize -gt 10MB) {
    Write-Host "NOTE: average size exceeds 10 MB — revisit the deferred PDFDataRangeTransport decision (architecture §13)."
} else {
    Write-Host "Average size within the 10 MB heuristic — binary IPC remains appropriate (architecture §13)."
}

Remove-Item -Recurse -Force $workDir -ErrorAction SilentlyContinue
exit 0
