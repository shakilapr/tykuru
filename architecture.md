# Tykuru Architecture

**Repository:** `tykuru`  
**Product:** Tykuru  
**Document:** `architecture.md`  
**Status:** v1 implementation baseline  
**Primary target:** Windows 11, with Windows 10 support where practical  
**Primary document type:** Typst `.typ`  
**Architecture style:** thin desktop shell around the official Typst compiler

---

## 1. Product definition

Tykuru is a local-first Windows desktop application for opening, previewing, and optionally editing Typst documents.

The core user workflow is intentionally small:

```text
Open .typ
   ↓
Official Typst compiler
   ↓
PDF
   ↓
Live preview
```

The user may edit the source in any external editor. Tykuru watches the compiler output and refreshes automatically when Typst recompiles the document.

Tykuru also provides a collapsible lightweight editor for quick edits:

```text
┌───────────────────────────────┬─────────────────────────────────────┐
│ optional editor               │ live Typst preview                  │
│                               │                                     │
│ CodeMirror 6                  │ PDF.js                              │
│                               │                                     │
└───────────────────────────────┴─────────────────────────────────────┘
```

The editor is an optional convenience. Tykuru is not intended to become a full IDE.

### 1.1 Required v1 behavior

A completed v1 must be able to:

1. Launch as a normal Windows desktop application.
2. Open a `.typ` file from inside Tykuru.
3. Accept a `.typ` path passed to `tykuru.exe`.
4. Register Tykuru as an available Windows handler for `.typ` files.
5. Support **Open with → Tykuru**.
6. Support double-click opening when the user chooses Tykuru as the association.
7. Render using the bundled official Typst compiler.
8. Refresh automatically when the source or a Typst dependency changes.
9. Preserve the last valid preview when the document temporarily fails to compile.
10. Preserve useful preview position and zoom across refreshes.
11. Show/hide a collapsible built-in editor.
12. Save editor changes to the same `.typ` file on disk.
13. Avoid silently overwriting changes made by an external editor.
14. Exit without leaving orphan `typst.exe` processes.
15. Install and run on a clean Windows machine without requiring a global Typst installation.

---

## 2. Non-goals for v1

The following are explicitly outside the v1 architecture unless later approved:

- replacing Typst's compiler;
- implementing a Typst parser/evaluator/layout engine;
- implementing a second Typst compiler in WASM;
- full IDE/LSP functionality;
- integrated terminal;
- Git UI;
- package manager UI;
- multi-document tabs;
- multi-window document ownership;
- collaborative editing;
- cloud document storage;
- user accounts;
- telemetry/analytics;
- document database;
- custom PDF renderer;
- local HTTP server;
- Electron.

These can be reconsidered after v1 only if a real requirement justifies them.

---

## 3. Architecture principles

### 3.1 Typst is the language authority

The official Typst CLI is the only Typst implementation in Tykuru.

Tykuru must not duplicate:

- parsing;
- evaluation;
- layout;
- package resolution;
- bibliography logic;
- font discovery;
- image decoding rules;
- dependency tracking;
- PDF generation.

This is the main compatibility strategy. If a document works in the bundled Typst CLI under the same root/font/package conditions, Tykuru should not deliberately alter its semantics.

### 3.2 Disk is the source of truth

The `.typ` file on disk is canonical.

```text
External editor ──────┐
                      ├──> main.typ on disk ──> Typst
Tykuru CodeMirror ────┘
```

The built-in editor may contain temporary unsaved state, but Tykuru does not maintain a second persistent document representation.

### 3.3 Preview-first UI

The default mode is preview-only.

The editor can be expanded only when needed.

### 3.4 Last-good-preview continuity

Compilation failure is a normal editing state.

The previous valid PDF remains visible until a newer valid PDF is committed.

### 3.5 Backend owns privileged operations

The React frontend does not receive arbitrary filesystem or process access.

Rust owns:

- file opening;
- source reads/writes;
- path validation;
- Typst process lifecycle;
- cache ownership;
- preview publication;
- Windows command-line/open handling;
- project root selection;
- settings persistence.

### 3.6 Small, explicit frontend

React is used to keep component behavior and UI composition predictable.

React does not imply a large web application architecture. Avoid routers, server state frameworks, global stores, and other infrastructure unless there is a demonstrated need.

### 3.7 Windows is the final acceptance platform

Cross-platform-friendly implementation is preferred, but a feature affecting process spawning, file opening, packaging, file associations, path handling, or WebView behavior is not release-complete until verified on Windows.

---

## 4. Approved technology stack

| Layer | Technology | Role |
|---|---|---|
| Desktop shell | Tauri 2 | Native desktop runtime and packaging |
| Backend | Rust | Process, filesystem, sessions, cache, Windows integration |
| Async execution | Tauri async runtime (Tokio-based) | Application concurrency; no separate owned runtime |
| Cancellation | `tokio-util::CancellationToken` | Optional, resource cleanup only |
| Frontend framework | React | UI composition and stateful components |
| Language | TypeScript | Typed frontend implementation |
| Frontend build | Vite | Development/build pipeline |
| Styling | Tailwind CSS | Consistent utility-based styling |
| UI primitives | shadcn/ui | Reusable accessible UI components |
| Primitive base | Base UI (shadcn default) | Underlying accessible component primitives |
| Icons | Lucide React | One consistent icon family |
| Editor | CodeMirror 6 | Lightweight optional source editor |
| Typst engine | Official Typst CLI sidecar | Compilation and watch mode |
| Preview format | PDF | Native Typst output |
| Preview engine | PDF.js / `pdfjs-dist` (pinned) | Document rendering, text, links, search |
| Preview delivery | Tauri binary IPC (`tauri::ipc::Response`) | Identity-addressed PDF bytes to WebView |
| Native file dialog | Tauri dialog plugin | Open `.typ` / choose project root |
| Single instance | Tauri single-instance plugin | Route later launches to existing app |
| Filesystem notifications | Rust `notify` (parent-directory watchers) | Hint that candidate PDF / source may have changed |
| Settings | Typed serde JSON + safe/atomic persistence | UI state, recent files, root overrides |
| Logging | `log` + `tauri-plugin-log` | File/stdout diagnostics with identifiers |
| Unit tests | Vitest + Rust tests | Frontend/backend logic |
| UI tests | React Testing Library where useful | Component behavior |
| Desktop E2E | Tauri-supported WebDriver/WebdriverIO path | Windows application flows |
| Installer | Tauri NSIS | Primary Windows installer |
| Web runtime | Evergreen WebView2 (bootstrapper fallback) | Windows webview dependency |

