# Tykuru Work Plan

**Repository:** `tykuru`  
**Document:** `work-plan.md`  
**Architecture dependency:** `architecture.md`  
**Primary target:** Windows  
**Delivery method:** gated vertical milestones with testing and atomic commits

---

## 1. Goal

Build a small Windows desktop application that can:

```text
open .typ
   ↓
compile with bundled Typst
   ↓
show PDF preview
   ↓
live-update when edited
   ↓
optionally edit source in a collapsible pane
```

The implementation must remain runnable throughout development. Each stage ends with a test gate and a clean commit.

---

## 2. Final v1 definition of done

v1 is complete only when all of the following are true on a clean Windows machine:

- [ ] Tykuru installs using the produced NSIS installer.
- [ ] Tykuru starts normally from Start/shortcut/executable.
- [ ] The start screen can open a `.typ` file.
- [ ] Dragging a `.typ` file into Tykuru opens it.
- [ ] `tykuru.exe C:\path\paper.typ` opens the document.
- [ ] Windows **Open with → Tykuru** opens the document.
- [ ] An associated `.typ` can be double-clicked to open Tykuru.
- [ ] A second `.typ` launch is forwarded into the running Tykuru instance.
- [ ] The bundled Typst compiler works without Typst installed globally.
- [ ] The PDF preview displays ordinary Typst features.
- [ ] External edits cause automatic preview refresh.
- [ ] Changes to imported Typst files cause automatic refresh.
- [ ] Compile errors preserve the last good preview.
- [ ] The preview restores useful scroll/page/zoom state after refresh.
- [ ] The built-in editor expands/collapses.
- [ ] The built-in editor saves to the same `.typ` file.
- [ ] External editor conflicts do not silently lose data.
- [ ] Closing Tykuru leaves no orphan Typst process.
- [ ] Unit/integration/E2E/release checks pass.

---

## 3. Development rules for every stage

Every stage follows this loop:

```text
read architecture + stage requirements
        ↓
implement smallest vertical change
        ↓
add/update tests
        ↓
run targeted tests
        ↓
run stage verification
        ↓
manual smoke test if required
        ↓
review git diff
        ↓
commit atomically
        ↓
start next stage
```

Do not begin several future stages at once.

If implementation appears to require departing from a frozen architecture decision (stack, protocol, delivery, process ownership, single-session model, etc.), follow the architecture change procedure in `architecture.md §29` before changing code: state the blocked requirement, reproduce, evaluate the smallest compatible fix, add tests, and obtain approval. Keep the architecture and this plan in sync.

---

## 4. Git workflow

### 4.1 Branching

For a small project, keep the model simple:

```text
main
 └─ feature/fix branch as needed
```

Examples:

```text
feat/live-preview
feat/editor
fix/preview-race
chore/typst-upgrade
```

Do not create long-lived environment branches.

### 4.2 Commit format

Use:

```text
type(scope): imperative message
```

