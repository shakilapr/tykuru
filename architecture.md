# Tykuru Architecture

**Repository:** `tykuru`  
**Product:** Tykuru  
**Document status:** implementation baseline  
**Target:** Windows-first desktop application  
**Primary file type:** `.typ`  
**Architecture date:** 2026-08-20

---

## 1. Product definition

Tykuru is a small, local-first desktop application for opening, previewing, and optionally editing Typst documents.

The primary experience is deliberately narrow:

1. Open a `.typ` file.
2. Render it with the real Typst compiler.
3. Display the resulting document immediately.
4. Keep watching the document and its Typst dependencies.
5. Refresh the preview whenever the source changes.
6. Keep the preview usable when the source temporarily contains an error.
7. Optionally reveal a lightweight editing pane for quick edits.
8. Run as a normal Windows application and support opening `.typ` files from Explorer / **Open with** / double-click after association is selected.

Tykuru is **not** intended to become a replacement compiler or a large IDE. Typst remains the language/compiler authority; Tykuru is the desktop session, preview, and lightweight editing layer around it.

---

## 2. Architecture principles

### 2.1 One authoritative compiler

Tykuru must not implement a Typst parser, evaluator, layout engine, package resolver, font engine, bibliography engine, or renderer.

The bundled official Typst CLI is the compilation authority.

This gives Tykuru the same language behavior as the selected Typst release for:

- Typst markup and scripting
- equations and math
- imports and includes
- local images and SVG
- bibliography/citations
- fonts
- packages
- templates
- multi-file documents
- layout and pagination
- PDF generation

### 2.2 One authoritative source file

The document on disk is the canonical source.

Both workflows use the same file:

```text
External editor ─┐
                 ├──> project/main.typ ──> Typst
Tykuru editor ───┘
```

Tykuru must not create a hidden second document model whose contents can diverge from the actual `.typ` file.

### 2.3 Preview-first UX

The preview is the main product surface. The editor is optional and collapsible.

Default layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ Tykuru · main.typ                         100%   −  +   ⋯   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                        PDF preview                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Split mode:

```text
┌────────────────────────┬─────────────────────────────────────┐
│                        │                                     │
│ lightweight editor     │             preview                 │
│                        │                                     │
│                   ◀    │                                     │
└────────────────────────┴─────────────────────────────────────┘
```

### 2.4 Last good preview always wins

A syntax error while typing must not blank the application.

If compilation fails:

- keep the most recent successful preview visible;
- change status to `Error`;
- expose the current compiler diagnostic;
- replace the preview only after a later successful compilation.

### 2.5 Small dependency surface

Avoid adding infrastructure unless it solves a real product requirement.

No database, local HTTP server, Electron runtime, React application, custom compiler, package manager, or background service is required for v1.

### 2.6 Windows is the release gate

The internal design should remain portable, but v1 is complete only when a normal Windows user can:

- install Tykuru;
- launch it from Start / desktop normally;
- choose a `.typ` file in the app;
- drag a `.typ` file onto the app;
- choose Tykuru from **Open with**;
- double-click an associated `.typ` file;
- edit the document and see live preview updates.

---

## 3. Recommended technology stack

| Area | Decision | Reason |
|---|---|---|
| Desktop runtime | Tauri 2 | Small native shell, Rust backend, system WebView |
| Backend | Rust | Process lifecycle, filesystem, cache, file-open handling |
| Frontend | TypeScript + HTML + CSS | UI is small; framework not required |
| Build frontend | Vite | Fast simple TypeScript build/dev server |
| Typst engine | Official Typst CLI as bundled Tauri sidecar | Exact compiler behavior without reimplementing Typst |
| Preview format | PDF | Typst default output; vector text/document semantics |
| PDF renderer | `pdfjs-dist` / PDF.js viewer components | Mature page rendering, selection, search, links |
| Optional editor | CodeMirror 6 | Lightweight, modular, future extensibility |
| File notifications needed by Tykuru | Rust `notify` crate | Detect preview-output and entry-file changes |
| Native open dialog | Tauri dialog plugin | Native Windows file selection |
| Single-instance behavior | Tauri single-instance plugin | Route later Explorer launches to existing Tykuru window |
| Persistent small settings | Tauri store plugin or one small JSON config | Recent files, layout, project-root overrides |
| Windows installer | NSIS first; MSI optional | Normal installable `.exe`; Tauri supports both |