### 4.1 Dependencies intentionally not approved

Do not add another equivalent stack without explicit architecture approval:

- Material UI;
- Chakra;
- Ant Design;
- Bootstrap;
- another CSS framework;
- another icon family;
- Redux/Zustand by default;
- React Router by default;
- a second PDF renderer;
- a second Typst implementation;
- linking the Typst compiler as a Rust library instead of the CLI sidecar;
- WebView2 native PDF viewer as the primary preview;
- a second async runtime the application owns;
- mandatory `tracing` span infrastructure before it is needed;
- CSS-in-JS / styled-components / a second design system.

### 4.2 Frozen primitive base

shadcn/ui primitives are backed by Base UI by default for new Tykuru scaffolding. Radix and React Aria remain supported; do not mix primitive foundations per-component unless a concrete component limitation forces it.

---

## 5. High-level architecture

```text
                WINDOWS / USER ENVIRONMENT

 Explorer / Open With       External Editor
          │                      │
          │ .typ path            │ saves files
          ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         TYKURU / TAURI 2                            │
│                                                                     │
│  ┌──────────────────────── RUST BACKEND ─────────────────────────┐  │
│  │                                                               │  │
│  │ OpenRequestRouter                                             │  │
│  │       │                                                       │  │
│  │       ▼                                                       │  │
│  │ SessionManager                                                │  │
│  │       │                                                       │  │
│  │       ├── SourceService (SourceWriter)                        │  │
│  │       ├── ProjectRootService                                  │  │
│  │       ├── CompilerService ────────┐                           │  │
│  │       ├── PreviewRevisionStore    │                           │  │
│  │       ├── PreviewDelivery         │                           │  │
│  │       ├── DiagnosticState         │                           │  │
│  │       ├── SettingsStore           │                           │  │
│  │       └── ShutdownCoordinator     │                           │  │
│  │                                   │                           │  │
│  └───────────────────────────────────│───────────────────────────┘  │
│                                      │                              │
│                                      ▼                              │
│                         bundled official Typst CLI                  │
│                                      │                              │
│                         typst watch entry.typ candidate.pdf         │
│                                      │                              │
│                                      ▼                              │
│                       candidate PDF (notify hint)                   │
│                                      │                              │
│                      stable full read + sanity check               │
│                                      │                              │
│                           write NEW immutable revision              │
│                                      │                              │
│                          preview-updated(id, n)                     │
│                                      │                              │
│                          get_preview_pdf(id, n)                     │
│                                      │                              │
│                           binary Tauri IPC                          │
│                                      │                              │
│  ┌────────────────────── REACT WEBVIEW FRONTEND ─────────────────┐ │
│  │                                                                │ │
│  │ App                                                            │ │
│  │ ├── Toolbar / status                                           │ │
│  │ ├── Resizable split layout                                     │ │
│  │ ├── CodeMirror editor (optional)                               │ │
│  │ ├── diagnostics                                                │ │
│  │ └── PDF.js preview (getDocument({ data }))                     │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Repository layout

```text
tykuru/
├─ AGENTS.md
├─ README.md
├─ architecture.md
├─ work-plan.md
├─ LICENSE
├─ .editorconfig
├─ .gitignore
├─ package.json
├─ pnpm-lock.yaml
├─ tsconfig.json
├─ vite.config.ts
├─ components.json                 # shadcn configuration
├─ config/
│  └─ versions.toml                # pinned Typst/tool versions
│
├─ src/                            # React/TypeScript WebView frontend
│  ├─ main.tsx
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ AppLayout.tsx
│  │  └─ app-state.ts              # DocumentUiState reducer + ThemeProvider
│  │
│  ├─ components/                  # presentational React components
│  │  ├─ ui/                       # shadcn-owned/copied primitives (Base UI)
│  │  ├─ toolbar/Toolbar.tsx
│  │  ├─ editor/                   # EditorPane, TypstEditor, SaveStatus
│  │  ├─ preview/                  # PreviewPane, PdfViewer, PreviewToolbar, DiagnosticBanner
│  │  └─ layout/WorkspaceSplit.tsx
│  │
│  ├─ bridge/                      # ONLY place that talks to Tauri IPC
│  │  ├─ commands.ts               # typed invoke() wrappers
│  │  ├─ events.ts                 # event-name constants
│  │  └─ types.ts                  # types mirroring Rust command/event payloads
│  │
│  ├─ editor/                      # editor logic (no React components)
│  │  ├─ autosave.ts
│  │  ├─ source-sync.ts            # Clean/Dirty/Saving/Conflict state machine
│  │  └─ editor-state.ts
│  │
│  ├─ preview/                     # preview logic (no React components)
│  │  ├─ preview-controller.ts     # revision event → getDocument({ data })
│  │  ├─ view-state.ts
│  │  └─ revision-guard.ts         # isNewerRevision / isSameSession
│  │
│  ├─ hooks/                       # reusable React hooks
│  ├─ lib/utils.ts                 # shadcn cn() helper
│  └─ styles/globals.css           # Tailwind + theme tokens
│
├─ src-tauri/                      # Rust backend (authority)
│  ├─ Cargo.toml
│  ├─ Cargo.lock
│  ├─ build.rs
│  ├─ tauri.conf.json
│  ├─ capabilities/default.json    # minimal permissions (no fs/shell/process)
│  ├─ binaries/typst-<target-triple>[.exe]
│  ├─ icons/
│  └─ src/
│     ├─ main.rs                   # entry → tykuru_lib::run()
│     ├─ lib.rs                    # app builder, plugin registration, run()
│     ├─ app_state.rs              # AppState (managed state wrappers)
│     ├─ open_request.rs           # OpenRequestRouter + arg/path parsing
│     ├─ shutdown.rs               # ShutdownCoordinator
│     │
│     ├─ session/                  # one active document
│     │  ├─ mod.rs  manager.rs  model.rs  root.rs
│     │
│     ├─ compiler/                 # owns Typst sidecar lifecycle
│     │  ├─ mod.rs  sidecar.rs  output_watch.rs  diagnostic.rs
│     │
│     ├─ preview/                  # candidate → immutable revision → IPC
│     │  ├─ mod.rs  revisions.rs  delivery.rs
│     │
│     ├─ source/                   # disk authority for the entry file
│     │  ├─ mod.rs  read.rs  write.rs (SourceWriter)  external_watch.rs
│     │
│     ├─ settings/                 # typed, atomic persistence
│     │  ├─ mod.rs  model.rs  store.rs
│     │
│     └─ commands/                 # narrow Tauri command surface only
│        ├─ mod.rs  document.rs  editor.rs  settings.rs  preview.rs
│
├─ fixtures/                       # real Typst sources for integration tests
│  ├─ basic/ imports/ images/ bibliography/ unicode/
│  ├─ multipage/ errors/ fonts/ large/
│
├─ tests/
│  ├─ frontend/                    # Vitest + RTL
│  ├─ integration/                 # Rust tests driving the real sidecar
│  └─ e2e/                         # WebdriverIO desktop flows
│
├─ scripts/
│  ├─ fetch_typst.ps1  verify_typst.ps1  verify.ps1  build_windows.ps1
│
└─ .github/workflows/
   ├─ verify.yml  windows-release.yml