Common types:

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
feat(shell): add shadcn application layout
feat(document): open typ files through native dialog
feat(compiler): bundle typst windows sidecar
feat(preview): render committed pdf revisions
feat(watch): refresh preview after typst recompilation
feat(editor): add collapsible codemirror pane
feat(windows): register typ file association
fix(preview): reject stale asynchronous pdf loads
fix(editor): prevent save over external modification
test(session): cover stale session events
build(typst): pin compiler version
ci(windows): add desktop e2e job
```

### 4.3 When to commit

Commit when:

- one coherent behavior is complete;
- its tests pass;
- the repository still builds;
- the diff is reviewable;
- no known half-migration is left behind.

Every stage has a recommended gate commit, but large stages may contain several smaller atomic commits before the final gate commit.

### 4.4 Before every commit

At minimum:

```text
git status
git diff --check
git diff
```

Then run the relevant verification commands.

Normal frontend/backend work:

```text
pnpm verify
```

Compiler/preview work:

```text
pnpm verify
pnpm typst:fixtures
```

Desktop behavior where the environment supports it:

```text
pnpm test:e2e
```

Windows release/integration work:

```text
pnpm build:windows
```

Never say a test passed unless it actually ran successfully.

### 4.5 What not to commit

Do not commit:

```text
node_modules/
dist/
src-tauri/target/
local app cache
generated preview PDFs
temporary fixture copies
private signing keys
.env secrets
installer output outside intentional release artifacts
IDE/user-machine configuration
```

### 4.6 Commit stage state

A stage gate should end in a stable commit.

Suggested progression:

```text
chore(repo): establish project baseline
feat(shell): add minimal application shell
feat(document): open typ files into sessions
feat(compiler): compile with bundled typst
feat(preview): display pdf preview
feat(watch): enable live preview updates
fix(preview): preserve last good revision on errors
feat(preview): preserve viewport across revisions
feat(editor): add collapsible source editor
fix(editor): handle external edit conflicts
feat(windows): open typ files from explorer
feat(typst): support project root and feature fixtures
feat(ux): complete keyboard and theme polish
test(e2e): cover primary desktop workflows
build(windows): produce nsis installer
chore(release): complete v1 hardening
```

---

# PHASE A — FOUNDATION

## 5. Stage 0 — repository baseline

### Goal

Create a reproducible Tauri + React project with the approved frontend stack and quality gates.

### Architecture refs

Implements: §1, §4 (stack + §4.1 disallowed deps + §4.2 Base UI), §6 (repo layout + §6.1 structure principles + §6.2 coding standards), §19, §21 (security foundation: minimal capabilities), §23 (logging via `tauri-plugin-log`), §27 (git), §28 (CI). Forward references for later stages: §8.3 (async/cancellation), §29 (change procedure, see §3).

### Backend scaffold

- [ ] `src-tauri/Cargo.toml` with `tauri` (v2), `tauri-build`, `serde`, `serde_json`, `thiserror`, `log`, `tauri-plugin-log`, `tauri-plugin-dialog`, `tauri-plugin-single-instance` (added later), `notify` (added later).
- [ ] `src-tauri/tauri.conf.json` with product name `Tykuru`, identifier `com.tykuru.app`, `frontendDist`/`devUrl` pointing at Vite, empty `bundle.fileAssociations` for now.
- [ ] `src-tauri/build.rs` invoking `tauri_build::build()`.
- [ ] `src-tauri/src/main.rs` → `tykuru_lib::run()`.
- [ ] `src-tauri/src/lib.rs` exposing `run()` that builds the Tauri app, registers plugins, and invokes `AppState` setup.
- [ ] `src-tauri/capabilities/default.json` with minimal permissions (`core:default`, dialog, log). No filesystem/process/shell permissions.
- [ ] `src-tauri/binaries/.gitkeep` (sidecar added in Stage 3).
- [ ] `src-tauri/icons/` placeholder set.
- [ ] `tests/frontend/`, `tests/integration/`, `tests/e2e/` directories (with a placeholder test so the gates have something to run).
- [ ] Establish the structure principles from `architecture.md §6.1` and coding standards from `architecture.md §6.2` as the baseline the remaining stages follow.

### Frontend scaffold

- [ ] `package.json` with pinned deps: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `@tailwindcss/vite` (or PostCSS), `shadcn` (Base UI base), `lucide-react`, `pdfjs-dist` (pinned; wired in Stage 5), `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`.
- [ ] `tsconfig.json` strict mode, `noUncheckedIndexedAccess`, path alias `@/*` → `src/*`.
- [ ] `vite.config.ts` with React plugin, Vitest test config (`environment: 'jsdom'`), path alias.
- [ ] `components.json` (shadcn, style neutral, Base UI base, alias `@/components`, `@/lib`).
- [ ] `src/styles/globals.css` with Tailwind layers + theme CSS variables (light/dark) consumed by shadcn tokens (`--background`, `--foreground`, `--border`, `--muted-foreground`, `--destructive`, etc.).
- [ ] `src/lib/utils.ts` with `cn()` helper.
- [ ] `src/main.tsx`, `src/app/App.tsx` (placeholder shell), `src/app/AppLayout.tsx`.
- [ ] `src/components/ui/` populated by shadcn for `button`, `tooltip`, `separator`, `dialog`, `dropdown-menu`, `popover`, `scroll-area`, `switch`, `select`, `input`, `resizable` (as needed in later stages).

### Scripts and config

- [ ] `config/versions.toml` with `[typst]` version + expected checksum fields (empty until Stage 3).
- [ ] `scripts/verify_typst.ps1` (stub: validates sidecar presence/checksum, exits non-zero with clear message when not yet present — must not falsely pass).
- [ ] `scripts/fetch_typst.ps1` (stub for Stage 3).
- [ ] `scripts/verify.ps1` and `scripts/build_windows.ps1` (stubs that delegate to package scripts and fail loudly if the underlying stage is unimplemented).
- [ ] `package.json` scripts: `dev`, `typecheck`, `lint`, `test`, `verify`, `build`, `tauri`, `typst:fixtures` (stub), `test:e2e` (stub), `build:windows` (stub). Stubs must print "not implemented" and exit non-zero rather than report success.
- [ ] `.editorconfig` (LF/CRLF, 4-space Rust, 2-space TS).
- [ ] `.gitignore` covering `node_modules/`, `dist/`, `src-tauri/target/`, Tykuru cache, generated PDFs.
- [ ] `.github/workflows/verify.yml` skeleton (checkout, pnpm install, typecheck, lint, test, build, cargo fmt/clippy/test); Windows E2E job added in Stage 17/18.
- [ ] `README.md` with prerequisites, `pnpm install`, `pnpm tauri dev`, `pnpm verify`, and the contribution/test commands.
- [ ] `LICENSE` (MIT or chosen).

### Expected scripts

Design package scripts so contributors can use:

```text
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm verify
pnpm typst:fixtures
pnpm test:e2e
pnpm build:windows
```

Some scripts may initially delegate to placeholders until their stage exists, but they should not falsely report unimplemented checks as successful.

### Automated gate

- [ ] `pnpm install --frozen-lockfile` succeeds after lockfile creation.
- [ ] `pnpm typecheck` succeeds.
- [ ] `pnpm lint` succeeds.
- [ ] `pnpm test` executes successfully.
- [ ] `pnpm build` succeeds.
- [ ] `cargo fmt --check --manifest-path src-tauri/Cargo.toml` succeeds.
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` succeeds.
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` succeeds.

### Manual gate

- [ ] `pnpm tauri dev` opens one desktop window on Windows development machine.
- [ ] App closes normally.
- [ ] No startup errors in console.

### Commit

```text
chore(repo): establish tauri react project baseline
```

### Exit gate

A clean clone can install dependencies, run verification, and launch the baseline Tauri window.

---

## 6. Stage 1 — design system and application shell

### Goal

Establish the minimal Tykuru visual language before adding document functionality.

### Architecture refs

Implements: §7.3 (Tailwind), §7.4 (themes), §19 (UI composition), §19.1/§19.2/§19.3.

### Implement

- [ ] Configure semantic shadcn/Tailwind theme tokens in `globals.css` (light + `.dark` overrides).
- [ ] Support system/light/dark theme infrastructure: a tiny `ThemeProvider`/context in `src/app/app-state.ts` that sets `class="dark"` on `<html>` based on stored preference and `prefers-color-scheme`.
- [ ] Add only required shadcn primitives: `button`, `tooltip`, `separator`, `dropdown-menu`, `popover`, `scroll-area`, `resizable`, `switch`, `select`, `input`, `dialog` (as used).
- [ ] Create `src/app/AppLayout.tsx`: top `Toolbar` + `WorkspaceSplit` with editor/preview panes (preview-only by default).
- [ ] Create start screen (`components/StartScreen.tsx`): large Open button + drop zone (file open wired in Stage 2).
- [ ] Create `components/toolbar/Toolbar.tsx` with the controls below.
- [ ] Create `components/preview/PreviewPane.tsx` placeholder (real viewer in Stage 5).
- [ ] Create `components/editor/EditorPane.tsx` placeholder (real editor in Stage 9).
- [ ] Create `components/layout/WorkspaceSplit.tsx` using shadcn `ResizablePanelGroup` with controlled `splitRatio`.
- [ ] Add Lucide icons (`lucide-react`) for Open, panel toggle, zoom in/out, more-vertical.

Initial controls (toolbar):

```text
Open .typ      Toggle editor      Filename      Compile status      Zoom -   Zoom indicator   Zoom +   Overflow menu
```

Toolbar items are icon buttons with `Tooltip` + accessible `aria-label`; text labels only where space permits. Zoom controls are disabled until a preview exists.

### Test

Frontend unit/component (Vitest + RTL):

- [ ] `StartScreen` renders Open button with role `button` and accessible name "Open .typ".
- [ ] editor toggle flips `editorVisible` and `WorkspaceSplit` hides the editor pane (assert `aria-hidden`/presence).
- [ ] `splitRatio` is clamped to `[0.2, 0.8]` when set from state.
- [ ] collapsing editor reclaims width: preview pane `flex-basis`/`data-state` reflects expanded preview.
- [ ] theme state sets `document.documentElement.classList` to `dark` for dark/system-on-dark, removed for light.
- [ ] every icon-only toolbar button has `aria-label` and a `Tooltip` wrapping it.
- [ ] `Toolbar` zoom buttons are `disabled` when no session/preview is active.

Manual:

- [ ] resize window small/large;
- [ ] toggle editor repeatedly;
- [ ] switch theme (system/light/dark) and confirm colors update;
- [ ] verify no obvious layout overflow at 1024×640.

### Commit

```text
feat(shell): add minimal shadcn application layout
```

### Exit gate

The empty application visually resembles the intended Tykuru product.

---

# PHASE B — OPEN AND RENDER

## 7. Stage 2 — open `.typ` and create document session

### Goal

Safely open and represent a Typst source file before compilation exists.

### Architecture refs

Implements: §8.1 (core model), §8.2 (one active session), §9 (opening), §9.1 (path validation), §20 (command boundary), §3.5 (backend owns).

### Backend

Implement modules under `src-tauri/src/`:

- [ ] `session/model.rs`: `SessionId(String)` (newtype, validated non-empty), `DocumentSession { id, entry_path: PathBuf, project_root: PathBuf, cache_dir: PathBuf, compile_state, editor_state }`. `SessionId` generation via `uuid`/`ulid` or timestamp+random.
- [ ] `session/mod.rs`, `session/manager.rs`: `SessionManager` holding `Option<DocumentSession>` (single active). `open(path) -> Result<SessionId>`, `close()`, `get_active() -> Option<&DocumentSession>`. Opening B closes A first.
- [ ] `open_request.rs`: `OpenRequestRouter::normalize(Input) -> Result<PathBuf>` where `Input` is a path string from dialog/argv/drag. Rejects non-`.typ` (case-insensitive), non-file, missing, or non-canonical-izable paths with typed errors.
- [ ] `app_state.rs`: `AppState` wrapping `Arc<Mutex<SessionManager>>` (or Tauri-managed state). Provide `tauri::State` accessor.
- [ ] `commands/document.rs` exposing Tauri commands:
  - `open_document_dialog()` → uses `tauri-plugin-dialog` `blocking::FileDialog`; filters `*.typ`; routes result through `OpenRequestRouter`; returns `SessionId` or error.
  - `open_document(path: String) -> Result<SessionId>` (used by drag/drop, argv, single-instance later).
  - `close_document(session_id: SessionId) -> Result<()>` (rejects if not active).
  - `get_active_session() -> Option<SessionSummary>` where `SessionSummary` is a serializable subset (`id`, `filename`, `entry_path` name only — never full arbitrary path leaking).
- [ ] `path validation` helper in `open_request.rs`: require readable regular file, `.typ` extension (case-insensitive on Windows), preserve Unicode, support spaces/parens, canonicalize when practical, never shell-interpolate.

### Frontend

- [ ] `src/bridge/commands.ts`: typed wrappers around `invoke('open_document_dialog')`, etc., matching Rust signatures.
- [ ] `src/bridge/types.ts`: `SessionSummary`, `SessionId` types mirroring backend.
- [ ] `src/bridge/events.ts`: define event name constants (`session-opened`, `session-closed`) used later.
- [ ] `src/app/app-state.ts`: reducer holding `DocumentUiState` (§7.5) with `empty`/`opening`/`open`.
- [ ] `Toolbar` Open button → `invoke('open_document_dialog')` → on success set `open` state with `sessionId`/`filename`.
- [ ] Start screen + `WorkspaceSplit` accept a drag/drop `.typ` (HTML5 drop → `invoke('open_document', { path })`).
- [ ] Canceling the dialog returns `None`; UI stays in `empty`/`opening` without error.
- [ ] Invalid paths surface a controlled error banner (no panic, no stack trace to user).

### Rust tests (`cargo test`)

- [ ] `.typ` path accepted.
- [ ] extension case behavior on Windows (`.TYP`, `.Typ` accepted).
- [ ] normal file required (directory rejected).
- [ ] `.txt` rejected.
- [ ] missing path rejected.
- [ ] path with spaces survives normalization.
- [ ] Unicode path survives normalization.
- [ ] default root = `parent(entry)`.
- [ ] cache path remains under Tykuru cache root (`%LOCALAPPDATA%/Tykuru/cache/...`).
- [ ] opening B replaces logical session A (manager holds single active; A no longer retrievable).

### Manual test files

Test temporary files in:

```text
C:\Tykuru Test\main.typ
C:\Tykuru Test\space name.typ
Unicode path/name
nested path
```

### Commit

```text
feat(document): open typ files into document sessions
```

### Exit gate

Tykuru reliably opens a `.typ` and tracks it as the only active session.

---

## 8. Stage 3 — bundle official Typst and perform one-shot compile

### Goal

Prove the packaged app can compile Typst without requiring a global installation.

### Architecture refs

Implements: §3.1 (Typst authority), §11.1 (bundling), §11.2 (process launch), §26 (version policy), §17 (cache).

### Implement

- [ ] Pin Typst version in `config/versions.toml` (`version`, `target` triple, `checksum_sha256`).
- [ ] `scripts/fetch_typst.ps1`: download official Typst release binary for `x86_64-pc-windows-msvc` into `src-tauri/binaries/typst-x86_64-pc-windows-msvc.exe`, verify SHA-256 against `versions.toml`, fail loudly on mismatch.
- [ ] `scripts/verify_typst.ps1`: assert the sidecar exists and checksum matches; exit non-zero otherwise.
- [ ] Tauri sidecar config in `tauri.conf.json` (`bundle.externalBin` includes the sidecar glob) so Tauri resolves `typst` at runtime.
- [ ] `compiler/mod.rs`, `compiler/sidecar.rs`: `CompilerProcess` that builds the command via `tauri::api::process::Command::new_sidecar("typst")` (no shell). Arguments passed separately: `compile <entry> <candidate.pdf> --root <project_root>`.
- [ ] Retain `tauri::process::CommandChild` handle inside `CompilerProcess`; expose `kill()`/`wait()`.
- [ ] `compiler/mod.rs` `CompilerService` with `compile_once(session) -> Result<CompileOutcome>` where `CompileOutcome { success: bool, exit_status, stderr: String, candidate_path: PathBuf }`.
- [ ] Candidate output path: `<cache_dir>/candidate.pdf`. Never write into the project directory.
- [ ] Capture stderr/stdout via piped child; bound stderr buffer (e.g. last 64 KiB) to avoid unbounded memory.
- [ ] Narrow Tauri permissions: no `shell`/`process` access from frontend; only backend uses sidecar API.

Pipeline:

```text
main.typ
   ↓
CompilerService::compile_once
   ↓
bundled typst compile (sidecar, args separate)
   ↓
candidate.pdf in cache
```

### Fixtures

Create under `fixtures/` (committed, real Typst sources):

- [ ] `fixtures/basic/main.typ` — headings, equations, a table.
- [ ] `fixtures/imports/main.typ` + `fixtures/imports/part.typ` (import/include).
- [ ] `fixtures/images/main.typ` + a small committed PNG/JPEG/SVG.
- [ ] `fixtures/bibliography/main.typ` + `refs.bib`.
- [ ] `fixtures/unicode/main.typ` — non-ASCII content.
- [ ] `fixtures/errors/main.typ` — intentionally invalid Typst.
- [ ] `fixtures/fonts/` — uses a system font only (no bundled font dependency).

### Integration tests (`cargo test`, real sidecar)

Valid fixture (`fixtures/basic`):

- [ ] Typst process exits success.
- [ ] candidate exists at cache path.
- [ ] candidate starts with `%PDF-`.
- [ ] candidate size is non-trivial (> 1 KiB).
- [ ] project directory receives no generated preview PDF (assert no `.pdf` written under `fixtures/basic`).

Invalid fixture (`fixtures/errors`):

- [ ] process returns failure.
- [ ] bounded diagnostic captured in `stderr`.
- [ ] Tykuru backend does not panic; returns structured `Err`.

Also:

- [ ] sidecar checksum verified by `scripts/verify_typst.ps1` in CI before compile tests run.

### Manual

Open generated cached PDF externally during debugging and verify it is correct.

### Commit

```text
feat(compiler): compile typ documents with bundled typst
```

### Exit gate

Tykuru can compile representative Typst files with only its bundled compiler.

---

## 9. Stage 4 — immutable preview revision store

### Goal

Create the safe boundary between Typst output and PDF.js.

### Architecture refs

Implements: §12 (preview publication), §12.1 (candidate verification), §12.1b (notify), §12.2 (revision ordering), §12.3 (last-good), §13 (delivery), §17 (cache).

### Implement

- [ ] `preview/mod.rs`, `preview/revisions.rs`:
  - `PreviewRevision { session_id: SessionId, number: u64, path: PathBuf }`.
  - `RevisionStore` per session: `current: Option<u64>`, `published: Vec<PreviewRevision>` (bounded, e.g. keep last 3).
  - `commit_candidate(session, candidate_path) -> Result<PreviewRevision>`:
    1. verify `session_id` is active;
    2. bounded stable full read (read bytes fully, `re-stat`, require size unchanged within a short window; retry a few times);
    3. require non-zero length;
    4. require leading `%PDF-` and trailing `%%EOF` presence as basic sanity;
    5. write NEW `<cache>/revision-{:06}.pdf` fully, flush, close;
    6. update `current` to the new number (monotonic increment);
    7. garbage-collect all but newest N revisions (root-bounded delete).
- [ ] `preview/delivery.rs`: Tauri command `get_preview_pdf(session_id: SessionId, revision: u64) -> Result<tauri::ipc::Response>`:
  - reject unknown session, reject revision != current (or not in published set);
  - resolve internally known path (no frontend path input);
  - read file bytes, return `tauri::ipc::Response::new(bytes)` (ArrayBuffer).
- [ ] `preview/output_watch.rs`: `notify` `RecommendedWatcher` on the session cache directory (parent of `candidate.pdf`), non-recursive. On any event, debounce ~50–150 ms, then call `commit_candidate` if the active session matches. This stage wires only the candidate watcher; source watching added in Stage 6/10.
- [ ] `commands/preview.rs`: expose `get_preview_pdf`. Emit `preview-updated(session_id, revision)` event after each successful commit (frontend consumes in Stage 5).

### Backend tests (`cargo test`)

- [ ] valid candidate commits to an immutable revision file.
- [ ] empty file rejected.
- [ ] non-PDF (no `%PDF-`) rejected.
- [ ] a candidate that is replaced mid-read (simulate by swapping file between read and re-stat) does not publish a partial/half-written revision.
- [ ] revisions increase monotonically per session.
- [ ] stale `SessionId` cannot publish.
- [ ] `get_preview_pdf` rejects unknown session and unknown/outdated revision.
- [ ] traversal-like requests rejected (no path input accepted; assert resolution never escapes cache root).
- [ ] cleanup deletes only files under the session cache root; a sibling path is refused.

### Commit

```text
feat(preview): add immutable pdf revision pipeline
```

### Exit gate

Backend can safely publish an immutable PDF revision addressed by session/revision identity.

---

## 10. Stage 5 — PDF.js viewer

### Goal

Display a committed Typst PDF inside Tykuru.

### Architecture refs

Implements: §12.3 (last-good), §13 (delivery), §14 (PDF.js viewer), §14.1 (view-state).

### Implement

- [ ] Add pinned `pdfjs-dist` to `package.json`; import `pdfjsLib` and set `GlobalWorkerOptions.workerSrc` (Vite `?url` or `pdf.worker.min.mjs` asset) so the worker runs under Tauri.
- [ ] `src/preview/PdfViewer.tsx`: wraps PDF.js; holds a `PDFDocumentProxy`; renders pages to canvas + text layer. Use PDF.js viewer/display components rather than reimplementing primitives.
- [ ] `src/preview/preview-controller.ts`: listens for `preview-updated(session_id, revision)`; on event, calls `invoke('get_preview_pdf', { sessionId, revision })`, converts `ArrayBuffer` → `Uint8Array`, calls `pdfjsLib.getDocument({ data })`. Rejects stale `session_id` and older `revision` (compare against currently displayed).
- [ ] `src/preview/view-state.ts`: tracks `{ scaleMode, scaleValue, visiblePage, relativeOffset }`.
- [ ] `src/preview/revision-guard.ts`: pure helpers `isNewerRevision(current, incoming)` and `isSameSession(active, event)` used by the controller (unit-tested).
- [ ] `PdfViewer` adds page-width default scale, continuous vertical pages, zoom in/out/reset buttons wired to toolbar (`Zoom -/+` and indicator). Preserve selectable text layer. Support internal links. External links open via a deliberate backend `open_url`/`shell` path gated by user action (stub safe handler now: log + no-op or confirm).
- [ ] Find/search: implement minimal text-search highlight if feasible this stage; otherwise leave a clearly scoped follow-up and ensure the toolbar item is absent/disabled rather than faking success.

### Frontend tests (Vitest + RTL)

- [ ] `revision-guard`: stale session preview event ignored; older revision event ignored; newer revision accepted.
- [ ] requested revision identity changes with revision (controller requests the new `revision` number).
- [ ] viewer load failure (reject `getDocument`) produces a controlled UI error state, not an unhandled crash.

### Manual/E2E

- [ ] open `basic/main.typ`;
- [ ] see real rendered document;
- [ ] zoom;
- [ ] select/copy text;
- [ ] open multipage fixture and scroll.

### Commit

```text
feat(preview): render typst pdf with pdfjs
```

### Exit gate

The full one-shot vertical pipeline works:

```text
Open .typ → Typst → committed PDF → PDF.js
```

---

# PHASE C — LIVE PREVIEW

## 11. Stage 6 — replace one-shot compile with `typst watch`

### Goal

External editor saves update Tykuru automatically.

### Architecture refs

Implements: §11.2 (process launch), §11.3 (why watch), §12.1b (notify), §8.2 (one watcher), §8.3 (async/cancellation: `SessionId` checks are correctness; optional `CancellationToken` only aids resource cleanup), §3.5 (lifecycle), §2 (non-goals: no second build system).

### Implement

- [ ] `compiler/sidecar.rs`: add `start_watch(session) -> Result<CommandChild>` launching `typst watch <entry> <cache>/candidate.pdf --root <project_root>` via sidecar API, args separate, child handle retained in `CompilerProcess`.
- [ ] `CompilerService`: `start(session)` spawns exactly one watcher; `stop(session)` kills the child and `wait()`s (with timeout) to confirm exit; `restart_on_root_change()`.
- [ ] Replace `CompilerService::compile_once` usage in the open flow with `start_watch`; keep `compile_once` only as a test helper / fallback.
- [ ] The candidate watcher from Stage 4 already observes `candidate.pdf` changes; ensure it is reused (debounce + stable read + commit) so watch-mode output flows through the same `commit_candidate` path.
- [ ] `ShutdownCoordinator` (`shutdown.rs`): on app exit, iterate active session, `stop()` watcher, await exit, then allow close. Add an explicit Windows acceptance test (manual for now, automated in Stage 17/20) that upgrade/reinstall/shutdown leaves no `typst.exe`.
- [ ] Reject a second watcher for the same active session (assert invariant in `start`).
- [ ] Where useful, scope watcher/output tasks with `tokio-util::CancellationToken` for orderly cleanup; correctness still relies on `SessionId` validation of every event, not on cancellation being instantaneous (§8.3).

### Critical tests

Integration test (real service + real sidecar):

1. Copy fixture (with an import) to temp directory.
2. Start Typst watch through `CompilerService::start`.
3. Wait for revision 1 (via `preview-updated`).
4. Modify `main.typ`; assert revision increases.
5. Modify the imported `.typ`; assert revision increases again (proves Typst owns dependency graph, Tykuru does not).
6. Stop session; assert child process exits (pid gone / `wait` completes).

Also test:

- [ ] starting a watch when one already exists for the session returns an error / no duplicate child.
- [ ] rapid repeated saves coalesce; output watcher duplicate events do not publish corrupted revisions.
- [ ] stale old session cannot publish after switching to a new file (old child killed before new publish).
- [ ] `process lifecycle helpers` unit test: `stop()` triggers child kill + `wait()` and reports completion even on a slow/non-responsive child (timeout path); `CancellationToken` cancellation propagates without panicking.

### Manual

Open the same source in VS Code or another editor and repeatedly save it while watching Tykuru.

### Commit

```text
feat(watch): live refresh typst preview on source changes
```

### Exit gate

Tykuru functions as a useful preview companion for any external editor.

---

## 12. Stage 7 — compile errors and last-good preview

### Goal

Make editing robust while source is temporarily invalid.

### Architecture refs

Implements: §11.4 (diagnostics), §12.3 (last-good), §7.5 (UI states), §20 (events).

### Implement

- [ ] `compiler/diagnostic.rs`: `CompileState { Idle | Compiling | Ready { revision } | Error { message, last_good_revision } }` stored on the session; `CompilerService` updates it (typst watch has no per-build exit, so derive `Compiling`→`Ready`/`Error` from candidate commit success/failure and a bounded stderr tail).
- [ ] `commands/document.rs` / event channel: emit `compile-state-changed(session_id, state)` whenever state changes; frontend updates toolbar.
- [ ] `src/components/preview/DiagnosticBanner.tsx`: compact banner/popover showing bounded diagnostic text; visible only in `Error`.
- [ ] `Toolbar` compile-status chip renders `Compiling`/`Ready`/`Error` from `compile-state-changed`.
- [ ] Last-good guarantee: `RevisionStore.current` is only updated on successful commit; an `Error` state never clears/rolls back the displayed revision.
- [ ] On recovery (next successful commit), transition `Error` → `Ready{new_revision}` and clear the banner.

### Test sequence (real Typst)

```text
valid source → revision N, state Ready(N)
invalid source → state Error + revision N remains displayed
valid source → revision N+1, state Ready(N+1), banner cleared
```

Automate by copying a fixture to temp, writing valid then invalid then valid source and asserting state + displayed revision via the event channel.

### Test sequence

```text
valid source → revision N
invalid source → Error + revision N remains
valid source → revision N+1 + Ready
```

Automate this with real Typst.

### Manual

Type an incomplete Typst construct and verify the document remains visible without white flashes.

### Commit

```text
fix(preview): keep last good revision during compile errors
```

### Exit gate

Typst syntax errors behave like normal editor states, not application failures.

---

## 13. Stage 8 — viewport preservation and race protection

### Goal

Make live refresh visually stable.

### Architecture refs

Implements: §14.1 (view-state preservation), §12.2 (revision ordering/race).

### Implement

Track (`src/preview/view-state.ts`):

```text
scaleMode | scaleValue
visiblePage
relativeOffsetWithinPage  // fraction 0..1 of scroll position inside the visible page
```

On `preview-updated(session_id, revision)`:

- [ ] keep old PDF visible until the new load is ready (don't blank/remount).
- [ ] reject old `session_id` loads via `revision-guard.isSameSession`.
- [ ] reject older `PreviewRevision` completions via `revision-guard.isNewerRevision`.
- [ ] restore `page`, `offset`, `zoom` after the new document loads.
- [ ] clamp `visiblePage` to the new document's page count if pagination shrank.
- [ ] avoid stealing editor focus (manage focus so preview load doesn't move focus to the viewer).

Implementation detail: `preview-controller.ts` maintains an in-flight load token; when a newer revision arrives mid-load, the older load result is discarded on arrival.

### Unit tests (Vitest)

- [ ] `computeRelativeOffset(scrollTop, pageTop, pageHeight)` returns clamped 0..1.
- [ ] `clampPage(target, pageCount)` clamps to `[1, pageCount]`.
- [ ] page-width restoration maps `scaleMode: 'page-width'` correctly.
- [ ] numeric zoom restoration maps `scaleValue` correctly.
- [ ] stale async load cannot replace newer: simulate load A started, load B started+finished, then A finished → displayed stays B.

### Manual

- [ ] open 10+ page fixture;
- [ ] move to page 7;
- [ ] edit content near beginning externally;
- [ ] verify preview remains approximately at page 7.

### Commit

```text
feat(preview): preserve viewport across live revisions
```

### Exit gate

Normal edits feel like the current document changed instead of a whole new viewer reopening.

---

# PHASE D — OPTIONAL EDITOR

## 14. Stage 9 — CodeMirror editor pane

### Goal

Add lightweight editing while preserving preview-first design.

### Architecture refs

Implements: §15 (editor), §15.1 (scope), §15.2 (save path), §15.3 (self-write), §20 (commands).

### Implement

- [ ] Install CodeMirror 6 modules deliberately: `codemirror`, `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/lang-<typst-or-plain>` (syntax only — do NOT add any CodeMirror package that bundles a WASM/Typst compiler or alternative diagnostics authority). Plain text/indentation highlighting is acceptable if no Typst mode exists yet.
- [ ] `src/components/editor/EditorPane.tsx` + `TypstEditor.tsx`: mounts CodeMirror with extensions: line numbers, history (undo/redo), bracket/quote behavior, `Ctrl+S` keymap, basic indentation. No LSP/completion.
- [ ] `src/components/editor/SaveStatus.tsx`: `saved`/`saving`/`dirty` indicator.
- [ ] `src/editor/autosave.ts`: 200–300 ms debounce; `src/editor/editor-state.ts`: dirty/saving/last-saved snapshot.
- [ ] Load source via new command `read_source(session_id) -> String` (narrow; only the active entry file). Show in editor on open.
- [ ] Collapse: `WorkspaceSplit` toggles editor pane; editor `EditorView` state is retained (keep the CM instance mounted but hidden, or serialize state) so toggling doesn't lose buffer/undo. Persist `editor_visible` + `split_ratio` in settings (see Stage 16).

### Backend save API

Implement a dedicated `SourceWriter` (`source/write.rs`) save transaction rather than a bare `std::fs::write`. `SourceWriter::save(session, text, expected_disk_revision) -> Result<DiskRevision>`.

Conceptually:

```text
save_source(session_id, text, expected_disk_revision)
```

Not:

```text
write_file(path, data)
```

The transaction revalidates the expected disk revision, prepares a replacement (temp sibling / safe write), performs a final revision check, commits (atomic replace where practical), and records the self-write identity. Tykuru detects external-edit conflicts and never knowingly overwrites a newer disk revision; it does not aggressively lock the source file so it stays a good citizen alongside other editors.

### Frontend tests (Vitest)

- [ ] typing marks dirty.
- [ ] debounce sends one save for a burst of keystrokes within the window.
- [ ] continued typing resets timer.
- [ ] `Ctrl+S` saves immediately (cancels debounce).
- [ ] collapse preserves buffer/editor object appropriately (no content loss).
- [ ] document switch does not leak old buffer into new session.

### Backend tests (`cargo test`)

- [ ] only the active entry file can be saved.
- [ ] stale session save rejected.
- [ ] Unicode round-trip preserved.
- [ ] write error returned structurally (not panic).
- [ ] expected disk revision validated (mismatch rejected).
- [ ] external modification during the save gap is detected, not silently overwritten.
- [ ] source write uses safe/atomic persistence (no truncated in-place overwrite; verify temp-sibling + replace).

### E2E

- [ ] open file;
- [ ] open editor;
- [ ] change visible word;
- [ ] autosave;
- [ ] verify disk changed;
- [ ] verify preview revision increases;
- [ ] collapse editor;
- [ ] preview expands.

### Commit

```text
feat(editor): add collapsible codemirror source editor
```

### Exit gate

Tykuru supports both preview-only and minimal split edit/preview workflows.

---

## 15. Stage 10 — external editor synchronization and conflict safety

### Goal

Prevent data loss when an external editor changes the same file.

### Architecture refs

Implements: §16 (external editor sync), §15.3 (self-write detection), §12.1b (notify), §8.3 (SessionId).

### Implement

- [ ] Extend `source/external_watch.rs`: watch `parent(entry.typ)` non-recursively; filter events for the entry file name; debounce; on a hint, `re-stat`/`re-read` the entry and compare a stable snapshot identifier (`DiskRevision` = content hash or mtime+size) against the last known disk revision.
- [ ] Track `DiskRevision` per session and Tykuru's own last successful write revision (`SourceWriter` records it). Ignore notifications whose new `DiskRevision` equals the self-write identity (no spurious reload/cursor jump).
- [ ] `src/editor/source-sync.ts`: state machine `Clean | Dirty | Saving | Conflict`.
  - external change while `Clean` → reload buffer from disk (preserve cursor where possible), update `DiskRevision`.
  - external change while `Dirty` (pending local edits) → enter `Conflict`; stop autosave; emit `source-conflict` event.
- [ ] Conflict UI: `Reload external` (discard local pending buffer, load disk) and `Keep my version` (explicit confirm → `save_source` with current expected disk revision, then resume normal state). Never auto-resolve.
- [ ] Emit `source-changed` when an external reload occurs (frontend can show a subtle indicator).

### Tests

- [ ] external save while `Clean` reloads editor with disk content.
- [ ] self-save's notification does not cause unnecessary cursor reset (matched `DiskRevision`).
- [ ] external save while `Dirty` enters `Conflict`; autosave suspended.
- [ ] no automatic write happens during `Conflict`.
- [ ] `Reload external` produces the disk version in the buffer.
- [ ] `Keep my version` requires explicit action and then writes the local version (and only then).

### Manual

Open one `.typ` in Tykuru and VS Code. Edit both inside autosave timing and verify no silent overwrite.

### Commit

```text
fix(editor): protect against external source conflicts
```

### Exit gate

Internal and external editing can safely coexist.

---

# PHASE E — WINDOWS DOCUMENT APPLICATION

## 16. Stage 11 — initial command-line open handling

### Goal

Make release/dev executable accept a Typst file path directly.

### Architecture refs

Implements: §9 (opening), §9.1 (path validation), §20 (boundary), §21 (untrusted args).

### Implement

- [ ] `open_request.rs`: `parse_launch_args(args: Vec<String>) -> Option<PathBuf>` that selects the first argument that is a valid `.typ` path; converts `file:///C:/...` to a path; ignores `--flag`, URLs, and empty input. Returns `None` (not an error) when no document argument is present, so normal window launch is unaffected.
- [ ] In `lib.rs` run setup, read `std::env::args()` once; if a path is parsed, open it through `OpenRequestRouter` after the window is created (or queue until ready). Never shell-interpolate.
- [ ] Single-instance forwarding (Stage 12) reuses the same `parse_launch_args`.

### Rust tests

`parse_launch_args` cover:

```text
["tykuru.exe","C:\\paper\\main.typ"]        -> Some(C:\paper\main.typ)
["tykuru.exe","C:\\My Paper\\main.typ"]     -> Some(... spaces ...)
["tykuru.exe","C:\\用户\\论文.typ"]          -> Some(... Unicode ...)
["tykuru.exe","file:///C:/paper/main.typ"]  -> Some(C:\paper\main.typ)
["tykuru.exe","--flag"]                     -> None
["tykuru.exe","https://example.com/file.typ"] -> None
["tykuru.exe"]                              -> None
```

### Manual Windows

```text
tykuru.exe C:\TykuruTest\main.typ
```

### Commit

```text
feat(windows): open typ path from process arguments
```

### Exit gate

Launching `tykuru.exe <file.typ>` opens the expected document.

---

## 17. Stage 12 — single-instance behavior

### Goal

Multiple Explorer opens reuse the one Tykuru window.

### Architecture refs

Implements: §9.2 (single-instance), §20 (boundary), §8.2 (teardown), §8.3 (stale rejection).

### Implement

- [ ] Add `tauri-plugin-single-instance` to `Cargo.toml` and `lib.rs` plugin registration (in correct order relative to other plugins).
- [ ] In the single-instance callback, read the new process args, run `parse_launch_args` (Stage 11), and if a path is found, route through `OpenRequestRouter`.
- [ ] Before switching, call `SessionManager::close()` (tears down compiler watcher + watchers), then open B.
- [ ] Restore minimized window (`window.show()`, `set_focus()`, `unminimize()`).
- [ ] Reuse the existing `preview-updated`/`compile-state-changed` event handlers; they already carry `session_id`, so stale A events are ignored after teardown.

### Tests

Backend logic (simulate the routing, no GUI needed):

- [ ] second open B replaces A (manager holds B as active).
- [ ] a compiler event stamped with A's `session_id` after teardown is rejected by `RevisionStore`/controller.
- [ ] a preview event stamped with A's `session_id` after teardown is rejected.

Manual Windows:

1. Launch Tykuru with A.
2. Launch `tykuru.exe B.typ`.
3. Confirm only one main window remains.
4. Confirm B is loaded.
5. Confirm no orphan watcher for A (process list shows no `typst.exe` for A).

### Commit

```text
feat(windows): route second file launch to existing instance
```

### Exit gate

Tykuru has deterministic one-window document ownership.

---

## 18. Stage 13 — `.typ` Windows file association

### Goal

Make Tykuru appear as a Windows Typst document application.

### Architecture refs

Implements: §9.3 (Windows association), §20 (boundary).

### Implement

- [ ] Add to `tauri.conf.json` `bundle.fileAssociations`: ext `typ`, name `Typst Document`, description, and a per-target command/icon registration. This makes Tykuru *available* as a handler.
- [ ] Ensure the installer/launcher passes the double-clicked path as a command-line argument so Stage 11/12 routing handles it.
- [ ] Do not set Tykuru as the forced default; Windows/user choice remains authoritative (§9.3).
- [ ] Product metadata (publisher/description) set for installer + association display.

### Manual installed-build tests

- [ ] **Open with → Tykuru** appears/works.
- [ ] Set Tykuru as association manually via Windows defaults UI.
- [ ] Double-click `.typ`.
- [ ] File opens in running or new Tykuru as appropriate (single-instance in Stage 12 reuses the window).
- [ ] path with spaces works;
- [ ] Unicode path works.

### Commit

```text
feat(windows): register typ document file association
```

### Exit gate

`.typ` files are first-class Windows open targets for Tykuru.

---

# PHASE F — TYPST COMPATIBILITY AND UX

## 19. Stage 14 — project root and font support

### Goal

Avoid breaking common valid Typst project layouts.

### Architecture refs

Implements: §10 (project root), §11.2 (restart watcher), §18 (settings), §3.1 (font discovery owned by Typst).

### Project root

- [ ] `session/root.rs`: `ProjectRootService::set_root(session, path)` validates (canonicalize, is directory), persists an override keyed by canonical entry path in `SettingsV1.root_overrides`, then restarts the compiler watcher with the new `--root`.
- [ ] Add **Set Project Root…** dialog (`components/` using dialog + path from `tauri-plugin-dialog` folder picker) calling `set_project_root(session_id, root)`.
- [ ] Default remains `parent(entry)` when no override exists.
- [ ] Keep old preview visible until the new root compile succeeds (last-good guarantee preserved through `RevisionStore.current`).

### Fonts

First verify system font behavior from Typst sidecar (system fonts already covered by `fixtures/fonts`).

If a requirement exists:

- [ ] add custom font directory setting to `SettingsV1`;
- [ ] pass Typst-supported font path option (`--font-path`) to the sidecar;
- [ ] test spaces/Unicode.

### Tests

- [ ] imports within parent root resolve and publish a revision.
- [ ] document requiring a manually higher root: setting root publishes a revision that fails under the default root.
- [ ] invalid/disappearing root: `set_root` returns structured error; session stays open with prior preview.
- [ ] system font fixture renders.
- [ ] custom font path if feature exists (spaces/Unicode).

### Commit

```text
feat(typst): support project root configuration
```

If custom fonts are added separately:

```text
feat(typst): support custom font directories
```

### Exit gate

Common multi-file Typst projects work predictably.

---

## 20. Stage 15 — compatibility fixture matrix

### Goal

Validate Tykuru does not unnecessarily break ordinary native Typst documents.

Required fixture coverage:

| Feature | Fixture |
|---|---|
| text/headings | `basic` |
| equations | `basic` |
| tables | `basic` |
| `#include` | `imports` |
| `#import` local | `imports` |
| PNG/JPEG/SVG | `images` |
| bibliography/citations | `bibliography` |
| Unicode content | `unicode` |
| Unicode source path | runtime temp test |
| multipage | `multipage` |
| system fonts | `fonts` |
| compile error/recovery | `errors` |
| large document | `large` |
| package import | separate network-sensitive fixture |

### Package policy

Network-sensitive package acquisition should not make deterministic normal CI flaky.

Use separate optional/nightly or controlled-cache tests for first-time package download behavior.

Clearly distinguish:

```text
fully local document
cached Typst package
uncached package requiring network
```

### Required fixture artifacts

Ensure these fixtures exist and are checked in (Stage 3 created the base set; add the rest here):

- [ ] `fixtures/multipage/main.typ` — 12+ pages of varied content (to exercise viewport preservation and scrolling).
- [ ] `fixtures/large/main.typ` — a sizable document (many pages / repeated content) used for the `fixtures/large` performance benchmark referenced in §13 (deferred custom protocol decision).
- [ ] `fixtures/fonts/main.typ` — uses a system font explicitly.
- [ ] A runtime temp-path test (not committed) for Unicode source paths.

### Integration harness

Add a Rust integration test (`tests/integration/`) that, for each fully-local fixture, copies it to a temp dir, starts the real `CompilerService` watch, asserts a revision is published, and (where applicable) asserts the revision PDF is non-trivial and starts with `%PDF-`. Run via `pnpm typst:fixtures`.

### Commit

```text
test(typst): add representative compatibility fixture suite
```

### Exit gate

The project has executable evidence for its compatibility claims (fixtures run against the real sidecar in CI).

---

## 21. Stage 16 — keyboard and product polish

### Goal

Make the minimal application feel deliberate.

Recommended shortcuts:

```text
Ctrl+O       Open .typ
Ctrl+S       Save editor when editor is active/dirty
Ctrl+F       Find according to focused surface
Ctrl++       Preview zoom in
Ctrl+-       Preview zoom out
Ctrl+0       Reset/page-width preview
Ctrl+\       Toggle editor if conflict-free on target keyboards
```

### Architecture refs

Implements: §18 (settings), §7.4 (themes), §19 (UI), §27.3 (settings persistence).

### Implement

- [ ] `settings/model.rs`: `SettingsV1 { version: u32, theme: Theme, editor_visible: bool, split_ratio: f64, recent_files: BoundedRecentFiles, root_overrides: RootOverrideMap, window_state: Option<WindowState> }` with `Default` and a `migrate` step keyed on `version`.
- [ ] `settings/store.rs`: load from `<config>/settings.json`; on write, serialize to a temp sibling then atomic rename (or use a mature atomic-write crate). Corrupt/missing file falls back to `Default` without crashing.
- [ ] `commands/settings.rs`: `get_settings() -> SettingsV1`, `update_settings(patch: SettingsPatch) -> SettingsV1` (validated, bounded). Persist on change.
- [ ] Wire persisted values: theme (Stage 1 provider reads settings), `editor_visible` + `split_ratio` (Stage 9), `recent_files` (push on open, bounded ~10, prune missing via a `PruneMissing` action), `root_overrides` (Stage 14), window bounds where practical.
- [ ] Keyboard shortcuts (global window listeners): `Ctrl+O` open, `Ctrl+S` save when editor active/dirty, `Ctrl+F` focus-surface find, `Ctrl+=`/`Ctrl+-` zoom, `Ctrl+0` page-width reset, `Ctrl+\` toggle editor when not in `Conflict`.
- [ ] Accessible `aria-label`/`Tooltip` on all icon buttons (carried from Stage 1; verify coverage).
- [ ] Compact diagnostic presentation (`DiagnosticBanner`), sensible focus management (preview load must not steal editor focus), minimum window sizes, no permanent sidebar.

### Tests

- [ ] keyboard activation: each shortcut triggers the intended action.
- [ ] shortcuts respect focus: `Ctrl+S` only saves when editor focused/dirty; `Ctrl+F` targets the focused surface.
- [ ] recent missing file is handled (pruned, no crash on open).
- [ ] theme state persists across reload (write settings, reload, assert `class="dark"`).
- [ ] settings write uses atomic replace (simulate crash mid-write; reload yields valid previous or default, never a truncated file).
- [ ] narrow window (1024×640) remains usable (no overflow/clipped controls).

### Commit

```text
feat(ux): complete minimal desktop interaction polish
```

### Exit gate

Tykuru feels like a compact document app rather than a technology demo.

---

# PHASE G — AUTOMATION, PACKAGING, RELEASE

## 22. Stage 17 — desktop E2E suite

### Goal

Test real Tauri behavior, not only isolated modules.

Use the current Tauri-supported WebDriver/WebdriverIO approach suitable for Windows.

### E2E scenarios

Use the current Tauri-supported WebDriver/WebdriverIO approach suitable for Windows, driving a real built app (`pnpm build:windows` artifact or `tauri dev` in the runner). Each scenario asserts against observable DOM/process state, not internal logs.

#### open-document

- [ ] launch app;
- [ ] open fixture through test-accessible flow (dialog automation or CLI arg);
- [ ] filename visible in toolbar;
- [ ] `compile-state-changed` reaches `Ready`;
- [ ] PDF canvas / text layer present in preview pane.

#### live-preview

- [ ] open temporary fixture copy;
- [ ] modify source externally (write file from test);
- [ ] wait for newer `preview-updated` revision;
- [ ] app stays responsive (no hang/crash).

#### dependency-watch

- [ ] open imports fixture;
- [ ] modify imported file;
- [ ] verify newer revision (proves Typst dependency graph, not Tykuru).

#### error-recovery

- [ ] make source invalid (write bad Typst);
- [ ] status Error;
- [ ] existing preview canvas remains;
- [ ] repair file;
- [ ] status Ready / new revision.

#### editor

- [ ] expand editor;
- [ ] edit;
- [ ] autosave (wait debounce);
- [ ] verify disk bytes changed;
- [ ] verify preview advances.

#### switch-document

- [ ] open A;
- [ ] open B;
- [ ] B is active (toolbar filename = B);
- [ ] late A events do not alter UI (assert revision belongs to B).

#### shutdown

- [ ] open document;
- [ ] ensure watcher exists (process list `typst.exe`);
- [ ] close Tykuru;
- [ ] verify `typst.exe` exited (no orphan).

#### single-instance

When reliable in runner:

- [ ] launch first instance;
- [ ] invoke second with `.typ`;
- [ ] existing window receives document (single window, filename = second).

### Commit

```text
test(e2e): cover primary desktop document workflows
```

### Exit gate

Core user behavior is reproducible against an actual desktop build.

---

## 23. Stage 18 — CI pipeline

### `verify.yml`

Trigger:

```text
pull_request
push to main
```

Pipeline:

```text
checkout
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
fetch/verify pinned Typst test binary
pnpm typst:fixtures
```

### Windows E2E job

- [ ] run on supported Windows runner;
- [ ] build application;
- [ ] run desktop E2E;
- [ ] capture useful logs/artifacts only on failure where possible.

### Commit

```text
ci(verify): enforce frontend rust and typst test gates
```

Optional second commit:

```text
ci(windows): run desktop e2e on windows
```

### Exit gate

Pull requests cannot silently merge changes that break the core verification suite. The pipeline enforces the coding standards in `architecture.md §6.2` (`cargo clippy -- -D warnings`, strict `tsc`, lint, tests, real-sidecar fixtures).

---

## 24. Stage 19 — Windows release build and installer

### Goal

Produce what a normal Windows user installs.

### Implement

- [ ] product name `Tykuru`;
- [ ] stable application identifier;
- [ ] icon set/`.ico`;
- [ ] publisher/description metadata as appropriate;
- [ ] bundle official Typst sidecar;
- [ ] bundle PDF.js assets locally;
- [ ] bundle frontend locally;
- [ ] declare `.typ` association;
- [ ] build optimized Tauri release binary;
- [ ] build NSIS installer;
- [ ] optionally build MSI later;
- [ ] WebView2 strategy: Evergreen WebView2 with bootstrapper fallback (not a fixed runtime);
- [ ] generate SHA-256 for release artifacts.

### Clean Windows VM matrix

At minimum Windows 11.

If Windows 10 remains a supported target, test it too.

Test:

- [ ] fresh install;
- [ ] normal launch;
- [ ] no global Typst installed;
- [ ] Open dialog;
- [ ] preview;
- [ ] external live edit;
- [ ] editor autosave;
- [ ] project root;
- [ ] Open With;
- [ ] associated double-click;
- [ ] second-instance file open;
- [ ] path with spaces;
- [ ] Unicode path;
- [ ] restart;
- [ ] uninstall;
- [ ] no unexpected leftover Typst process.

### Commit

```text
build(windows): produce nsis installer with typ association
```

### Exit gate

A non-developer can install and use Tykuru on clean Windows.

---

## 25. Stage 20 — release hardening

### Reliability stress

- [ ] 100 rapid source-save cycles;
- [ ] 100 document switch cycles;
- [ ] close app during compile;
- [ ] delete source while open;
- [ ] rename/move source while open;
- [ ] delete configured root while open;
- [ ] long diagnostics;
- [ ] large multipage PDF;
- [ ] suspend/resume if practical;
- [ ] no orphan Typst child after each scenario.

### Security review

- [ ] frontend cannot spawn arbitrary processes;
- [ ] frontend cannot write arbitrary paths;
- [ ] preview delivery is identity-addressed and cannot traverse/read arbitrary files;
- [ ] cache cleanup is root-bounded;
- [ ] CSP reviewed;
- [ ] external URL behavior reviewed;
- [ ] launch args are never shell-interpolated;
- [ ] bundled Typst comes from controlled official source;
- [ ] dependency audit reviewed;
- [ ] settings persisted atomically (no corruptible in-place overwrite).

### Performance measurements

Measure independently (use `fixtures/large`):

```text
app startup
open request → Typst process start
Typst compile/watch latency
candidate → committed revision latency
revision event → PDF visible latency
idle CPU
idle memory
large-document scrolling
```

Only optimize measured bottlenecks.

Decision gate: run the `fixtures/large` preview benchmark across binary IPC. Only if it shows a real transfer/memory problem, revisit the deferred custom range-capable protocol (`PDFDataRangeTransport`, §13) as a separate architecture change with its own approval. Do not pre-implement it.

### Commit

Use focused commits for actual fixes, then final docs/release preparation:

```text
chore(release): prepare tykuru v1 release candidate
```

### Exit gate

No known release-blocking crash, data-loss path, security boundary failure, installer issue, or major preview regression remains.

---

## 26. Release workflow

Recommended tag flow:

```text
main clean
  ↓
all CI green
  ↓
version bump/release notes
  ↓
commit release preparation
  ↓
tag v1.0.0
  ↓
windows-release workflow
  ↓
tests
  ↓
installer build
  ↓
checksum
  ↓
release artifacts
```

Do not tag a release from a dirty tree or a commit with known failing required checks.

Example release-prep commit:

```text
chore(release): prepare v1.0.0
```

Tag:

```text
v1.0.0
```

---

## 27. Canonical verification commands

These are the target contributor commands. Implement them as the project matures.

### Fast development feedback

```text
pnpm typecheck
pnpm lint
pnpm test
```

### Normal pre-commit verification

```text
pnpm verify
```

`pnpm verify` should eventually cover:

```text
frontend typecheck
frontend lint
frontend tests
frontend production build
cargo fmt --check
cargo clippy -D warnings
cargo test
```

### Typst/compiler verification

```text
pnpm typst:fixtures
```

### Desktop verification

```text
pnpm test:e2e
```

### Windows release verification

```text
pnpm build:windows
```

If a required command cannot run in the current environment, document that limitation explicitly instead of pretending the feature is fully tested.

---

## 28. Recommended milestone grouping

### M0 — Baseline

Stages 0–1.

Result: Tauri/React/shadcn shell runs.

### M1 — Preview prototype

Stages 2–5.

Result:

```text
open .typ → compile once → see PDF
```

### M2 — Live preview core

Stages 6–8.

Result:

```text
external editor save → stable live preview
```

with error continuity and viewport preservation.

### M3 — Minimal editor

Stages 9–10.

Result: optional CodeMirror editing with conflict safety.

### M4 — Windows document application

Stages 11–13.

Result: executable path open, single instance, `.typ` Open With/association.

### M5 — Compatibility/UX

Stages 14–16.

Result: representative Typst feature support, settings, keyboard polish.

### M6 — Release candidate

Stages 17–20.

Result: E2E, CI, installer, hardening, clean-machine validation.

---

## 29. Final release acceptance checklist

### Document open

- [ ] Open button works.
- [ ] drag/drop works.
- [ ] CLI `.typ` argument works.
- [ ] Open With works.
- [ ] associated double-click works.
- [ ] second instance forwards file.

### Typst

- [ ] bundled compiler works without PATH installation.
- [ ] basic text works.
- [ ] math works.
- [ ] tables work.
- [ ] local imports/includes work.
- [ ] images work.
- [ ] bibliography works.
- [ ] Unicode works.
- [ ] system fonts work.
- [ ] configured root works.
- [ ] package behavior is accurately documented/tested.

### Preview

- [ ] PDF renders.
- [ ] text can be selected.
- [ ] zoom works.
- [ ] search works.
- [ ] internal links work.
- [ ] external links follow security policy.
- [ ] live source save refreshes.
- [ ] imported file save refreshes.
- [ ] last good preview stays on compile error.
- [ ] recovery works.
- [ ] viewport remains stable.
- [ ] stale revision cannot replace newer revision.

### Editor

- [ ] toggle works.
- [ ] resize works.
- [ ] typing works.
- [ ] undo/redo works.
- [ ] Ctrl+S works.
- [ ] autosave works.
- [ ] saved status works.
- [ ] Unicode round-trip works.
- [ ] external clean update reloads.
- [ ] external conflict never silently overwrites.

### Reliability

- [ ] document switching is stable.
- [ ] rapid changes do not corrupt preview.
- [ ] compile errors do not crash app.
- [ ] deleted/missing files are controlled errors.
- [ ] app shutdown leaves zero Typst child processes.

### Windows release

- [ ] release executable launches.
- [ ] NSIS installer installs.
- [ ] clean Windows machine passes smoke test.
- [ ] `.typ` association metadata works.
- [ ] paths with spaces work.
- [ ] Unicode paths work.
- [ ] uninstall works.
- [ ] release checksum produced.

### Engineering

- [ ] `pnpm verify` passes.
- [ ] `pnpm typst:fixtures` passes.
- [ ] Windows desktop E2E passes.
- [ ] architecture documentation matches implementation.
- [ ] work plan accurately marks completed gates.
- [ ] Git history contains focused Conventional Commits.
- [ ] no generated/cache/secrets accidentally committed.

---

## 30. Completion statement

Tykuru v1 is achieved when the release artifact behaves as a small Windows Typst document application:

```text
Install Tykuru
   ↓
Open or double-click .typ
   ↓
Official bundled Typst compiles it
   ↓
PDF.js displays it
   ↓
External or built-in edits update it live
   ↓
Errors preserve the last good document
   ↓
Close Tykuru with no orphan processes
```

Do not expand scope beyond this until this pipeline is reliable.

