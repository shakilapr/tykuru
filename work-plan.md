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

### Implement

- [ ] Create repository `tykuru`.
- [ ] Add `AGENTS.md`.
- [ ] Add `architecture.md`.
- [ ] Add `work-plan.md`.
- [ ] Add `README.md` with setup/run/test basics.
- [ ] Choose and add `LICENSE`.
- [ ] Scaffold Tauri 2 + React + TypeScript + Vite.
- [ ] Configure pnpm; commit exactly one package lockfile.
- [ ] Enable strict TypeScript.
- [ ] Install/configure Tailwind CSS.
- [ ] Initialize shadcn/ui with Base UI primitive base (shadcn default).
- [ ] Configure Lucide React.
- [ ] Add Vitest.
- [ ] Add React Testing Library if component tests need it.
- [ ] Configure Rust format/clippy baseline.
- [ ] Add `.editorconfig`.
- [ ] Add `.gitignore`.
- [ ] Create `config/versions.toml`.
- [ ] Add initial `scripts/verify.ps1` or cross-platform package scripts.
- [ ] Add CI skeleton.

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

### Implement

- [ ] Configure semantic shadcn/Tailwind theme tokens.
- [ ] Support system/light/dark theme infrastructure.
- [ ] Add only required shadcn primitives.
- [ ] Create `AppLayout`.
- [ ] Create start screen.
- [ ] Create toolbar.
- [ ] Create preview placeholder.
- [ ] Create collapsible editor placeholder.
- [ ] Create resizable split layout.
- [ ] Add Lucide icons.

Initial controls:

```text
Open .typ
Toggle editor
Filename
Compile status
Zoom -
Zoom indicator
Zoom +
Overflow menu
```

### Test

Frontend unit/component:

- [ ] start screen renders Open button;
- [ ] editor toggle changes pane visibility;
- [ ] split ratio is bounded;
- [ ] preview receives reclaimed width when editor closes;
- [ ] system/light/dark state selects correct theme class/token state;
- [ ] all icon-only buttons have accessible labels/tooltips.

Manual:

- [ ] resize window small/large;
- [ ] toggle editor repeatedly;
- [ ] switch theme;
- [ ] verify no obvious layout overflow.

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

### Backend

Implement narrow commands/services for:

```text
open_document_dialog
open_document
close_document
get_active_session
```

Create:

```text
SessionId
DocumentSession
OpenRequestRouter
```

Initial session fields:

```text
session id
entry path
project root
cache path
```

### Frontend

- [ ] Open button calls native dialog filtered to `.typ`.
- [ ] Drag/drop `.typ` opens it.
- [ ] Filename appears in toolbar.
- [ ] Canceling dialog is harmless.
- [ ] Invalid paths show controlled error.

### Rust tests

Test:

- [ ] `.typ` path accepted;
- [ ] extension case behavior on Windows;
- [ ] normal file required;
- [ ] `.txt` rejected;
- [ ] missing path rejected;
- [ ] paths with spaces survive;
- [ ] Unicode survives;
- [ ] default root = parent;
- [ ] cache path remains under Tykuru cache root;
- [ ] opening B replaces logical session A.

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

### Implement

- [ ] Pin Typst version in `config/versions.toml`.
- [ ] Add controlled Windows sidecar fetch script.
- [ ] Verify expected source/checksum in fetch/release process.
- [ ] Rename/place sidecar according to Tauri external-binary requirements.
- [ ] Configure Tauri permissions narrowly.
- [ ] Implement `CompilerService`.
- [ ] Start with `typst compile` one-shot mode.
- [ ] Compile into session cache.
- [ ] Capture stderr/stdout/exit status.

Pipeline:

```text
main.typ
   ↓
CompilerService
   ↓
bundled typst compile
   ↓
candidate.pdf in cache
```

### Fixtures

Create:

```text
fixtures/basic/
fixtures/imports/
fixtures/images/
fixtures/bibliography/
fixtures/unicode/
fixtures/errors/
```

### Integration tests

Valid fixture:

- [ ] Typst process exits success;
- [ ] candidate exists;
- [ ] candidate starts `%PDF-`;
- [ ] candidate has non-trivial size;
- [ ] project directory does not receive generated preview PDF.

Invalid fixture:

- [ ] process returns failure;
- [ ] diagnostic captured;
- [ ] Tykuru backend does not panic.

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

### Implement

- [ ] Add `PreviewRevision` type.
- [ ] Validate candidate readability via bounded stable full read (read, re-stat, confirm unchanged).
- [ ] Validate non-zero length.
- [ ] Validate `%PDF-` signature and basic PDF sanity.
- [ ] Write a NEW uniquely named immutable revision file fully, then close it.
- [ ] Mark the new revision current.
- [ ] Increment revision monotonically.
- [ ] Store current revision in active session.
- [ ] Retain small bounded revision set (candidate + current + previous is enough).
- [ ] Safely delete old revisions.
- [ ] Add binary IPC `get_preview_pdf(session_id, revision)` returning `tauri::ipc::Response` bytes.
- [ ] Treat `notify` events as hints; parent-directory watchers; local debounce/re-stat state machine.