```

The tree is the authoritative ownership map. Do not create every leaf file immediately; create a module when its stage begins. Every new capability must fit into exactly one of the existing top-level boundaries — if it does not, extend the architecture before adding it.

### 6.1 Codebase structure principles

These principles keep the tree future-proof and easy to manage. They are enforced by review and by `cargo clippy` / `tsc` / lint gates.

- **Two-sided boundary.** The WebView frontend (`src/`) is untrusted-ish presentation; the Rust backend (`src-tauri/src/`) is the authority. Native logic (filesystem, process, cache, paths, Windows, settings) never lives in React.
- **One IPC chokepoint.** All frontend↔backend communication goes through `bridge/` on the frontend and `commands/` + typed event channels on the backend. No ad-hoc `invoke` strings scattered in components; no direct filesystem/process access from the WebView.
- **Feature logic is separated from UI.** `editor/` and `preview/` hold pure logic and state machines; `components/` hold only React presentation. This lets logic be unit-tested without a DOM and reused if the UI layer changes.
- **Backend is modular by responsibility.** `session`, `compiler`, `preview`, `source`, `settings` are independent verticals that share `AppState` and a `SessionId`. New cross-cutting behavior belongs in a focused module, never as a grab-bag utility.
- **Commands are narrow and typed.** Each Tauri command maps to one capability (e.g. `save_source`, `get_preview_pdf`). Prefer `SessionId`/revision identity over raw paths. See §20.
- **Types are shared by mirror.** Frontend `bridge/types.ts` mirrors Rust payload structs. Keep them in sync; treat a mismatch as a build-breaking change.
- **Tests live beside their layer.** Frontend logic under `tests/frontend`, Rust integration under `tests/integration`, desktop flows under `tests/e2e`, fixtures under `fixtures/`. Real Typst behavior is validated against the bundled sidecar, never mocked away.
- **No generated/vendor output in source control.** `node_modules/`, `dist/`, `src-tauri/target/`, Tykuru cache, and temporary PDFs are git-ignored. See §27.5.
- **Stable module surface.** Public module APIs (`mod.rs` re-exports) should change only with an architecture update. Internal refactors stay within a module.

### 6.2 Coding standards

Standards are enforced by the verification gates (§27.3) and by `cargo clippy -- -D warnings`, `tsc --noEmit` (strict), `pnpm lint`, and `pnpm test`. They are not advisory.

#### 6.2.1 Rust (backend)

- Strict, explicit error handling: define typed `Error`/`Result` per module (e.g. `thiserror`); do not use `unwrap()`/`expect()` on realistic failure paths (file I/O, process spawn, IPC).
- Use `Path`/`PathBuf` everywhere for paths; never build paths with string concatenation or shell interpolation.
- Spawn Typst only through Tauri sidecar APIs with arguments passed separately — never `cmd.exe`/`powershell`/`sh`.
- Expose only narrow typed Tauri commands; never generic filesystem/process commands to the frontend.
- Cache deletion and settings writes must be root-bounded (Tykuru cache root, settings path only).
- Concurrency is correct via `SessionId` checks first, `CancellationToken`/task handles second (§8.3).
- Keep modules small and single-responsibility; `mod.rs` is the public surface.
- Document non-obvious constraints (TOCTOU, Windows sharing, async races) with comments; do not restate code.

#### 6.2.2 TypeScript / React (frontend)

- TypeScript strict mode; `noUncheckedIndexedAccess` on. Avoid `any`; model backend payloads explicitly in `bridge/types.ts`.
- Handle async races explicitly: always carry `sessionId`/`revision` and discard stale results (see `revision-guard.ts`).
- Keep filesystem/process/cache/Windows logic out of React — it lives in Rust and is reached only via `bridge/`.
- Reuse shadcn/ui + Base UI primitives and Tailwind semantic tokens; avoid duplicate controls and hard-coded colors.
- Pure logic (autosave, source-sync, preview-controller, revision-guard, view-state) is framework-agnostic and unit-tested without a DOM.
- Components are presentational and receive state via props/context, not by reaching into backend directly.

#### 6.2.3 Cross-cutting

- Conventional Commits (`type(scope): message`); atomic, buildable commits (§27).
- Line length and formatting follow `.editorconfig` and `cargo fmt` / Prettier-equivalent; CI blocks unformatted code.
- No secrets, generated output, caches, or temporary PDFs are committed (§27.5).
- Update `architecture.md`/`work-plan.md` when behavior or boundaries change; docs must match implementation.
- Prefer small, focused diffs; no unrelated refactors or speculative infrastructure in a feature change.

---

## 7. Frontend architecture

### 7.1 React responsibilities

React owns presentation and local UI state only.

Examples:

- toolbar visibility;
- editor collapsed/expanded;
- split ratio;
- PDF zoom controls;
- diagnostic expansion;
- transient save indicator;
- focus behavior.

React does not own the authoritative document/session/process state.

### 7.2 shadcn/ui policy

Use shadcn/ui for common primitives instead of inventing parallel components.

Initial useful primitives:

- `Button`;
- `Tooltip`;
- `DropdownMenu`;
- `Dialog`;
- `Separator`;
- `ResizablePanelGroup` / equivalent;
- `ScrollArea` where appropriate;
- `Popover`;
- `Command` only if a command palette is later justified;
- `Select`, `Switch`, `Input` for settings as needed.

Do not import components in bulk. Add only components currently used.

### 7.3 Tailwind policy

Use Tailwind for layout, spacing, typography, responsive behavior, and semantic theme tokens.

Prefer:

```text
bg-background
text-foreground
border-border
text-muted-foreground
bg-muted
text-destructive
```

Avoid component-local hard-coded colors unless representing something that cannot reasonably use the theme system.

### 7.4 Themes

Support at least:

- system;
- light;
- dark.

Theme implementation should use CSS variables/design tokens so PDF.js and CodeMirror integration can adapt without separate duplicated palettes.

### 7.5 Frontend state model

Use a small explicit state model.

Conceptual example:

```ts
type CompileUiState =
  | { kind: "idle" }
  | { kind: "compiling" }
  | { kind: "ready"; revision: number }
  | { kind: "error"; message: string; lastGoodRevision?: number };

