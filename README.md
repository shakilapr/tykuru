# Tykuru

A small, local-first **Windows desktop application** for opening, previewing, and optionally editing [Typst](https://typst.app) documents.

Tykuru is a thin, reliable layer around the official Typst compiler:

```text
Open .typ  →  bundled official typst watch  →  PDF  →  PDF.js preview
```

It keeps the bundled Typst CLI as the single source of truth for compilation, and uses PDF.js to render the resulting PDF inside the app. The built-in editor is an optional convenience; you can use any external editor and Tykuru refreshes automatically.

> License: **GPLv3** — see [LICENSE](./LICENSE).

## Status

v1 is under active implementation following [architecture.md](./architecture.md) and [work-plan.md](./work-plan.md).

## Features

- Open a `.typ` file from the start screen, File > Open, drag-and-drop, or the command line.
- Live preview driven by the official `typst watch` incremental compiler.
- Last valid preview is kept visible when the document fails to compile.
- Viewport (page/offset/zoom) is preserved across refreshes.
- Optional collapsible CodeMirror editor for quick edits.
- External-editor safe: Tykuru detects conflicts and never silently overwrites your changes.
- Windows integration: double-click `.typ`, Open With, and second-instance forwarding all open in one window.
- Settings (theme, editor visibility, split ratio, recent files, project root) persisted safely.

## Requirements

- Windows 10 or 11 (primary target).
- [Evergreen WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) runtime (installed by the bundled bootstrapper if missing).
- To **build from source**: Rust toolchain + Node.js 20+ and pnpm.

## Build from source

```text
pnpm install
pnpm tauri dev        # run the app in development
pnpm build:windows    # produce the NSIS installer (release)
```

Other commands:

```text
pnpm verify           # typecheck + lint + test + build + cargo fmt/clippy/test
pnpm typst:fixtures   # run real-Typst integration fixtures
pnpm test:e2e         # desktop E2E (requires a Windows runner)
```

See [docs/building.md](./docs/building.md) for details.

## Usage

- **Open**: start screen button, `Ctrl+O`, or `tykuru.exe path.typ`.
- **Edit**: expand the editor pane, type, and changes autosave to the same `.typ` file.
- **Refresh**: automatic on any save (built-in or external).
- **Zoom**: `Ctrl+=` / `Ctrl+-` / `Ctrl+0` (page-width reset).

| Shortcut | Action |
| --- | --- |
| `Ctrl+O` | Open `.typ` |
| `Ctrl+S` | Save editor (when active/dirty) |
| `Ctrl+F` | Find on the focused surface |
| `Ctrl+=` | Preview zoom in |
| `Ctrl+-` | Preview zoom out |
| `Ctrl+0` | Reset / page-width preview |
| `Ctrl+\` | Toggle editor (when not in conflict) |

## Supported Typst behavior

Typst itself defines compatibility. Tykuru does not reimplement Typst; it compiles with the bundled CLI and renders the PDF. Fixtures cover: headings/equations/tables, local imports/includes, images, bibliography, Unicode, multipage, system fonts, and compile-error recovery. See [work-plan.md](./work-plan.md) for the compatibility matrix.

## Documentation

- [architecture.md](./architecture.md) — approved architecture, boundaries, data flow.
- [work-plan.md](./work-plan.md) — staged implementation plan and acceptance criteria.
- [docs/](./docs/) — how-to guides (development, building, testing, Windows release, contributing).

## Contributing

Conventional Commits, atomic changes, and docs kept in sync with implementation. See [docs/contributing.md](./docs/contributing.md).

## License

Tykuru is free software released under the [GNU General Public License v3.0](./LICENSE).
