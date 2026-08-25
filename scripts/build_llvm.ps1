#!/usr/bin/env pwsh
# Local build with the LLVM-MinGW toolchain (llvm-mingw clang + lld).
#
# Why: the MSVC toolchain requires Visual C++ Build Tools (link.exe) which may
# not be installed; the classic GNU binutils ld hits "export ordinal too large"
# on the WebView2 import lib. The LLVM linker (lld) drives by clang handles both
# the SEH personality and the DLL export limit correctly.
#
# This sets up the environment then runs the given cargo command(s). Example:
#   pwsh scripts/build_llvm.ps1 cargo build
#   pwsh scripts/build_llvm.ps1 cargo clippy --all-targets --all-features -- -D warnings

$ErrorActionPreference = "Stop"

# Locate the llvm-mingw install (winget-installed on this machine). Override via
# LLVM_MINGW env var if installed elsewhere.
$candidate = $env:LLVM_MINGW
if (-not $candidate) {
    $winGetPkg = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Directory |
        Where-Object { $_.Name -like "MartinStorsjo.LLVM-MinGW*" } |
        Select-Object -First 1
    if ($winGetPkg) {
        $candidate = Get-ChildItem (Join-Path $winGetPkg.FullName "llvm-mingw-*") -Directory |
            Select-Object -First 1 -ExpandProperty FullName
    }
}
if (-not $candidate -or -not (Test-Path (Join-Path $candidate "bin\clang.exe"))) {
    Write-Error "llvm-mingw not found. Install via: winget install MartinStorsjo.LLVM-MinGW.MSVCRT (or set LLVM_MINGW)."
    exit 1
}

Write-Host "Using llvm-mingw at: $candidate"
$env:PATH = (Join-Path $candidate "bin") + ";" + ($env:PATH -replace 'D:\\Programs\\MinGW\\bin[;]?', '')

# Linker flags that make the GNU target link cleanly with lld:
#   - linker=clang        drive lld via llvm-mingw clang (x86_64-w64-windows-gnu)
#   - -lunwind            SEH unwinding (GCC personality) for Rust panic-unwind
#   - -l:libgcc_eh.a      _GCC_specific_handler / _Unwind_* symbols
#   - --exclude-all-symbols  keep cdylib exports under the 65535 DLL limit
$env:RUSTFLAGS = "-C linker=clang -C link-arg=-lunwind -C link-arg=-l:libgcc_eh.a -C link-arg=-Wl,--exclude-all-symbols"

& $args[0] @($args | Select-Object -Skip 1)
exit $LASTEXITCODE