type DocumentUiState =
  | { kind: "empty" }
  | { kind: "opening"; name?: string }
  | {
      kind: "open";
      sessionId: string;
      filename: string;
      compile: CompileUiState;
    };
```

Avoid a global state library until state complexity demonstrates that React state/context is insufficient.

---

## 8. Rust backend architecture

### 8.1 Core model

v1 supports one active document.

Conceptually:

```rust
struct DocumentSession {
    id: SessionId,
    entry_path: PathBuf,
    project_root: PathBuf,
    cache_dir: PathBuf,
}
```

`DocumentSession` answers "what document is this" (static identity). Runtime
state — what is happening to the document right now — lives in `AppState`
under the same lock discipline as the other registries:

```rust
struct AppState {
    session_manager: Mutex<SessionManager>,
    revision_registry: Mutex<RevisionRegistry>,
    compile_states: Mutex<CompileStateRegistry>,
    compiler_manager: CompilerManager,
    candidate_watcher: Mutex<Option<RecommendedWatcher>>,
    source_revision_registry: Mutex<SourceRevisionRegistry>,   // §15.3, §16
    source_watcher: Mutex<Option<RecommendedWatcher>>,         // §12.1b, §16
    cache_root: PathBuf,
}
```

Use domain-specific wrapper types where useful:

```text
SessionId
PreviewRevision
DiskRevision    // SHA-256 of file bytes; stronger than mtime/size (§15.3)
SourceSnapshot
```

### 8.2 One active session invariant

```text
active sessions <= 1
Typst watcher for active session <= 1
Typst processes after app shutdown = 0
```

Opening another `.typ` cleanly tears down the previous session before the new session becomes authoritative.

### 8.3 Async ownership

Tykuru runs on Tauri's async runtime; it does not create or conceptually own a separate Tokio runtime. Where useful, Tokio ecosystem primitives (for example `tokio-util::CancellationToken`) may be used underneath it.

Every session-specific asynchronous event must carry the `SessionId`.

This includes:

- compiler output events;
- candidate PDF events;
- source watch events;
- frontend preview updates;
- save operations where relevant.

A stale event from an old session must be rejected.

Correct correctness hierarchy:

```text
SessionId checking      correctness (stale results discarded regardless of cancellation)
CancellationToken       resource cleanup
task handles             orderly shutdown
```

Cancellation is not instantaneous, so `SessionId`-based rejection remains the primary correctness guarantee even after a task is cancelled.

---

## 9. Opening `.typ` files

All entry points normalize into one backend request.

Conceptually:

```rust
enum OpenRequest {
    Path(PathBuf),
}
```

Supported sources:

1. Start-screen **Open .typ** button.
2. File/Open command.
3. Drag and drop.
4. `tykuru.exe path.typ`.
5. Windows **Open with**.
6. Associated double-click.
7. Second application launch forwarded into the running instance.

### 9.1 Path validation

Before opening:

- require a readable regular file;
- normally require extension `.typ`, case-insensitive on Windows;
- preserve Unicode;
- support spaces and parentheses;
- canonicalize when practical;
- never pass a path through shell string interpolation;
- do not accept arbitrary URL schemes as document paths.

### 9.2 Single-instance behavior

Use Tauri's single-instance plugin.

The first instance owns the window.

Later launches:

```text
Explorer opens second.typ
        ↓
second Tykuru process starts
        ↓
single-instance callback forwards argv
        ↓
first process parses OpenRequest
        ↓
first window restores/focuses
        ↓