### Version policy

Do not depend on `latest` at build time.

Pin:

- an exact Tauri 2 release in Cargo/npm lockfiles;
- an exact PDF.js version;
- an exact CodeMirror dependency set;
- an exact official Typst binary version.

At the time this architecture was written, Typst documentation/repository reports version **0.15.1**. The repository should still express the compiler version in one machine-readable location so upgrades are deliberate.

Example:

```text
config/versions.toml

typst = "0.15.1"
```

---

## 4. High-level system

```text
                         WINDOWS / FILESYSTEM

  Explorer / Open With       External editor        Tykuru editor
          │                       │                     │
          │ .typ path             │ save                │ autosave
          ▼                       ▼                     ▼
┌───────────────────────────────────────────────────────────────────┐
│                         TYKURU (TAURI)                            │
│                                                                   │
│  ┌────────────────────── RUST BACKEND ─────────────────────────┐  │
│  │                                                             │  │
│  │ OpenRequestRouter ──> SessionManager                         │  │
│  │                          │                                  │  │
│  │                          ├─ SourceService                    │  │
│  │                          ├─ CompilerService ─────────────┐    │  │
│  │                          ├─ PreviewRevisionStore         │    │  │
│  │                          ├─ DiagnosticState              │    │  │
│  │                          └─ Settings                     │    │  │
│  │                                                       │    │  │
│  └───────────────────────────────────────────────────────│────┘  │
│                                                          │       │
│                               official Typst sidecar      │       │
│                           `typst watch entry output.pdf`  │       │
│                                      │                   │       │
│                                      ▼                   │       │
│                                candidate PDF ─────────────┘       │
│                                      │                           │
│                                      ▼                           │
│                         committed preview revision               │
│                                      │                           │
│  ┌────────────────────── WEBVIEW FRONTEND ────────────────────┐  │
│  │                                                            │  │
│  │ App shell + toolbar                                        │  │
│  │     ├─ optional CodeMirror editor                          │  │
│  │     └─ PDF.js PreviewController                            │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## 5. Repository layout

Recommended initial structure:

```text
tykuru/
├─ README.md
├─ architecture.md
├─ work-plan.md
├─ LICENSE
├─ package.json
├─ pnpm-lock.yaml
├─ tsconfig.json
├─ vite.config.ts
│
├─ src/
│  ├─ index.html
│  ├─ main.ts
│  ├─ app.ts
│  ├─ styles/
│  │  ├─ app.css
│  │  ├─ editor.css
│  │  └─ preview.css
│  ├─ ui/
│  │  ├─ toolbar.ts
│  │  ├─ status.ts
│  │  ├─ start-screen.ts
│  │  └─ split-pane.ts
│  ├─ preview/
│  │  ├─ preview-controller.ts
│  │  ├─ pdf-viewer.ts
│  │  ├─ view-state.ts
│  │  └─ find-controller.ts
│  ├─ editor/
│  │  ├─ editor-controller.ts
│  │  ├─ autosave.ts
│  │  └─ source-sync.ts
│  └─ bridge/
│     ├─ commands.ts
│     ├─ events.ts
│     └─ types.ts
│
├─ src-tauri/
│  ├─ Cargo.toml
│  ├─ Cargo.lock
│  ├─ build.rs
│  ├─ tauri.conf.json
│  ├─ capabilities/
│  │  └─ default.json
│  ├─ icons/
│  ├─ binaries/
│  │  └─ typst-<target-triple>[.exe]
│  └─ src/
│     ├─ main.rs
│     ├─ app_state.rs
│     ├─ open_request.rs
│     ├─ session/
│     │  ├─ mod.rs
│     │  ├─ manager.rs
│     │  ├─ model.rs
│     │  └─ root.rs
│     ├─ compiler/
│     │  ├─ mod.rs
│     │  ├─ sidecar.rs
│     │  ├─ output_watch.rs
│     │  └─ diagnostic.rs
│     ├─ source/
│     │  ├─ mod.rs
│     │  ├─ read.rs
│     │  ├─ write.rs
│     │  └─ external_watch.rs
│     ├─ preview/
│     │  ├─ mod.rs
│     │  ├─ revisions.rs
│     │  └─ protocol.rs
│     ├─ commands/
│     │  ├─ mod.rs
│     │  ├─ document.rs
│     │  ├─ editor.rs
│     │  └─ settings.rs
│     └─ shutdown.rs
│
├─ fixtures/
│  ├─ basic/
│  ├─ imports/
│  ├─ bibliography/
│  ├─ images/
│  ├─ errors/
│  ├─ unicode/
│  ├─ multipage/
│  └─ large/
│
├─ tests/
│  ├─ frontend/
│  ├─ integration/
│  └─ e2e/
│
└─ .github/
   └─ workflows/
      ├─ verify.yml
      └─ windows-release.yml
