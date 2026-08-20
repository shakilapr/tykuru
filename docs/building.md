# Building & Packaging

How to produce a Tykuru build and installer.

## Frontend / app build

```text
pnpm install
pnpm build          # vite build (frontend) + tauri build wrapping
pnpm build:windows  # full Windows NSIS installer (release)
```

`pnpm build:windows` runs the Tauri bundler with the NSIS target and embeds the Typst sidecar and PDF.js assets.

## Typst sidecar

Tykuru ships the **official Typst CLI** as a Tauri sidecar (never embedded/reimplemented). The pinned version lives in `config/versions.toml`:

```toml
[typst]
version = "0.x.y"
target = "x86_64-pc-windows-msvc"
checksum_sha256 = "<expected>"
```

Fetch and verify:

```text
pwsh scripts/fetch_typst.ps1   # downloads into src-tauri/binaries/, verifies SHA-256
pwsh scripts/verify_typst.ps1  # asserts presence + checksum; fails loudly otherwise
```

The sidecar is referenced in `tauri.conf.json` under `bundle.externalBin`. It is **git-ignored**; only `src-tauri/binaries/.gitkeep` is committed.

## WebView2 strategy

Use **Evergreen WebView2** with the bootstrapper fallback (not a fixed runtime). This keeps the download/footprint small and lets Windows update the runtime independently.

## Installer

- Primary: **NSIS** (Tauri bundle).
- Declares the `.typ` file association so Tykuru appears as an Open With target (does **not** force itself as default).
- Generates a SHA-256 checksum for release artifacts.

## Clean build expectations

A clean machine (no global Typst) must be able to install and run Tykuru entirely from the bundled sidecar. See [windows-release.md](./windows-release.md).