second.typ replaces current active session
```

The first process must also parse its own initial startup arguments.

### 9.3 Windows association

Declare `.typ` as a supported file association in Tauri bundle configuration.

Tykuru must not silently force itself as the default handler. Windows/user choice remains authoritative.

---

## 10. Project root

Default:

```text
project_root = parent(entry.typ)
```

This correctly supports the common structure:

```text
paper/
├─ main.typ
├─ template.typ
├─ refs.bib
└─ images/
```

Provide an optional **Set Project Root…** action for documents that intentionally import outside the entry file's directory.

Do not infer a universal Typst project root from `typst.toml`.

When root changes:

1. validate/canonicalize root;
2. ensure it is a directory;
3. update stored override;
4. restart the compiler session;
5. retain last-good preview until new compile succeeds.

---

## 11. Typst compiler subsystem

### 11.1 Bundling

Ship an official Typst executable as a Tauri sidecar.

Example Windows path:

```text
src-tauri/binaries/typst-x86_64-pc-windows-msvc.exe
```

The exact version is pinned in one machine-readable location such as:

```text
config/versions.toml
```

Do not silently update the compiler at runtime.

### 11.2 Process launch

Conceptual command:

```text
typst watch <entry.typ> <session-cache>/candidate.pdf --root <project-root>
```

Rules:

- launch the binary directly, never through `cmd.exe` or PowerShell;
- pass arguments separately;
- retain the child handle (`CommandChild`) in `CompilerProcess`;
- capture stderr/stdout;
- terminate the old child before replacing the session;
- terminate child on shutdown via `ShutdownCoordinator`;
- do not allow two watcher children for one active session.

A bundled sidecar does not automatically solve process lifecycle. Add an explicit Windows acceptance test covering application upgrade / reinstall / shutdown leaving no `typst.exe` process behind; do not trust framework abstraction for sidecar lifecycle around installers/updaters.

### 11.3 Why `typst watch`

Typst already owns dependency tracking and incremental compilation. Tykuru should not rebuild that system.

Changes to imported `.typ`, `.bib`, images, templates, or other compiler dependencies should be handled through Typst's own watcher/compiler behavior.

### 11.4 Diagnostics

v1 may expose compiler stderr as a bounded diagnostic message without relying on fragile detailed parsing.

A later version can add richer location parsing if there is a stable machine-readable format worth depending on.

UI states:

```text
Compiling
Ready
Error
```

Error does not imply preview deletion.

---

## 12. Preview publication pipeline

PDF.js must never read a PDF while Typst may still be replacing it.

Use a candidate + immutable revision design.

```text
Typst
  ↓
candidate.pdf
  ↓
verify readable completed snapshot
  ↓
revision-000001.pdf
revision-000002.pdf
revision-000003.pdf
  ↓
PDF.js loads committed revision only
```

### 12.1 Candidate verification

A `notify` event is only a hint that the candidate *might* have changed. It is never evidence that Typst has finished writing the file; `%PDF-` can already be present in a still-being-written file.

On candidate change:

1. confirm event belongs to active `SessionId`;
2. debounce/coalesce the hint;
3. perform a bounded stable full read (read fully, re-stat, confirm unchanged within a short window);
4. require non-zero length;
5. verify `%PDF-` signature and basic PDF sanity;
6. write a brand-new uniquely named revision file fully, then close it;
7. mark the new revision current;
8. emit `preview-updated(sessionId, revision)`;
9. safely garbage-collect old revisions.

Because the revision filename is new, it is never exposed while being written. No Rust PDF parser is introduced; Typst remains responsible for valid PDF.

#### Notify watching strategy

Watch parent directories non-recursively rather than watching single files. Editors save differently: some truncate in place, others replace the file via rename. Watching a parent directory produces less surprising behavior for both cases.

- watch `parent(entry.typ)` non-recursively, filter events involving `entry.typ` for editor synchronization;
- watch the session cache directory for `candidate.pdf`;
- treat `Modify`/`Create`/`Remove`/`Rename` mostly as "something relevant may have happened; re-evaluate authoritative state";
- a small local debounce/re-stat state machine is preferred over `notify-debouncer-full` for the tiny number of interesting files.

`notify` must never evolve into a second Typst build/dependency system.

The source watcher (`parent(entry.typ)`, entry file only) synchronizes the
built-in editor buffer. It does **not** track imports, bibliography, images, or
other compiler dependencies; `typst watch` owns the full source-graph
dependency watch and refreshes the preview independently (§16).

### 12.2 Revision ordering

Preview revisions are monotonically increasing per session.

Frontend must reject:

- old sessions;
- older revision numbers;
- a PDF load that completes after a newer revision is already displayed.

Example race:

```text
revision 4 load starts
revision 5 load starts
revision 5 finishes
revision 4 finishes later
```

Revision 4 must not replace revision 5.

### 12.3 Last-good preview

If compilation fails, no new revision is published.

The last committed PDF stays visible.

---

## 13. Preview delivery to WebView

Do not expose arbitrary filesystem paths to the frontend.

v1 uses raw binary IPC rather than a custom preview protocol. Tauri's `tauri::ipc::Response` returns file bytes as an `ArrayBuffer` without JSON serialization, and PDF.js consumes in-memory `Uint8Array` data through `getDocument({ data })`.

Flow:

```text
preview-updated(sessionId, revision)
              ↓
frontend asks for revision
              ↓
get_preview_pdf(sessionId, revision)
              ↓
Rust validates SessionId + revision
              ↓
returns binary IPC Response (ArrayBuffer)
              ↓