```

Avoid creating every file on day one. The structure defines boundaries; implementation can grow into it stage by stage.

---

## 6. Core runtime model

### 6.1 One active document in v1

Keep v1 intentionally simple: one window and one active Typst entry document.

```rust
struct DocumentSession {
    id: SessionId,
    entry_path: PathBuf,
    project_root: PathBuf,
    cache_dir: PathBuf,
    compiler: Option<CompilerProcess>,
    preview_revision: u64,
    compile_state: CompileState,
    diagnostics: Vec<Diagnostic>,
    editor_state: EditorFileState,
}
```

Opening another `.typ` replaces the current session after its child compiler/watchers are shut down.

Multi-tab/multi-window support is a later feature and must not complicate v1.

### 6.2 Session state machine

```text
NoDocument
    │ open .typ
    ▼
Opening
    │
    ├─ invalid/unreadable ──> OpenFailed ──> NoDocument
    │
    ▼
StartingCompiler
    │
    ├─ startup failure ─────> CompilerUnavailable
    │
    ▼
Compiling
    │
    ├─ valid PDF ───────────> Ready
    │                           │
    │                           │ source/dependency change
    │                           ▼
    │                        Compiling
    │
    └─ compile error ───────> ErrorWithLastGoodPreview
                                │
                                └─ next success ──> Ready
```

The `ErrorWithLastGoodPreview` state is an explicit product state, not an exceptional crash path.

---

## 7. Opening `.typ` files

Tykuru must normalize all ways of requesting a file into one internal message:

```rust
enum OpenRequest {
    Path(PathBuf),
}
```

Sources of an `OpenRequest`:

1. **File > Open** / startup button using native dialog.
2. Drag-and-drop onto the main window.
3. Command-line invocation:
   ```text
   tykuru.exe C:\work\paper\main.typ
   ```
4. Windows file association / Explorer **Open with**.
5. Second invocation while Tykuru is already running, forwarded by the single-instance callback.

### 7.1 Validation

Before creating a session:

- canonicalize the path when possible;
- require a regular readable file;
- normally require case-insensitive extension `.typ`;
- preserve Unicode paths;
- do not concatenate the path into a shell command;
- pass arguments directly to the sidecar process API.

### 7.2 Windows file association

The Windows bundle declares a Tauri file association similar to:

```json
{
  "bundle": {
    "fileAssociations": [
      {
        "ext": ["typ"],
        "name": "Typst Document",
        "description": "Typst document"
      }
    ]
  }
}
```

Tykuru should initially register as an available handler. Do not forcibly take over another default association without user choice.

### 7.3 Single instance

Use Tauri's single-instance plugin and register it before other plugins as required by the plugin documentation.

Behavior:

- first process owns the main window;
- a second Explorer/Open-With launch forwards its `argv` and working directory;
- the first process parses the `.typ` path;
- focus/restore the main window;
- open that document in the current instance.

The first launch must also parse `std::env::args()` because the initial process receives file-association paths directly through command-line arguments on Windows.

---

## 8. Project root rules

Typst's project root controls which paths may be accessed relative to a document and how imports resolve.

### v1 rule

Default:

```text
project_root = parent(entry_path)
```

This handles the common project:

```text
paper/
├─ main.typ
├─ template.typ
├─ refs.bib
└─ figures/
```

### Root override

Provide a small advanced command:

```text
Document > Set Project Root…
```

Persist override keyed by canonical entry path.

Compiler invocation can then include:

```text
--root <selected-root>
```

Validation:

- root must exist and be a directory;
- entry file must be inside the root for the normal case;
- store canonicalized path;
- if the root later disappears, fall back only after informing the user.

Do not infer a generic root solely from `typst.toml`; Typst does not use it as a universal project marker for arbitrary documents.

---

## 9. Typst compiler subsystem

### 9.1 Bundled sidecar

Bundle an official Typst executable with Tauri's `externalBin` mechanism.

Windows target example:

```text
src-tauri/binaries/typst-x86_64-pc-windows-msvc.exe
```

The end user therefore does not need to install Typst separately.

### 9.2 Compiler launch

Conceptual command:

```text
typst watch <entry.typ> <session-cache>/candidate.pdf \
  --root <project-root>