### Backend tests

- [ ] valid candidate commits;
- [ ] empty file rejected;
- [ ] non-PDF rejected;
- [ ] still-being-written candidate does not publish a partial revision;
- [ ] revisions increase monotonically;
- [ ] stale `SessionId` cannot publish;
- [ ] unknown session/revision cannot be served;
- [ ] traversal-like requests rejected;
- [ ] cleanup cannot escape cache root.

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

### Implement

- [ ] Add pinned `pdfjs-dist`.
- [ ] Configure PDF.js worker for Vite/Tauri.
- [ ] Create `PdfViewer` React component.
- [ ] Load committed revision via `get_preview_pdf` binary IPC into `getDocument({ data })`; no custom preview URL.
- [ ] Add page-width scale.
- [ ] Add continuous vertical pages.
- [ ] Add zoom controls.
- [ ] Preserve selectable text.
- [ ] Support internal links.
- [ ] Handle external links deliberately.
- [ ] Implement find/search or reserve a minimal known follow-up inside this stage.

### Frontend tests

- [ ] stale session preview event ignored;
- [ ] older revision event ignored;
- [ ] requested revision identity changes with revision;
- [ ] viewer load failure produces controlled UI state.

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

### Implement

- [ ] Start exactly one `typst watch` child per session.
- [ ] Retain child handle.
- [ ] Observe `candidate.pdf` output changes using Rust watcher.
- [ ] Debounce/coalesce duplicate output notifications as needed.
- [ ] Commit only stable valid candidates.
- [ ] Emit `preview-updated`.
- [ ] Terminate old watcher when document switches.
- [ ] Terminate watcher on app exit.

### Critical tests

Integration test:

1. Copy fixture to temp directory.
2. Start Typst watch through the real service.
3. Wait for revision 1.
4. Modify `main.typ`.
5. Assert revision increases.
6. Modify an imported `.typ`.
7. Assert revision increases again.
8. Stop session.
9. Assert child exits.

Also test:

- [ ] rapid repeated saves;
- [ ] output watcher duplicate events do not publish corrupted revisions;
- [ ] stale old session cannot publish after switching to new file.

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

### Implement

- [ ] Track compile state separately from preview revision.
- [ ] Capture bounded compiler diagnostic output.
- [ ] Show `Compiling`, `Ready`, `Error` in toolbar.
- [ ] Show compact diagnostic banner/popover.
- [ ] Never clear a valid current preview because the next compile fails.
- [ ] Clear/update diagnostics after recovery.

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

### Implement

Track:

```text
zoom mode/value
current visible page
relative offset within visible page
```

On new revision:

- [ ] keep old PDF until new load is ready;
- [ ] reject old `SessionId` loads;
- [ ] reject older `PreviewRevision` completions;
- [ ] restore page/offset/zoom;
- [ ] clamp page if pagination shrinks;
- [ ] avoid stealing focus.

### Unit tests

- [ ] relative offset calculation;
- [ ] page clamp;
- [ ] page-width restoration;
- [ ] numeric zoom restoration;
- [ ] stale asynchronous load cannot replace newer load.

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

### Implement

- [ ] Install CodeMirror 6 modules deliberately.
- [ ] Create `EditorPane` / `TypstEditor`.
- [ ] Load source through narrow Rust command.
- [ ] Add line numbers.
- [ ] Add undo/redo.
- [ ] Add basic bracket/quote behavior.
- [ ] Support `Ctrl+S`.
- [ ] Add 200–300 ms autosave debounce.
- [ ] Add saved/saving/dirty indicator.
- [ ] Keep editor state when collapsing pane.
- [ ] Persist editor shown/hidden and split ratio.

Do not add LSP/completion yet.

### Backend save API

Implement a dedicated `SourceWriter` save transaction rather than a bare `std::fs::write`.

Conceptually:

```text
save_source(session_id, text, expected_disk_revision)
```

Not:

```text
write_file(path, data)
```

The transaction revalidates the expected disk revision, prepares a replacement (temp sibling / safe write), performs a final revision check, commits (atomic replace where practical), and records the self-write identity. Tykuru detects external-edit conflicts and never knowingly overwrites a newer disk revision; it does not aggressively lock the source file so it stays a good citizen alongside other editors.

### Frontend tests

- [ ] typing marks dirty;
- [ ] debounce sends one save for a burst;
- [ ] continued typing resets timer;
- [ ] Ctrl+S saves immediately;
- [ ] collapse preserves buffer/editor object appropriately;
- [ ] document switch does not leak old buffer into new session.

### Backend tests

- [ ] only active entry file can be saved;
- [ ] stale session save rejected;
- [ ] Unicode round-trip preserved;
- [ ] write error returned structurally;
- [ ] expected disk revision validated;
- [ ] external modification during save gap is detected, not silently overwritten;
- [ ] source write uses safe/atomic persistence (no truncated in-place overwrite).

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

### Implement