PDF.js getDocument({ data })
```

Security requirements:

- reject unknown session;
- reject unknown revision;
- never accept an arbitrary source path from the frontend;
- no browser URL caching of preview content;
- no arbitrary filesystem exposure or traversal.

A custom range-capable protocol (`PDFDataRangeTransport`) is deferred until a `fixtures/large` benchmark demonstrates a real transfer/overhead problem. The boundary stays identity-addressed, never path-addressed. The reproducible baseline is `pnpm perf:large` (`scripts/benchmark_large.ps1`); on this project's reference machine the 20-page `fixtures/large` compiles in ~0.43 s to ~430 KB, well under the heuristic threshold. Only an in-app measurement showing a real transfer/memory problem (architecture §25, work-plan Stage 20) justifies revisiting this decision.

---

## 14. PDF.js viewer architecture

The viewer should remain minimal.

Use PDF.js's tested display/viewer machinery wherever possible; Tykuru controls the surrounding toolbar/state rather than reimplementing a viewer from raw primitives. Pin the `pdfjs-dist` version and include selection/search/view-state behavior in the fixture/E2E suite, since PDF.js has had regressions in those areas.

v1 features:

- vertical continuous pages;
- page-width default;
- zoom in/out/reset;
- text selection;
- copy;
- internal links;
- safe handling of external links;
- find/search;
- page number awareness;
- view-state restoration.

### 14.1 View-state preservation

Track:

```text
scale mode/value
visible page
relative vertical offset inside page
```

On a newer PDF:

1. keep old preview visible;
2. begin loading new PDF;
3. confirm load still corresponds to newest revision/session;
4. swap preview;
5. restore approximate page/offset/zoom;
6. do not steal editor focus.

### 14.2 Lazy viewport rendering

Compilation produces a whole new PDF revision, but the viewer must not eagerly
rasterize every page of it. Rasterization is the dominant cost on refresh.

Rendering policy per new revision:

- obtain the real page dimensions for every page (cheap; no rasterization) so
  placeholders hold the correct height and the scrollbar is accurate;
- render the currently visible page first, then nearby pages (±1–2), and only
  render farther pages lazily on scroll (IntersectionObserver / virtualization);
- cancel in-flight page renders when a newer revision or a viewport change
  arrives;
- keep the previously displayed document visible until the new revision's first
  visible page has rendered, then swap atomically (complements §12.3 last-good);
- view-state restoration (§14.1) runs after the visible pages render.

Tykuru does not predict which source edit affects which pages; Typst owns
document-wide incremental layout. Tykuru minimizes perceived latency by
prioritizing only the visible portion of each new revision.

### 14.3 Preview latency measurement

Instrument the refresh pipeline with monotonic timestamps (Stage 10b):

```text
T0 = source/save change observed
T1 = Typst output observed (candidate write)
T2 = stable preview revision ready
T3 = frontend notified (preview-updated)
T4 = PDF.js document ready
T5 = visible/current page painted
```

Record and log the per-stage deltas. Optimize deeper (range-capable delivery,
page-level cache, SVG experiment) only when a measured delta justifies it.
Broader application profiling (memory, CPU, startup, stress) remains Stage 20.

---

## 15. Built-in editor architecture

Use CodeMirror 6.

The editor is not a second application core. It is a view/controller for the active disk file.

### 15.1 Initial editor scope

- UTF-8 text;
- line numbers;
- undo/redo;
- basic bracket/quote behavior;
- find/replace where inexpensive;
- Ctrl+S;
- autosave;
- saved/saving/conflict state;
- collapsible/resizable pane.

Do not block v1 on LSP/completion.

### 15.2 Save path

```text
CodeMirror transaction
        ↓
frontend dirty state
        ↓
200–300 ms debounce
        ↓
save_source(sessionId, text, expectedDiskRevision)
        ↓
Rust validates session and disk revision
        ↓
SourceWriter save transaction
        ↓
write active entry file
        ↓
Typst watch recompiles
        ↓
new preview revision
```

The frontend must not receive an unrestricted `write_file(path, contents)` command.

Source-write semantics are a dedicated, tested abstraction (`SourceWriter`), not a buried `std::fs::write`. Conceptually:

```text
receive expected disk revision
        ↓
revalidate disk immediately
        ↓
prepare replacement through temp sibling / safe write
        ↓
final revision check
        ↓
commit (atomic replace where practical)
        ↓
record self-write identity
```

The check-then-write gap is a TOCTOU race; Tykuru detects all normal external-edit conflicts and never knowingly overwrites a newer disk revision. It avoids aggressive Windows write-locking so it remains a good citizen alongside VS Code/Zed/etc.

The same `SourceWriter::save` transaction is reused for **conflict resolution**
("Keep my version", §16): the caller passes the conflicting external revision as
the expected revision, so the resolution re-checks disk before overwriting and
fails into `Conflict` if a newer external write landed in the meantime.

### 15.3 Self-write detection

Tykuru must not interpret its own successful write as an external edit.

`last_self_write` is a per-session `DiskRevision` stored in
`AppState.source_revision_registry`. On save, the new revision (deterministic
SHA-256 of the text) is recorded **before** the file write becomes observable to
the source watcher. The watcher ignores a notification whose new `DiskRevision`
equals `last_self_write`; the identity is content-based, never timestamp-based.
The registry entry is removed when the session closes, so late filesystem
events for a dead `SessionId` are discarded (§8.3).

---

## 16. External editor synchronization

Tykuru must coexist with VS Code, Zed, Neovim, and any other editor or writer of
the active `.typ`. Disk is the shared source of truth; every writer goes through
the filesystem, and the two consumers below are independent.

```text
                     filesystem (paper.typ)
                          |
            ┌─────────────┴─────────────┐
            │                           │
            ▼                           ▼
      SourceWatcher               typst watch
      (entry file only)            (full source graph)
            │                           │
            ▼                           ▼
      editor sync                  PDF revision
            │                           │
            ▼                           ▼
        CodeMirror                    preview
```

### 16.1 Pipelines are independent

- The **preview follows disk/Typst, never CodeMirror state.** A `Conflict` in
  the editor never freezes or alters the preview.
- **Imported/bibliography/image dependencies** are owned by `typst watch`: they
  refresh the preview but do not touch the built-in editor buffer, which shows
  the entry file only.
- The **source watcher** synchronizes only the entry file that the built-in
  editor displays. It never reimplements Typst's dependency tracking.

### 16.2 Editor state model

```text
Clean  ←────────── local edit ────────── Dirty
  ▲                                        │
  │ external change                        │ external change
  │ (silent reload)                        ▼
  │                                      Conflict
  │                                        │
  └─────────── Reload external ────────────┤
                                           │ Keep my version
                                           ▼
                                         Clean