```

Additional options are added only when the corresponding setting exists, for example custom font paths.

Important rules:

- spawn without invoking `cmd.exe`/PowerShell;
- retain the child handle;
- capture stdout and stderr;
- kill the child when the session changes or app exits;
- never start two watchers for the same active session;
- ignore late events tagged with an old `SessionId`.

### 9.3 Why `typst watch`

Typst already performs incremental compilation and its CLI explicitly supports watching and automatically recompiling source/dependency changes. Tykuru should use this rather than recreating the compiler dependency graph itself.

### 9.4 Compiler process model

```rust
struct CompilerProcess {
    session_id: SessionId,
    child: CommandChild,
    candidate_pdf: PathBuf,
    started_at: Instant,
}
```

### 9.5 Diagnostics

Do not make v1 depend on a brittle parser for the exact human-readable compiler text.

Capture stderr into a bounded rolling buffer and surface:

```rust
struct Diagnostic {
    severity: DiagnosticSeverity,
    text: String,
}
```

A later version may parse stable machine-readable diagnostics if/when the chosen Typst CLI exposes a format Tykuru can confidently rely on.

The UI initially needs only:

- `Compiling…`
- `Ready`
- `Error`
- expandable raw compiler message

### 9.6 Compiler upgrade policy

Upgrading the bundled Typst compiler is a deliberate release event:

1. change pinned version;
2. download official binaries for supported targets;
3. verify checksums/signatures according to release process;
4. run the full Typst fixture suite;
5. note compiler change in Tykuru release notes.

Do not silently download a different compiler at runtime in v1.

---

## 10. Preview revision pipeline

Never point PDF.js at a file that Typst may be rewriting at that exact moment.

Use two levels:

```text
Typst writer
    │
    ▼
candidate.pdf
    │ verify/read complete snapshot
    ▼
revision-000042.pdf  <── immutable while PDF.js reads it
```

### 10.1 Candidate output watcher

Tykuru watches only its own session cache output for preview publication purposes. This is **not** a replacement for Typst's source dependency watcher.

On an event for `candidate.pdf`:

1. verify event belongs to the current session;
2. wait/retry briefly until a stable read succeeds;
3. require non-zero content and a PDF signature;
4. optionally make a lightweight end-of-file sanity check;
5. copy/read into a new immutable revision;
6. atomically update `current_revision` in backend state;
7. emit `preview-updated` with revision number;
8. retain only a small number of previous revisions.

This prevents PDF.js from racing a half-written output.

### 10.2 Revision retention

Keep at most:

- current revision;
- previous revision;
- optionally one older revision while an asynchronous viewer load is still completing.

Delete stale revisions after the frontend confirms it has switched or after a short safe grace period.

### 10.3 Serving previews to the WebView

Recommended approach: a Tauri custom URI protocol backed by the Rust preview store.

Conceptual URL:

```text
tykuru-preview://localhost/session/<id>/revision/<n>.pdf
```

The protocol handler must **not** map arbitrary user-provided paths to the filesystem. It receives a session/revision identifier, looks that identifier up in backend state, and serves only a known committed preview file.

Response headers:

```text
Content-Type: application/pdf
Cache-Control: no-store
```

Revision-specific URLs also naturally avoid stale WebView/PDF.js caching.

Security requirement: reject unknown session/revision IDs and path traversal syntax before touching disk.

### 10.4 Preview update event

Rust → frontend event:

```ts
type PreviewUpdated = {
  sessionId: string;
  revision: number;
  url: string;
};
```

Frontend discards the event if `sessionId !== activeSessionId`.

---

## 11. PDF.js frontend

Use `pdfjs-dist` viewer components rather than embedding the entire stock Firefox-style viewer.

Required v1 capabilities:

- continuous page layout;
- page-width default zoom;
- manual zoom +/-;
- mouse-wheel/trackpad scrolling;
- text selection and copy;
- clickable PDF links;
- find (`Ctrl+F`);
- page number status;
- preserve visual position across preview revisions.

Optional later capabilities:

- outline/sidebar;
- thumbnails;
- presentation mode;
- print button;
- export/open generated PDF.

### 11.1 Viewer state

```ts
type ViewState = {
  scaleMode: 'page-width' | 'custom';
  scale: number;
  pageNumber: number;
  pageFraction: number;
};
```

Before switching PDF revision:

1. sample current visible page and relative vertical position;
2. load new revision;
3. wait for pages initialization;
4. restore zoom;
5. restore page and approximate fraction.

If the document layout changed drastically, clamping to the nearest valid page is acceptable.

### 11.2 No flash-to-empty

The old `PDFDocumentProxy` remains active until the new document has loaded sufficiently to replace it.

Flow:

```text
old preview visible
       │
       ├── load new PDF in background
       │
       ├── success -> swap -> destroy old document
       │
       └── failure -> keep old -> report preview-load error