- [ ] Watch active entry file for editor synchronization.
- [ ] Track `DiskRevision`/hash or equivalent stable snapshot identifier.
- [ ] Track Tykuru's own last successful write.
- [ ] Ignore equivalent self-write notification.
- [ ] Reload external changes when editor is clean.
- [ ] Enter Conflict when external change occurs with pending Tykuru edits.
- [ ] Stop autosave while in Conflict.

Conflict actions:

```text
Reload external
Keep my version
```

### Tests

- [ ] external save while clean reloads editor;
- [ ] self-save does not cause unnecessary cursor reset;
- [ ] external save while dirty enters Conflict;
- [ ] no automatic write happens during Conflict;
- [ ] Reload external produces disk version;
- [ ] Keep my version requires explicit action and then writes local version.

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

### Implement

- [ ] Parse initial process arguments.
- [ ] Normalize valid Windows paths.
- [ ] Handle quoted paths naturally through argv.
- [ ] Normalize supported `file:///` argument if needed.
- [ ] Ignore unrelated flags/URLs.
- [ ] Route result through the same `OpenRequestRouter` as file dialog.

### Rust tests

Cover:

```text
C:\paper\main.typ
C:\My Paper\main.typ
C:\用户\论文.typ
file:///C:/paper/main.typ
--flag
https://example.com/file.typ
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

### Implement

- [ ] Add/register Tauri single-instance plugin in required order.
- [ ] Parse second-instance arguments using existing parser.
- [ ] Forward valid path through `OpenRequestRouter`.
- [ ] Restore minimized window.
- [ ] Focus/show window.
- [ ] Tear down old active session safely before switching.

### Tests

Backend logic:

- [ ] second open B replaces A;
- [ ] stale A compiler event rejected;
- [ ] stale A preview event rejected.

Manual Windows:

1. Launch Tykuru with A.
2. Launch `tykuru.exe B.typ`.
3. Confirm only one main window remains.
4. Confirm B is loaded.
5. Confirm no orphan watcher for A.

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

### Implement

- [ ] Add Tauri `bundle.fileAssociations` for `typ`.
- [ ] Set product description/metadata.
- [ ] Ensure association launches executable with document argument.
- [ ] Do not forcibly make Tykuru default without user choice.

### Manual installed-build tests

- [ ] **Open with → Tykuru** appears/works.
- [ ] Set Tykuru as association manually.
- [ ] Double-click `.typ`.
- [ ] File opens in running or new Tykuru as appropriate.
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

### Project root

- [ ] default to entry parent;
- [ ] add **Set Project Root…** dialog;
- [ ] validate root;
- [ ] persist per-document override;
- [ ] restart watcher on root change;
- [ ] keep old preview until new root compile succeeds.

### Fonts

First verify system font behavior from Typst sidecar.

If a requirement exists:

- [ ] add custom font directory setting;
- [ ] pass Typst-supported font path option;
- [ ] test spaces/Unicode.

### Tests

- [ ] imports within parent root;
- [ ] document requiring manually higher root;
- [ ] invalid/disappearing root;
- [ ] system font fixture;
- [ ] custom font path if feature exists.

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

### Commit

```text
test(typst): add representative compatibility fixture suite
```

### Exit gate

The project has executable evidence for its compatibility claims.

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

### Implement

- [ ] accessible tooltip/labels for icon buttons;
- [ ] recent files, bounded list;
- [ ] missing recent file handling;
- [ ] theme selection;
- [ ] remember editor split ratio;
- [ ] remember window state where practical;
- [ ] typed `SettingsV1` struct serialized to JSON;
- [ ] atomic/safe settings persistence (temp sibling + replace);
- [ ] compact diagnostic presentation;
- [ ] sensible focus management;
- [ ] minimum window sizes;
- [ ] no unnecessary permanent sidebar.

### Tests

- [ ] keyboard activation;
- [ ] shortcuts respect focus;
- [ ] recent missing file is handled;
- [ ] theme state persists;
- [ ] narrow window remains usable.

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

#### open-document

- [ ] launch app;
- [ ] open fixture through test-accessible flow;
- [ ] filename visible;
- [ ] status becomes Ready;
- [ ] preview exists.

#### live-preview

- [ ] open temporary fixture copy;
- [ ] modify source externally;
- [ ] wait for newer revision;
- [ ] app stays responsive.

#### dependency-watch

- [ ] open imports fixture;
- [ ] modify imported file;
- [ ] verify newer revision.

#### error-recovery

- [ ] make source invalid;
- [ ] status Error;
- [ ] existing preview remains;
- [ ] repair file;
- [ ] status Ready/new revision.

#### editor

- [ ] expand editor;
- [ ] edit;
- [ ] autosave;
- [ ] verify disk bytes;
- [ ] verify preview advances.

#### switch-document

- [ ] open A;
- [ ] open B;
- [ ] B is active;
- [ ] late A events do not alter UI.

#### shutdown

- [ ] open document;
- [ ] ensure watcher exists;
- [ ] close Tykuru;
- [ ] verify watcher exits.

#### single-instance

When reliable in runner:

- [ ] launch first instance;
- [ ] invoke second with `.typ`;
- [ ] existing window receives document.

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

Pull requests cannot silently merge changes that break the core verification suite.

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

Measure independently:

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

