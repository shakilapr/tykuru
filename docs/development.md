# Development

How to set up the Tykuru workspace and run it locally.

## Prerequisites

- **Node.js** 20+ and **pnpm** (`corepack enable` or install pnpm globally).
- **Rust** toolchain (stable) with the Windows target when building for Windows.
- **Typst sidecar** fetched by `scripts/fetch_typst.ps1` (see [building.md](./building.md)). Network access required on first fetch.
- On Windows: the **Evergreen WebView2** runtime (installed by the installer bootstrapper when missing).

## Repository layout

The authoritative map is `architecture.md §6`. Key boundaries:

- `src/` — React/TypeScript WebView frontend (presentation + pure logic). No native/fs/process code.
- `src-tauri/src/` — Rust backend (authority): `session`, `compiler`, `preview`, `source`, `settings`, `commands`.
- `bridge/` (frontend) ↔ `commands/` (backend) is the **only** IPC surface.
- `fixtures/` — real Typst sources used by integration tests.
- `scripts/` — Typst fetch/verify and Windows build helpers.
- `docs/` — this folder.

## Coding standards

Enforced by verification gates (`architecture.md §6.2`):

- Rust: typed errors, `Path`/`PathBuf`, sidecar-only Typst spawn (args separate, no shell), narrow Tauri commands, root-bounded writes.
- TypeScript: strict mode, no `any`, explicit async-race handling via `SessionId`/revision, native logic only in Rust.
- One IPC chokepoint; feature logic separated from UI.

## Run in development

```text
pnpm install
pnpm tauri dev
```

`pnpm tauri dev` launches the Rust backend and the Vite dev server together and opens the desktop window.

## Useful commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Alias for `tauri dev`. |
| `pnpm typecheck` | `tsc --noEmit` (strict). |
| `pnpm lint` | Lint the frontend. |
| `pnpm test` | Run Vitest unit/component tests. |
| `pnpm verify` | Full local gate (typecheck + lint + test + build + cargo fmt/clippy/test). |
| `pnpm typst:fixtures` | Real-Typst integration fixtures. |
| `pnpm test:e2e` | Desktop E2E (Windows runner). |
| `pnpm build:windows` | Produce the NSIS installer. |

See [testing.md](./testing.md) and [building.md](./building.md) for details.