```

---

## 12. Optional built-in editor

### 12.1 Role

The editor is a convenience pane, not the core architecture.

Use CodeMirror 6 because it is modular and can remain small.

Required v1 editor features:

- load the active `.typ` file;
- plain UTF-8 editing;
- undo/redo;
- line numbers;
- bracket/quote conveniences where practical;
- find/replace if inexpensive;
- `Ctrl+S` immediate save;
- autosave after a short idle debounce;
- visible save state;
- collapsible/resizable split pane.

Not required for v1:

- LSP;
- completion;
- hover docs;
- goto definition;
- refactoring;
- project file tree;
- embedded terminal;
- custom Typst parser.

### 12.2 Do not add a second Typst engine

Avoid a CodeMirror package that brings its own WASM Typst compiler merely to support the editor. Tykuru already owns an official native Typst sidecar. Duplicating compiler implementations increases binary size, version skew, testing burden, and package/font behavior differences.

Syntax highlighting can initially be basic or added later through a grammar that does not become a second compiler.

### 12.3 Autosave

Recommended default:

```text
editor change
   │
   ├─ mark LocalPending
   │
   └─ 200–300 ms idle debounce
              │
              ▼
        Rust save_source
              │
              ▼
          disk .typ
              │
              ▼
          typst watch
```

Keep debounce configurable internally, but do not expose tuning settings in v1 unless users need them.

### 12.4 Safe write behavior

The Rust source service owns writes.

Before writing:

- ensure the session is still active;
- ensure path equals the current entry file;
- check the external revision metadata/hash supplied by the editor;
- write UTF-8 via a tested safe-write abstraction;
- on failure, retain the editor buffer and show `Unsaved`.

Do not let JavaScript request arbitrary filesystem writes.

---

## 13. External-editor synchronization

Typst itself watches dependency files for compilation. Tykuru additionally needs to notice changes to the **entry file** so the optional editor does not display stale text.

Maintain:

```rust
struct EditorFileState {
    disk_revision: u64,
    disk_hash: ContentHash,
    last_self_write_hash: Option<ContentHash>,
}
```

### External change while editor has no pending local change

```text
external editor saves main.typ
        │
        ▼
SourceService detects entry-file change
        │
        ▼
read + hash
        │
        ▼
emit source-reloaded
        │
        ▼