```

`Saving` is a transient sub-state of `Dirty`/`Clean` while a write is in flight.

### 16.3 External change while the editor is Clean

Silently reload the buffer from disk and update the disk-revision ledger. No
modal, toast, or notification; the workflow is "VS Code save → Tykuru updates",
the same refresh cadence as the preview. Preserve cursor/selection and scroll
best-effort: clamp line/column to the new document, restore approximate scroll.

### 16.4 External change while the editor is Dirty

Enter `Conflict`. Autosave is suspended; no automatic write happens. The user
must choose explicitly — never silently pick a winner.

- **Reload external** — discard the local pending buffer and load disk.
- **Keep my version** — write the local buffer over disk, **revision-checked**:
  the conflicting external revision is the expected revision, so if disk moved
  again (B → C) the write is rejected and `Conflict` remains, refreshed to the
  latest external revision with a "file changed again" indication. The next
  Keep authorizes overwriting that newer revision.

### 16.5 Conflict snapshot

The conflict holds `{ base_revision, local_buffer, external_revision }`. When a
Keep attempt fails against a newer external revision, the snapshot's
`external_revision` is refreshed to the newest disk revision. Source revisions
are transient synchronization tokens: old snapshots and registry entries are
discarded on change or session close. No history/journal is retained.

---

## 17. Cache architecture

Generated output must never pollute the user's Typst project.

Conceptual location:

```text
%LOCALAPPDATA%/Tykuru/cache/sessions/<session-id>/
├─ candidate.pdf
├─ revision-000001.pdf
└─ revision-000002.pdf
```

Rules:

- only delete beneath the known Tykuru cache root;
- never follow user-controlled cleanup paths;
- tolerate missing files;
- remove obsolete session cache on normal shutdown where practical;
- have bounded startup cleanup for stale sessions from crashes.

Cache deletion code requires explicit root-boundary tests.

---

## 18. Settings

Keep settings small and strongly typed.

Represent settings as a typed Rust struct serialized to JSON:

```rust
struct SettingsV1 {
    version: u32,
    theme: Theme,
    editor_visible: bool,
    split_ratio: f64,
    recent_files: BoundedRecentFiles,
    root_overrides: RootOverrideMap,
    // optional custom Typst font paths if implemented
}
```

This gives compile-time structure and an explicit migration point. Tauri Store is acceptable if minimizing custom code is preferred over explicit schema typing, but the typed-struct approach is preferred.

Allowed v1 settings include:

- light/dark/system theme;
- editor shown/hidden;
- editor split ratio;
- last window size/position where safe;
- bounded recent files list;
- project-root override by canonical entry path;
- optional custom Typst font paths if implemented.

Persist safely. A direct in-place overwrite can corrupt `settings.json` on crash. Use a temporary sibling file, flush, then atomic replace (or a mature atomic-write helper). This is inexpensive robustness; defaults remain a safe fallback.

Do not store document contents.

No database is required.

---

## 19. UI composition

### 19.1 Default preview mode

```text
┌───────────────────────────────────────────────────────────────┐
│ Tykuru   main.typ       Ready               − 100% +     ⋯   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│                        PDF PREVIEW                            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 19.2 Split mode

```text
┌─────────────────────────────┬─────────────────────────────────┐
│ main.typ                    │ Ready                  100%     │
├─────────────────────────────┼─────────────────────────────────┤
│                             │                                 │
│ CodeMirror                  │ PDF.js                          │
│                             │                                 │
│                             │                                 │
└─────────────────────────────┴─────────────────────────────────┘
```

### 19.3 Minimal toolbar

Initial controls:

- Open;
- toggle editor;
- document name;
- compile status;
- zoom out;
- zoom value/page-width state;
- zoom in;
- small overflow menu.

Do not introduce a permanent project sidebar in v1.

---

## 20. Tauri command boundary

Commands should be narrow and typed.

Conceptual command surface:

```text
open_document_dialog()
open_document(path_or_open_request)
close_document(session_id)
get_active_session()
read_source(session_id)
save_source(session_id, text, expected_disk_revision)
resolve_source_conflict_keep_local(session_id, content, expected_external_revision)
set_project_root(session_id, root)
set_project_root_dialog(session_id)  // native folder picker, returns on cancel
get_settings()
update_settings(patch)
```

Events:

```text
session-opened
compile-state-changed
preview-updated
source-changed
source-conflict
session-closed
```

Avoid an API such as:

```text
execute(command)
read_file(path)
write_file(path, data)
delete_file(path)
```

These are too broad for the frontend trust boundary.

---

## 21. Security model

Treat file paths, source contents, URLs, and launch arguments as untrusted input.

Required controls:

- no shell interpolation;
- narrow Tauri permissions;
- no arbitrary frontend process spawning;
- no arbitrary frontend filesystem access;
- no path traversal in preview delivery (identity-addressed, never path-addressed);
- cache cleanup stays under cache root;
- external link opening is deliberate;
- no Tykuru-owned upload/network behavior;
- no telemetry by default.

Typst may use network access when resolving an uncached package according to Typst's own behavior. Tykuru should not duplicate that package client.

---

## 22. Error model

Expected errors are represented as application states instead of crashes.

Examples:

- unreadable `.typ`;
- deleted source file;
- Typst startup failure;
- Typst syntax error;
- missing import;
- package fetch failure;
- missing image;
- candidate PDF read race;
- malformed candidate PDF;
- PDF.js load failure;
- source write failure;
- external edit conflict.

A Typst syntax error must never terminate Tykuru.

---

## 23. Logging

Use normal Rust `log` integration with `tauri-plugin-log`. This provides `error`/`warn`/`info`/`debug`/`trace` levels, file and stdout logging, without requiring `tracing` span infrastructure. Introduce `tracing` later only if genuinely needed for structured spans/profiling.

Suggested levels:

- `error` — unrecoverable operation failure;
- `warn` — recoverable abnormal behavior;
- `info` — session/compiler lifecycle;
- `debug` — revision/watch details;
- `trace` — very noisy development diagnostics.

Include identifying context in important entries:

- `session_id`;
- `revision`;
- entry path name/hash where safe;
- compiler pid.

Never log full document contents or editor buffers by default.

---

## 24. Testing architecture

Testing is built into every layer.

### 24.1 Rust unit tests

Cover:

- open request parsing;
- path validation;
- project root validation;
- session transitions;
- stale session rejection;
- preview revision ordering;
- candidate validation;
- cache root safety;
- conflict detection;
- source write revision checks;
- process lifecycle helpers.

### 24.2 Frontend unit/component tests

Cover:

- UI state reducers;
- toolbar state;
- editor collapse/expand;
- autosave debounce;
- save status;
- conflict state;
- stale preview revision guard;
- view-state calculations;
- theme behavior where practical.

### 24.3 Real Typst integration tests

Do not mock Typst compatibility claims.

Fixtures must cover:

```text
basic
imports
images
bibliography
unicode
multipage
errors
fonts
large
```

Tests should validate actual generated PDF output and live-watch behavior.

### 24.4 Windows E2E tests

Major flows:

- launch;
- open `.typ`;
- preview becomes ready;
- external save refreshes preview;
- error keeps last preview;
- recovery creates new preview;
- built-in editor saves;
- document switching rejects stale results;
- second-instance open works;
- no orphan Typst process on exit.

### 24.5 Clean-machine acceptance

Use a clean Windows VM for release candidates.