CodeMirror replaces content while preserving cursor when possible
```

### External change during local pending edit

Do not overwrite user text.

State becomes `Conflict`:

```text
File changed outside Tykuru.
[Reload external] [Keep my version]
```

While conflict is unresolved, pause automatic writes.

This case should be rare because autosave debounce is short, but handling it prevents silent data loss.

---

## 14. Frontend/backend contract

Keep Tauri IPC small and typed.

### Commands

```text
open_document_dialog() -> OpenResult
open_document(path) -> SessionSnapshot
close_document() -> void
get_active_session() -> SessionSnapshot?
read_source() -> SourceSnapshot
save_source(text, expectedDiskRevision) -> SaveResult
set_project_root(path?) -> SessionSnapshot
set_editor_visible(bool) -> void
```

Most file-open handling from Windows should enter through Rust directly rather than routing untrusted `argv` through the frontend.

### Events

```text
session-opened
session-closed
compile-state-changed
preview-updated
source-reloaded
source-conflict
fatal-session-error
```

Every session-specific event contains `sessionId`.

### Frontend must not

- spawn Typst;
- resolve project paths;
- read arbitrary filesystem locations;
- write arbitrary filesystem locations;
- manage Windows file associations;
- decide whether compiler output is committed.

---

## 15. Settings and persistent state

Persist only small user preferences:

```json
{
  "window": {
    "editorVisible": false,
    "splitRatio": 0.36
  },
  "preview": {
    "defaultScale": "page-width"
  },
  "recentFiles": [],
  "rootOverrides": {},
  "fontPaths": []
}
```

Do not store document contents in the settings store.

Recent-file entries that no longer exist should be removable without error.

For v1, cap recent files, e.g. 10.

---

## 16. Cache layout

Use Tauri/OS application cache/data directories rather than writing generated PDFs next to source documents.

Conceptual Windows layout:

```text
%LOCALAPPDATA%/Tykuru/
├─ cache/
│  └─ sessions/
│     └─ <session-id>/
│        ├─ candidate.pdf
│        ├─ revision-000001.pdf
│        └─ revision-000002.pdf
└─ config/
   └─ settings.json
```

At application start:

- remove abandoned old session cache directories according to age policy;
- never delete outside Tykuru's own cache root.

At clean session close:

- terminate Typst;
- release viewer references;
- delete session cache.

---

## 17. Fonts and packages

### Fonts

Default to Typst's own normal system font discovery.

Advanced setting may add custom font paths passed to Typst using the CLI's supported font-path mechanism.

Tykuru should not inventory or render fonts itself.

### Packages

Let the official compiler implement package lookup/download/cache behavior.

Consequences:

- a project that imports an uncached online package may require network access on first use;
- already cached packages can be reused according to Typst behavior;
- Tykuru itself does not implement a package registry client in v1.

Status/error text should make compiler network/package errors visible rather than converting them into generic “preview failed.”

---

## 18. Security model

Tykuru opens user-authored Typst projects, so boundaries should be explicit.

### Required controls

1. **No shell string construction** — sidecar receives an argument array.
2. **Narrow Tauri capabilities** — expose only commands/plugins required by the main window.
3. **No general filesystem IPC** from the frontend.
4. **Preview custom protocol uses IDs**, never arbitrary file paths.
5. **CSP** should allow bundled app resources, PDF worker resources, and the Tykuru preview scheme only as needed.
6. **External URL navigation** is not silently allowed inside the app; PDF links that navigate outside should use a deliberate opener policy.
7. **Cache cleanup is root-scoped** and cannot traverse upward.
8. **Sidecar version is pinned** and obtained through the project's release process.
9. **Untrusted `.typ` paths are canonicalized/validated** before session setup.
10. **Compiler process is killed on session/app exit** to avoid orphan watchers.

Tykuru should not claim to sandbox Typst beyond what the bundled compiler and configured project root actually enforce.

---

## 19. Performance targets

These are engineering targets, not guarantees for arbitrarily complex Typst documents.

### v1 targets on a normal Windows development machine

| Metric | Target |
|---|---:|
| Application idle CPU with stable document | approximately 0% / negligible |
| UI reaction to open request | < 100 ms before loading state visible |
| Preview swap overhead after completed compilation | < 150 ms for ordinary documents |
| Editor autosave debounce | 200–300 ms |
| Viewer keeps scroll/zoom across revisions | 100% for ordinary same-layout edits |
| Orphan Typst process after closing document | 0 |
| Generated PDF files written into user project | 0 |

Measure compiler time separately from Tykuru overhead.

### Large-document behavior

PDF.js should render pages lazily through its viewer mechanisms. Do not rasterize an entire large document in Rust or preload every page into custom image elements.

---

## 20. Failure handling

| Failure | Required behavior |
|---|---|
| Source file missing | close/disable session with clear message; do not crash |
| Source permission denied | show open/read error |
| Typst sidecar missing/corrupt | show fatal compiler setup error |
| Typst syntax error | keep last good preview + compiler error |
| Imported file missing | same as compile error |
| Package download unavailable | show compiler diagnostic |
| Candidate PDF partially readable | retry; do not publish bad revision |
| PDF.js rejects new revision | retain old preview and report viewer error |
| User opens second `.typ` | cleanly stop old session, open new session |
| External edit conflict | pause autosave and ask which version to keep |
| App closes | terminate compiler + watchers; clean session cache |
| WebView reloads/crashes | backend session survives where practical and frontend can query active snapshot |

---

## 21. Logging

Use structured Rust logs with levels:

- `error`: unrecoverable session/app errors;
- `warn`: recoverable compiler/viewer/cache issues;
- `info`: open/close/session/compiler lifecycle;
- `debug`: revision/file-watch details;
- `trace`: noisy events disabled in release.

Never log full document contents.

Paths may be logged locally for debugging, but crash/telemetry upload is out of scope for v1 and must not be silently added.

---

## 22. Test architecture

Testing is part of the architecture, not a final-stage activity.

### 22.1 Rust unit tests

Test pure components without Tauri UI:

- `.typ` path validation;
- command-line/file-association argument parsing;
- project-root resolution;
- session state transitions;
- stale `SessionId` event rejection;
- revision retention;
- custom preview protocol routing/path traversal rejection;
- source revision/hash conflict logic;
- cache cleanup root safety.

### 22.2 Frontend unit tests

Use Vitest or equivalent for:

- view-state capture/restore math;
- session event filtering;
- toolbar status mapping;
- editor debounce logic with fake timers;
- conflict state reducer;
- preview URL/revision changes.

### 22.3 Real Typst integration tests

Run the pinned Typst sidecar against repository fixtures.

Required fixtures:

```text
basic/          text + headings + math
imports/        main.typ imports/includes another .typ
images/         local SVG/PNG
bibliography/   .bib + citations
unicode/        non-ASCII source/path/content
errors/         intentionally invalid source
multipage/      enough pages for scroll restoration
large/          performance/stability fixture
```

Tests:

- initial compilation produces valid PDF;
- edit entry file → new PDF;
- edit imported `.typ` → new PDF;
- edit `.bib`/image dependency → expected watch rebuild where supported by Typst;
- introduce syntax error → no new committed revision;
- fix syntax error → new committed revision;
- stop session → child process exits.

### 22.4 Frontend/browser component tests

Run PDF.js frontend against test PDFs in a normal browser build:

- load document;
- zoom;
- scroll;
- search;
- revision swap;
- old preview stays visible until new one is ready.

### 22.5 Tauri end-to-end tests

Use the current recommended Tauri/WebdriverIO path for desktop E2E testing.

On Windows test:

- app launches;
- Open button opens fixture via test hook or controlled command;
- preview becomes ready;
- editor opens/closes;
- editor write updates preview;
- error state keeps old preview;
- second open request focuses/reuses app where automation permits.

### 22.6 Windows installer acceptance tests

Release candidate must be tested from a clean Windows environment/VM:

1. install NSIS package;
2. launch Tykuru from Start;
3. open `.typ` using native dialog;
4. choose **Open with > Tykuru** for `.typ`;
5. set association if desired and double-click `.typ`;
6. verify path with spaces and Unicode characters;
7. keep Tykuru running and double-click a second `.typ`;
8. verify existing instance opens/focuses the second file;
9. uninstall;
10. verify application files are removed and Windows association behavior is sane.

---

## 23. CI and release pipeline

### Pull request / push verification

```text
checkout
   │
   ├─ install pinned Node/pnpm
   ├─ install stable Rust toolchain
   ├─ restore caches
   │
   ├─ pnpm install --frozen-lockfile
   ├─ TypeScript typecheck
   ├─ frontend lint
   ├─ frontend unit tests
   ├─ frontend production build
   │
   ├─ cargo fmt --check
   ├─ cargo clippy -- -D warnings
   ├─ cargo test
   │
   └─ Typst fixture integration tests
```

### Windows release candidate

```text
Windows runner
   │
   ├─ fetch/verify pinned official Typst Windows binary
   ├─ frontend + Rust verification
   ├─ build release Tauri binary
   ├─ run Windows E2E suite
   ├─ tauri build
   │    ├─ NSIS setup.exe   (primary)
   │    └─ MSI              (optional)
   ├─ smoke install/test if CI permits
   ├─ calculate SHA-256
   └─ publish only after release gate passes
```

Code signing can be introduced when distribution requires it. Do not block the functional v1 architecture on signing infrastructure, but do not call an unsigned development artifact a polished public release.

---

## 24. Product UX state

### No document

```text
Tykuru