The clean-machine test is required because a development environment may hide missing runtime dependencies or incorrect installer behavior.

---

## 25. Performance targets

These are engineering targets, not guarantees.

For a small/medium local document on normal hardware:

- shell should become interactive quickly;
- Tykuru's own overhead between completed Typst PDF and preview publication should remain small;
- preview refresh should not restart the application;
- viewport should remain stable during normal edits;
- idle CPU should be near zero aside from the compiler/file-watcher behavior;
- no full-document rasterization in Rust.

Measure before optimizing.

Always separate:

```text
Typst compile time
Tykuru publication overhead
PDF.js loading/rendering time
```

---

## 26. Dependency/version policy

Pin important dependencies through lockfiles and explicit configuration.

Typst version upgrades are deliberate release work:

1. change pinned version;
2. obtain official binary;
3. verify checksum/source;
4. run full fixture suite;
5. run Windows E2E;
6. update release notes;
7. commit as an isolated dependency/toolchain change.

Do not have runtime code fetch a newer compiler because one exists.

---

## 27. Git and commit architecture

Git history is part of project maintainability.

### 27.1 Commit format

Use Conventional Commits:

```text
type(scope): imperative message
```

Allowed common types:

```text
feat
fix
test
refactor
docs
chore
build
ci
perf
```

Examples:

```text
feat(preview): render committed pdf revisions
feat(editor): add collapsible codemirror pane
feat(windows): open typ files from explorer
fix(session): reject stale compiler events
fix(editor): prevent overwrite after external change
test(compiler): cover imported file watch updates
refactor(preview): isolate revision publication
docs(architecture): define shadcn frontend boundary
build(typst): pin windows sidecar version
ci(windows): add installer smoke build
```

### 27.2 Commit size

Commits should be atomic.

One commit should represent one coherent behavioral or infrastructure change.

Do not combine:

```text
new PDF viewer
+ unrelated editor refactor
+ dependency upgrades
+ formatting entire repository
```

### 27.3 Commit only after verification

Before a normal source commit, run the relevant checks.

Preferred full local gate:

```text
pnpm verify
```

Compiler/preview changes additionally require:

```text
pnpm typst:fixtures
```

Desktop integration changes require E2E when available:

```text
pnpm test:e2e
```

Windows-specific changes must be tested on Windows before release even if committed earlier from another development OS.

### 27.4 Stage-gate commits

The work plan is designed so a stable commit exists at the end of every gate.

Recommended pattern:

```text
feat(shell): establish minimal application layout
feat(document): open and validate typ files
feat(compiler): compile typ files with bundled sidecar
feat(preview): display generated pdf with pdfjs
feat(watch): refresh preview from typst watch
...
```

A gate commit should leave the repository buildable and tests passing.

### 27.5 Never commit

Do not commit:

- `node_modules/`;
- `dist/`;
- `src-tauri/target/`;
- local Tykuru cache;
- generated candidate/revision PDFs;
- temporary test copies;
- secrets/signing credentials;
- developer-specific settings;
- Windows installer output unless intentionally attached to a release process;
- arbitrary downloaded binaries without the project's controlled sidecar process.

### 27.6 Dependency commits

Dependency upgrades should normally be isolated, for example:

```text
chore(deps): update shadcn dependencies
chore(deps): update pdfjs
build(typst): update bundled typst to 0.x.y
```

Do not hide unrelated behavior changes inside dependency-upgrade commits.

---

## 28. CI architecture

### Pull request / main verification

```text
checkout
  ↓
pnpm install --frozen-lockfile
  ↓
frontend typecheck + lint + tests
  ↓
Rust fmt + clippy + tests
  ↓
Typst fixture integration tests
  ↓
frontend build
```

### Windows release pipeline

```text
tag/manual release
       ↓
verify exact dependencies
       ↓
verify official Typst sidecar/checksum
       ↓
all unit tests
       ↓
Typst integration fixtures
       ↓
Tauri Windows build
       ↓
Windows E2E
       ↓
NSIS installer
       ↓
installer smoke/clean-machine checks where automated
       ↓
SHA-256 + release artifacts
```

Do not publish a release artifact from a workflow path that bypasses required tests.

---

## 29. Architecture change procedure

Frozen v1 decisions should not be replaced casually.

If implementation appears to require a significant change:

1. state the concrete blocked requirement;
2. reproduce the problem;
3. identify whether the limitation belongs to Tykuru, Tauri, Typst, PDF.js, or Windows;
4. evaluate the smallest compatible fix;
5. add/modify tests that demonstrate the requirement;
6. obtain approval for a frozen-stack change;
7. update this document before or with the implementation.

Examples of architecture-level changes:

- replacing React;
- replacing Tauri;
- replacing PDF.js;
- linking Typst as a Rust library instead of CLI sidecar;
- introducing multiple simultaneous documents;
- adding LSP/Tinymist;
- adding a database.

---

## 30. Final v1 architecture summary

```text
Windows Explorer / File Dialog / Drag-Drop
                    │
                    ▼
              OpenRequestRouter
                    │
                    ▼
              DocumentSession
                    │
         ┌───────────┴────────────┐
         │                        │
         ▼                        ▼
  SourceService             CompilerService
  SourceWriter save         official Typst CLI
  + SourceWatcher                │
  (entry file only)              │
         │              typst watch output
         │                        │
         │                        ▼
         │             candidate.pdf (notify hint)
         │                        │
         │         stable read + sanity + NEW revision
         │                        │
         │             preview-updated(id, n)
         │                        │
         │             get_preview_pdf(id, n)
         │                        │
         │             binary Tauri IPC
         │                        │
         │                        ▼
         │                    PDF.js
         │                        │
         └────── main.typ ────────┘
                    │
        source-changed(id, revision)
                    │
                    ▼
         editor sync / conflict (§16)
                    │
                    ▼
            React + shadcn UI
```

The central rule is:

> If an implementation makes Tykuru substantially more complex than **Tauri → Rust → official `typst watch` → immutable PDF revision → PDF.js**, assume it needs strong justification.

The two consumer pipelines (preview, editor sync) both read the same
authoritative `main.typ` but never depend on each other's state (§16.1).