Open a Typst document
[ Open .typ ]

Recent
...
```

### Loading

Preview area remains stable and shows subtle loading status.

### Ready

```text
main.typ                    Ready     Page 3     100%  −  +
```

### Compiling

```text
main.typ                    Compiling…
```

Do not block scrolling while Typst compiles.

### Error

```text
main.typ                    Error  ⚠
```

Preview remains the last successful version. Clicking error reveals compiler text in a compact panel.

### Editor save status

Use small states only:

```text
Saved
Saving…
Unsaved
Conflict
```

---

## 25. Explicit v1 non-goals

Do not allow scope creep into:

- cloud sync;
- accounts;
- collaborative editing;
- Git client;
- terminal;
- project tree IDE;
- full Tinymist/LSP integration;
- custom Typst compiler embedding;
- browser version;
- mobile version;
- plugin ecosystem;
- multiple windows/tabs;
- document conversion suite;
- template marketplace;
- custom package manager.

These can be separate proposals after v1 is stable.

---

## 26. Evolution path after v1

Architecture intentionally leaves extension points:

### v1.1

- better Typst syntax highlighting;
- source ↔ preview position synchronization if a reliable mapping can be implemented;
- outline panel;
- optional system Typst executable selection;
- export/open generated PDF;
- update checker.

### v1.2+

- Tinymist adapter for completion/diagnostics in editor;
- multiple documents;
- macOS/Linux packaging;
- direct Rust Typst-library backend **only if measurements justify replacing the CLI sidecar**.

The sidecar boundary is an advantage: it allows the product to ship before coupling Tykuru to Typst's internal Rust APIs.

---

## 27. Definition of architectural completion

The architecture has been implemented successfully when all of the following are true:

- [ ] Windows Tykuru application launches without requiring a separately installed Typst.
- [ ] User can choose a local `.typ` file from Tykuru.
- [ ] Installed Tykuru can receive `.typ` files from Windows Explorer/Open-With.
- [ ] Opening a `.typ` starts the bundled Typst compiler.
- [ ] A valid document is shown through PDF.js.
- [ ] Editing the entry file in another editor updates the preview automatically.
- [ ] Changing an imported source/dependency is handled through Typst's watch behavior.
- [ ] Compile errors leave the last successful preview visible.
- [ ] Preview updates preserve zoom/scroll well enough for normal editing.
- [ ] The collapsible CodeMirror editor can edit and autosave the same `.typ` file.
- [ ] External and internal edits do not silently overwrite each other.
- [ ] Closing/switching documents leaves no orphan Typst process.
- [ ] Tykuru creates no generated PDF in the user's project by default.
- [ ] Automated unit/integration/E2E suites pass.
- [ ] NSIS Windows installer builds and passes clean-machine acceptance tests.

At that point Tykuru is a complete minimal local Typst desktop viewer/editor rather than a prototype.

---

## 28. Primary technical references

These references were checked while fixing the v1 architecture. Pin dependencies in the repository; do not treat URLs as version locks.

- Typst documentation: https://typst.app/docs/
- Typst 0.15.1 changelog: https://typst.app/docs/changelog/0.15.1/
- Typst repository / CLI usage: https://github.com/typst/typst
- Typst compiler architecture: https://github.com/typst/typst/blob/main/docs/dev/architecture.md
- Typst PDF export: https://typst.app/docs/reference/pdf/
- Tauri configuration (`externalBin`, `fileAssociations`): https://v2.tauri.app/reference/config/
- Tauri sidecars: https://v2.tauri.app/develop/sidecar/
- Tauri single-instance plugin: https://v2.tauri.app/plugin/single-instance/
- Tauri Windows installer: https://v2.tauri.app/distribute/windows-installer/
- Tauri official file-association example: https://github.com/tauri-apps/tauri/tree/dev/examples/file-associations
- Tauri custom URI protocol Rust API: https://docs.rs/tauri/latest/tauri/struct.Builder.html
- Tauri WebDriver testing: https://v2.tauri.app/develop/tests/webdriver/
- PDF.js component viewer example: https://github.com/mozilla/pdf.js/tree/master/examples/components
- PDF.js getting started: https://github.com/mozilla/pdf.js/blob/master/docs/contents/getting_started/index.md
- CodeMirror: https://codemirror.net/

