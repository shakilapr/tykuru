# Tykuru Work Plan

**Repository:** `tykuru`  
**Target result:** a Windows desktop application that opens `.typ` files, previews them with the official Typst compiler, refreshes live on edits, and provides an optional collapsible editor.  
**Architecture dependency:** `architecture.md`  
**Plan style:** gated milestones; each stage must remain testable and runnable.

---

## 1. Delivery strategy

Build Tykuru as a vertical pipeline, not as disconnected UI/backend components.

The first successful slice should already be:

```text
Tykuru window
   -> select .typ
   -> invoke Typst
   -> produce PDF
   -> show PDF
```

Then replace one-shot compilation with live watch, add failure recovery, add optional editing, then add Windows shell integration and packaging.

Every stage has:

- implementation tasks;
- automated tests;
- manual checks;
- an exit gate.

Do not move to later convenience features while an earlier gate is unstable.

---

## 2. Definition of done for v1

A release candidate is done only when a clean Windows machine can:

1. install Tykuru using the produced installer;
2. start Tykuru normally;
3. open a `.typ` using the app's Open command;
4. render the file using the bundled official Typst compiler;
5. keep the preview open and live-update when the source changes;
6. show imported images/bibliographies/templates/packages as supported by Typst;
7. preserve the last successful preview during compile errors;
8. open the collapsible editor, edit, autosave, and see preview updates;
9. open a `.typ` through Windows **Open with** / file association;
10. route a second `.typ` launch to the already-running Tykuru instance;
11. close without leaving orphan compiler processes;
12. pass the automated and clean-machine test suite.

---

## 3. Stage 0 — repository and engineering baseline

### Goal

Create a reproducible empty Tauri application before any product logic.

### Tasks

- [ ] Create Git repository named `tykuru`.
- [ ] Add `architecture.md` and `work-plan.md` at repository root.
- [ ] Choose license and add `LICENSE`.
- [ ] Scaffold Tauri 2 + TypeScript + Vite project.
- [ ] Use `pnpm` consistently; do not mix npm/yarn lockfiles.
- [ ] Add `.editorconfig`.
- [ ] Add `.gitignore` for Node, Rust target, Tauri build output, generated sidecars, local cache.
- [ ] Configure TypeScript strict mode.
- [ ] Configure Rust formatting/lints.
- [ ] Add test directories and initial fixture directory.
- [ ] Add CI skeleton.
- [ ] Add one central location/documentation for pinned Typst version.

### Recommended initial commands

Conceptually:

```text
pnpm create tauri-app
pnpm install
pnpm tauri dev
```

Use the current Tauri scaffolding instructions rather than copying an old configuration.

### Automated tests

- [ ] `pnpm build` succeeds.
- [ ] `cargo check` succeeds in `src-tauri`.
- [ ] `cargo fmt --check` succeeds.
- [ ] empty frontend test runner executes successfully.
- [ ] empty/hello Rust test runner executes successfully.

### Manual test

- [ ] `pnpm tauri dev` opens one Windows window.
- [ ] Window closes cleanly.
- [ ] DevTools show no startup exception.

### Exit gate

**Gate 0:** a clean clone can follow README setup and open the baseline Tauri window.

---

## 4. Stage 1 — minimal application shell

### Goal

Create the final UI skeleton before adding Typst.

### Implement

Build three visual states:

1. start/no-document;
2. preview shell;
3. optional editor split pane placeholder.

Required controls:

```text
Open .typ
Editor show/hide
Zoom - / +
Status
Document filename
```

Do not implement a large menu system yet.

### Suggested frontend modules

```text
src/app.ts
src/ui/start-screen.ts
src/ui/toolbar.ts
src/ui/status.ts
src/ui/split-pane.ts
```

### State model

```ts
type AppUiState =
  | { kind: 'empty' }
  | { kind: 'opening'; name?: string }
  | { kind: 'document'; sessionId: string; status: CompileUiState };
```

### Testing

#### Unit

- [ ] empty state renders Open control;
- [ ] document state renders filename;
- [ ] toggling editor changes pane visibility;
- [ ] split ratio clamps to safe minimum/maximum;
- [ ] status mapping has `Compiling`, `Ready`, `Error`.

#### Manual

- [ ] resize window from small to large sizes;
- [ ] editor placeholder can collapse completely;
- [ ] preview area receives the reclaimed width;
- [ ] keyboard focus remains sensible.

### Exit gate

**Gate 1:** the visual shell already resembles the intended Tykuru product, even though no document loads yet.

---

## 5. Stage 2 — `.typ` open flow without compilation

### Goal

Prove that Tykuru can safely receive, validate, and represent a Typst file.

### Backend work

Implement:

```text
open_document_dialog
open_document(path)
close_document
get_active_session
```

Add native dialog plugin.

Create a minimal `DocumentSession` containing:

```text
session id
entry path
project root
cache directory
```

Default root = entry file parent.

### Frontend work

- Open button calls native dialog with `.typ` filter.
- Display filename.
- Add drag-and-drop `.typ` support.
- Show clear error for unsupported/missing file.
- Add Close Document if useful through minimal menu/shortcut.

### Path cases to test

Create fixtures/copies with:

- [ ] normal ASCII path;
- [ ] spaces;
- [ ] parentheses;
- [ ] Unicode filename;
- [ ] Unicode directory;
- [ ] long-ish nested path;
- [ ] read-only source;
- [ ] missing source.

### Rust unit tests

- [ ] `.typ` accepted case-insensitively as intended;
- [ ] non-file path rejected;
- [ ] `.pdf`/`.txt` rejected by normal open route;
- [ ] project root = parent;
- [ ] session cache always lives below Tykuru cache root;
- [ ] opening a second file tears down/replaces first logical session.

### Manual test

- [ ] Open button selects `fixtures/basic/main.typ`.
- [ ] drag same file into Tykuru.
- [ ] filename is correct.
- [ ] app remains stable when user cancels dialog.

### Exit gate

**Gate 2:** Tykuru can robustly open and track a `.typ` file even though it does not render yet.

---

## 6. Stage 3 — bundle and execute official Typst

### Goal

Prove Tykuru ships its own compiler and can compile the active file without requiring a system Typst install.

### Tasks

- [ ] Pin the official Typst release used by v1.
- [ ] Add a script/documented release step to fetch the official Windows binary.
- [ ] Verify expected checksum/source in release workflow.
- [ ] Place/rename binary according to Tauri `externalBin` target-triple requirements.
- [ ] Configure `bundle.externalBin`.
- [ ] Configure the Tauri shell/sidecar permissions narrowly.
- [ ] Implement `CompilerService`.
- [ ] Initially use one-shot `typst compile` before adding watch mode.
- [ ] Capture stdout/stderr and exit status.
- [ ] Compile into session cache, not project directory.

### First vertical slice

```text
Open main.typ
   ↓
Rust creates session
   ↓
Typst sidecar compile
   ↓
cache/candidate.pdf
```

### Integration fixtures

Create:

#### `fixtures/basic/main.typ`

Must contain:

- heading;
- paragraphs;
- math;
- table or figure.

#### `fixtures/imports/`

`main.typ` imports/includes a second `.typ`.

#### `fixtures/images/`

Local image/SVG.

#### `fixtures/bibliography/`

Typst + local `.bib`.

#### `fixtures/unicode/`

Non-ASCII text and optionally Unicode path.

### Automated integration tests

For each valid fixture:

- [ ] compiler process exits successfully;
- [ ] output file exists;
- [ ] output starts with PDF signature;
- [ ] output size is nontrivial;
- [ ] no output PDF appears next to source.

Error fixture:

- [ ] compiler returns failure;
- [ ] diagnostic text is captured;
- [ ] application backend does not panic.

### Manual test

Temporarily expose a `Compile` button or auto-compile on open and verify generated cache PDF opens in a normal PDF reader for debugging.

### Exit gate

**Gate 3:** an installed/dev Tykuru can compile representative local Typst documents using only its bundled compiler.

---

## 7. Stage 4 — PDF.js preview

### Goal

Show the generated PDF inside Tykuru.

### Tasks

- [ ] Add pinned `pdfjs-dist`.
- [ ] Configure worker asset bundling correctly.
- [ ] Implement minimal `PDFViewer` using PDF.js viewer components.
- [ ] Implement backend committed preview revision store.
- [ ] Implement Tauri custom URI protocol for committed preview IDs.
- [ ] Return `Content-Type: application/pdf` and no-store caching policy.
- [ ] Ensure the protocol cannot serve arbitrary paths.
- [ ] Connect successful compile -> revision -> frontend preview URL.

### Viewer features in this stage

- [ ] page-width initial scale;
- [ ] vertical continuous scrolling;
- [ ] zoom buttons;
- [ ] selectable text;
- [ ] clickable internal/external links according to security policy;
- [ ] basic find support or reserve it for Stage 6 if necessary.

### Backend tests

- [ ] unknown session returns 404/error;
- [ ] unknown revision returns 404/error;
- [ ] traversal-like protocol paths rejected;
- [ ] known revision returns exact bytes;
- [ ] current revision can advance monotonically.

### Frontend tests

- [ ] preview controller ignores stale session events;
- [ ] URL changes when revision changes;
- [ ] load failure moves to viewer-error state without crashing shell.

### E2E/manual

- [ ] Open `basic/main.typ` and see correct rendered content.
- [ ] Open multipage fixture and scroll through all pages.
- [ ] Select/copy PDF text.
- [ ] zoom in/out.

### Exit gate

**Gate 4:** Tykuru performs the complete one-shot product path: `.typ` -> bundled Typst -> PDF -> embedded preview.

---

## 8. Stage 5 — live watch and real-time preview

### Goal

Turn one-shot preview into the defining live experience.

### Backend tasks

- [ ] Replace one-shot `compile` session with persistent `typst watch`.
- [ ] Retain child process handle.
- [ ] Capture compiler output asynchronously.
- [ ] Watch only session `candidate.pdf` for publication events.
- [ ] Implement stable-read retry before committing revision.
- [ ] Commit immutable `revision-N.pdf`.
- [ ] Emit `preview-updated`.
- [ ] Delete stale old revisions safely.
- [ ] Stop watcher when session changes.

### Important distinction

Do **not** build a source dependency graph in Tykuru.

```text
Typst watch = source/dependency recompilation authority
Tykuru output watcher = publication of completed PDF revisions
```

### Automated integration tests

Keep the Typst watch process running and modify fixture copies in a temp directory.

- [ ] initial compile commits revision 1;
- [ ] edit `main.typ` -> revision 2;
- [ ] edit imported `.typ` -> later revision;
- [ ] edit bibliography/image dependency and verify behavior expected from pinned Typst;
- [ ] rapid several saves do not crash or publish corrupt PDF;
- [ ] session close kills watcher;
- [ ] opening another file kills old watcher and stale output cannot replace new preview.

### Performance instrumentation

Record timestamps:

```text
source file change observed (test harness)
Typst output candidate event
preview committed
frontend preview ready
```

The measurement distinguishes Typst compilation latency from Tykuru publication/view latency.

### Manual test

Use VS Code/Zed/Notepad++ with autosave:

1. open same `.typ` in external editor;
2. type/edit;
3. save/autosave;
4. preview refreshes repeatedly without restarting Tykuru.

### Exit gate

**Gate 5:** external-editor changes produce stable automatic preview updates with one persistent Tykuru session.

---

## 9. Stage 6 — error recovery and preview continuity

### Goal

Make live editing pleasant when the source is temporarily invalid.

### Tasks

- [ ] Model `Ready`, `Compiling`, `Error` explicitly.
- [ ] Keep current committed revision when Typst reports an error.
- [ ] Keep a bounded compiler diagnostic buffer.
- [ ] Add compact error indicator/panel.
- [ ] Never replace current preview with a zero-byte/invalid candidate.
- [ ] Add viewer-load failure fallback.

### Test scenario

Starting from valid file:

```text
valid source -> preview A
introduce syntax error -> preview A remains + Error
edit more invalid text -> preview A remains
fix syntax -> preview B replaces A + Ready
```

### Automated tests

- [ ] invalid edit causes no committed revision;
- [ ] old revision path stays available;
- [ ] diagnostic state becomes Error;
- [ ] fixed file creates a newer revision;
- [ ] diagnostic clears/updates on success;
- [ ] malformed candidate never publishes.

### Manual test

Type an incomplete Typst construct slowly and confirm the document does not flash white or jump away.

### Exit gate

**Gate 6:** compile errors are normal editing states, not broken-app states.

---

## 10. Stage 7 — preserve scroll, page, and zoom

### Goal

Make live refresh feel like the same document changing rather than a PDF reopening.

### Tasks

- [ ] Track current scale mode/value.
- [ ] Track current visible page.
- [ ] Track approximate relative vertical position within page.
- [ ] Load new PDF before destroying old PDF.
- [ ] Restore view state after `pagesinit`/equivalent readiness.
- [ ] Clamp page when page count changes.
- [ ] Avoid focus theft on refresh.

### Frontend unit tests

- [ ] fraction calculation;
- [ ] clamping when pages removed;
- [ ] page-width mode restoration;
- [ ] custom zoom restoration;
- [ ] stale async load cannot overwrite a newer revision.

That final race is important:

```text
revision 10 load starts
revision 11 load starts
revision 11 finishes first
revision 10 finishes later
```

Revision 10 must **not** replace revision 11.

### E2E/manual test

- open 10+ page fixture;
- go to page 7;
- zoom;
- edit content near page 1 externally;
- confirm view remains near page 7 after refresh.

### Exit gate

**Gate 7:** normal edits no longer cause disruptive preview resets.

---

## 11. Stage 8 — collapsible CodeMirror editor

### Goal

Add quick editing without turning Tykuru into an IDE.

### Tasks

- [ ] Add CodeMirror 6.
- [ ] Load active source from Rust.
- [ ] Add line numbers/basic editing setup.
- [ ] Add resizable split pane.
- [ ] Add show/hide editor shortcut/button.
- [ ] Implement `Ctrl+S`.
- [ ] Implement autosave debounce around 200–300 ms.
- [ ] Rust owns the actual file write.
- [ ] Show `Saved`, `Saving`, `Unsaved`.
- [ ] Preserve editor cursor when preview refreshes.
- [ ] Persist editor-visible and split-ratio preferences.

### Deliberately defer

Do not block this stage on:

- full Typst syntax highlighting;
- completion;
- LSP;
- source-to-preview synchronization.

A fast correct plain editor is more important than shipping a second compiler/IDE stack.

### Save sequence

```text
CodeMirror transaction
       ↓
local revision + debounce
       ↓
save_source(text, expectedDiskRevision)
       ↓
Rust verifies active session
       ↓
safe disk write
       ↓
Typst watch recompiles
       ↓
preview revision
```

### Tests

#### Frontend

- [ ] typing marks pending;
- [ ] fake timer triggers one save after burst;
- [ ] continued typing resets debounce;
- [ ] Ctrl+S bypasses debounce;
- [ ] collapse does not destroy editor buffer;
- [ ] switching documents discards old editor instance safely.

#### Backend

- [ ] `save_source` can only write active entry file;
- [ ] stale session save rejected;
- [ ] write error returns structured error;
- [ ] Unicode roundtrip preserves content.

#### E2E

- [ ] open fixture;
- [ ] show editor;
- [ ] change visible word;
- [ ] save/autosave;
- [ ] preview updates;
- [ ] hide editor;
- [ ] preview expands.

### Exit gate

**Gate 8:** Tykuru works both as preview-only companion and as a simple split Typst editor/previewer.

---

## 12. Stage 9 — external edit synchronization and conflicts

### Goal

Prevent the optional editor from silently overwriting an external editor.

### Tasks

- [ ] Add entry-file watcher for editor synchronization.
- [ ] Track disk revision/hash.
- [ ] Track hash of Tykuru's most recent successful self-write.
- [ ] Ignore/suppress equivalent self-write notifications.
- [ ] Reload external changes when CodeMirror has no local pending change.
- [ ] Detect external change during local pending save window.
- [ ] Pause autosave and show conflict actions.

### Conflict actions

`Reload external`

- replace editor buffer with disk;
- reset local pending state;
- resume autosave.

`Keep my version`

- explicitly write current buffer over disk after the user chooses it;
- update disk revision;
- resume autosave.

### Tests

- [ ] external save while editor clean reloads editor;
- [ ] Tykuru self-save does not cause pointless replace/cursor jump;
- [ ] external save during pending local change enters Conflict;
- [ ] no file write occurs automatically in Conflict;
- [ ] each resolution action produces expected final disk bytes.

### Manual test

Open same file in Tykuru editor and VS Code. Deliberately edit both during the debounce window and verify there is no silent loss.

### Exit gate

**Gate 9:** internal and external editing can coexist safely.

---

## 13. Stage 10 — Windows Explorer / `.typ` integration

### Goal

Make Tykuru behave like a real Windows document application.

### Tasks

- [ ] Add Tauri `bundle.fileAssociations` for `typ`.
- [ ] Parse initial process command-line args on Windows.
- [ ] Normalize `file://` args if received.
- [ ] Add Tauri single-instance plugin first in plugin registration order.
- [ ] In second-instance callback, parse file args and send to `OpenRequestRouter`.
- [ ] Restore/focus main window on second launch.
- [ ] Reject unrelated CLI flags/URLs.
- [ ] Ensure paths with spaces/Unicode survive argv handling.

### Automated Rust tests

Test parser against representative args:

```text
tykuru.exe C:\paper\main.typ
tykuru.exe "C:\My Paper\main.typ"
tykuru.exe file:///C:/paper/main.typ
tykuru.exe --some-flag C:\paper\main.typ
```

- [ ] valid path extracted;
- [ ] flag skipped;
- [ ] unsupported URL skipped;
- [ ] Unicode preserved.

### Windows integration/manual tests

Before installer:

- [ ] run release binary with path argument;
- [ ] start app with no args then invoke second binary with a different fixture;
- [ ] one application instance remains;
- [ ] first window focuses and loads second document.

After installer:

- [ ] **Open with > Tykuru** works;
- [ ] optional default association + double-click works.

### Exit gate

**Gate 10:** `.typ` is a first-class Windows open target for Tykuru.

---

## 14. Stage 11 — project root, fonts, and representative Typst features

### Goal

Verify the “full Typst features” promise means Tykuru does not unnecessarily break valid compiler features.

### Project root

- [ ] default to source parent;
- [ ] add Set Project Root dialog;
- [ ] persist per-entry override;
- [ ] pass `--root` safely;
- [ ] restart compiler session when root changes.

### Fonts

- [ ] verify normal system-font document;
- [ ] add optional custom font directory setting only if required;
- [ ] pass paths through supported Typst CLI option;
- [ ] test path with spaces.

### Package behavior

Fixtures/tests should cover:

- [ ] no-package fully offline file;
- [ ] package already present in compiler cache/environment;
- [ ] missing package/network failure produces clear compiler error;
- [ ] first online package access is not incorrectly claimed to be offline.

### Typst feature fixture matrix

| Feature | Fixture/test |
|---|---|
| headings/text | basic |
| math | basic |
| table | basic |
| `#include` / `#import` | imports |
| PNG/JPEG/SVG | images |
| bibliography/cite | bibliography |
| Unicode | unicode |
| multiple pages | multipage |
| system fonts | fonts |
| custom font path | fonts-custom |
| package import | packages |
| compilation error | errors |

### Exit gate

**Gate 11:** Tykuru has no known architectural incompatibility with ordinary native Typst CLI documents within the chosen compiler version.

---

## 15. Stage 12 — keyboard, usability, and polish

### Required shortcuts

Recommended:

```text
Ctrl+O       Open .typ
Ctrl+S       Save editor
Ctrl+F       Find in preview/editor according to focus
Ctrl++       Zoom in preview
Ctrl+-       Zoom out preview
Ctrl+0       Reset/page-width zoom
Ctrl+\       Toggle editor (choose final shortcut after conflict check)
```

### Tasks

- [ ] native-feeling title/document naming;
- [ ] recent files (small bounded list);
- [ ] remember window/split state;
- [ ] start screen;
- [ ] clear compiler error presentation;
- [ ] loading indicators that do not reflow preview;
- [ ] accessibility labels for toolbar buttons;
- [ ] keyboard navigation;
- [ ] dark/light behavior according to product design, without overbuilding themes.

### Tests

- [ ] all controls operable by keyboard;
- [ ] no shortcut triggers while wrong component owns it unexpectedly;
- [ ] recent missing path fails gracefully;
- [ ] narrow window does not make app unusable.

### Exit gate

**Gate 12:** the app is minimal, but it feels intentional rather than like a compiler demo.

---

## 16. Stage 13 — automated desktop E2E suite

### Goal

Test the real Tauri application, not only modules.

Use the current Tauri-recommended WebdriverIO service/embedded driver path.

### E2E suite

#### `open-document.e2e`

- launch;
- open fixture;
- filename visible;
- preview becomes Ready.

#### `live-preview.e2e`

- open copied fixture;
- edit file from test process;
- wait for revision number/status change;
- verify app stays alive.

#### `error-recovery.e2e`

- make file invalid;
- verify Error;
- verify preview remains present;
- repair file;
- verify Ready/new revision.

#### `editor.e2e`

- open editor;
- type text;
- autosave;
- verify file bytes;
- verify preview revision advances.

#### `switch-document.e2e`

- open A;
- open B;
- verify B is active;
- verify A's child session is gone / cannot publish stale event.

#### `single-instance.e2e`

If reliable under test runner:

- launch first instance;
- trigger second process with `.typ` arg;
- assert same visible primary application loads new file.

### CI target

Run Windows E2E on `windows-latest` release/debug binary as appropriate.

### Exit gate

**Gate 13:** major user paths are reproducible in CI against a real desktop build.

---

## 17. Stage 14 — Windows packaging

### Goal

Produce the artifact a non-developer actually installs.

### Tasks

- [ ] configure product name `Tykuru`;
- [ ] choose stable application identifier;
- [ ] add `.ico` and required icon sizes;
- [ ] set publisher/description metadata where appropriate;
- [ ] bundle Typst sidecar;
- [ ] bundle PDF.js worker/assets;
- [ ] bundle all frontend assets locally;
- [ ] declare `.typ` file association;
- [ ] build release binary;
- [ ] build NSIS installer (`setup.exe`) as primary v1 artifact;
- [ ] optionally build MSI;
- [ ] ensure WebView2 installer strategy is appropriate for targeted Windows versions;
- [ ] calculate checksum.

Tauri documents that Windows Tauri apps can be distributed as NSIS setup executables and MSI packages, and Windows development uses WebView2.

### Installation test matrix

Use at least one clean Windows 11 VM and, if supported by project policy, Windows 10.

Test:

- [ ] fresh install;
- [ ] normal launch;
- [ ] bundled Typst works with no Typst in `PATH`;
- [ ] Open dialog;
- [ ] `.typ` Open-With;
- [ ] paths with spaces;
- [ ] Unicode path;
- [ ] editor autosave;
- [ ] external live edit;
- [ ] application restart;
- [ ] uninstall.

### Exit gate

**Gate 14:** Tykuru is installable and usable on a clean Windows machine.

---

## 18. Stage 15 — release hardening

### Security review

- [ ] no arbitrary shell execution from frontend;
- [ ] no wildcard filesystem write permissions;
- [ ] preview protocol cannot read arbitrary path;
- [ ] CSP reviewed;
- [ ] external URLs have deliberate handling;
- [ ] cache cleanup cannot escape cache root;
- [ ] sidecar is official pinned binary;
- [ ] dependency audit reviewed.

### Reliability review

- [ ] 100 rapid edit/save cycles;
- [ ] 100 document open/switch cycles;
- [ ] app close during compilation;
- [ ] file deletion while open;
- [ ] root deletion while open;
- [ ] invalid UTF-8/read errors handled;
- [ ] large PDF;
- [ ] very long compiler diagnostic;
- [ ] suspend/resume Windows if practical;
- [ ] no orphan Typst processes after stress test.

### Performance review

Measure separately:

- startup to interactive shell;
- open request to compiler start;
- Typst compile time;
- candidate-to-committed revision overhead;
- committed revision to PDF.js visible swap;
- idle CPU/memory;
- 50/100-page viewer scrolling.

Optimize only observed bottlenecks.

### Exit gate

**Gate 15:** no release-blocking crash, data-loss path, security boundary failure, or major live-preview regression remains.

---

## 19. CI workflow detail

### `verify.yml`

Trigger:

```text
pull_request
push to main
```

Jobs:

#### Frontend

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

#### Rust

```text
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

#### Typst integration

- obtain pinned test sidecar/binary using controlled script;
- verify checksum;
- run fixture compile/watch tests.

### `windows-release.yml`

Trigger:

```text
tag v*
manual workflow dispatch
```

Pipeline:

```text
checkout
 ↓
restore exact dependencies
 ↓
verify Typst sidecar checksum
 ↓
frontend tests
 ↓
Rust tests
 ↓
integration tests
 ↓
Tauri release build
 ↓
WebdriverIO Windows E2E
 ↓
NSIS/MSI packaging
 ↓
installer smoke test where reliable
 ↓
SHA-256
 ↓
release artifacts
```

Do not publish artifacts from a workflow path that skipped tests.

---

## 20. Required fixture design

Fixtures are long-lived compatibility assets. Keep them small and deterministic.

### Basic

```text
fixtures/basic/main.typ
```

Contains representative markup, equation, table.

### Imports

```text
fixtures/imports/main.typ
fixtures/imports/chapter.typ
fixtures/imports/template.typ
```

The test modifies `chapter.typ` while watch runs.

### Images

```text
fixtures/images/main.typ
fixtures/images/figure.svg
fixtures/images/figure.png
```

### Bibliography

```text
fixtures/bibliography/main.typ
fixtures/bibliography/refs.bib
```

### Errors

Keep a valid baseline plus transformations used by test code rather than only a permanently broken file.

### Unicode

Use actual Unicode document content and create temporary Unicode directory names during test execution.

### Multipage

Stable enough to exercise scroll/page restoration.

### Large

Generated or checked-in source that creates many pages without huge binary repository assets.

### Packages

Separate network-sensitive tests from deterministic CI. Mark online package acquisition as an optional/nightly test unless CI guarantees network/cache behavior.

---

## 21. Test commands and developer feedback loop

Provide short top-level scripts so contributors do not need to remember subsystem commands.

Recommended conceptual scripts:

```text
pnpm dev             # frontend/Tauri development
pnpm test            # frontend unit tests
pnpm test:e2e        # desktop E2E
pnpm verify          # frontend checks + delegates Rust checks
pnpm typst:fixtures  # compiler integration fixtures
pnpm build:windows   # Windows release packaging
```

Rust-specific:

```text
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

A failing stage should produce enough information to identify whether the problem belongs to:

- source file IO;
- Typst compiler;
- output revision publication;
- frontend PDF loading;
- editor synchronization;
- Windows launch/file association.

---

## 22. Implementation order summary

Do the work in this exact dependency order unless a concrete blocker justifies changing it:

```text
0  Repository baseline
1  Minimal UI shell
2  Open .typ + session
3  Bundled Typst one-shot compile
4  PDF.js preview
5  typst watch live refresh
6  Error continuity / last good preview
7  View-state preservation
8  Collapsible editor + autosave
9  External-editor conflict safety
10 Windows file association + single instance
11 Root/fonts/full-feature fixture coverage
12 UX polish
13 Desktop automated E2E
14 Windows installer
15 Release hardening
```

This ordering deliberately makes the core value work before editor polish and Windows packaging.

---

## 23. Milestone deliverables

### M1 — Preview prototype

Completed Gates 0–4.

User can open `.typ` and see it rendered once.

### M2 — Real Tykuru core

Completed Gates 5–7.

External editor saves live-update a stable preview with error recovery and view preservation.

### M3 — Minimal editor

Completed Gates 8–9.

Collapsible editor safely edits the same file.

### M4 — Windows-native application

Completed Gates 10–14.

Explorer/Open-With and installer work.

### M5 — v1 release candidate

Completed Gate 15 and all automated release checks.

---

## 24. Release acceptance checklist

### Functional

- [ ] Fresh launch works.
- [ ] Open `.typ` dialog works.
- [ ] Drag/drop `.typ` works.
- [ ] Valid Typst preview renders.
- [ ] Math renders.
- [ ] Images render.
- [ ] imports/includes render.
- [ ] bibliography renders.
- [ ] system fonts work.
- [ ] project root override works.
- [ ] external save live-updates.
- [ ] invalid source keeps last preview.
- [ ] fixing invalid source recovers automatically.
- [ ] zoom works.
- [ ] text selection works.
- [ ] find works.
- [ ] scroll position survives normal updates.
- [ ] editor expands/collapses.
- [ ] editor autosaves.
- [ ] Ctrl+S works.
- [ ] external/internal conflict is safe.

### Windows integration

- [ ] release `.exe` starts directly.
- [ ] installer succeeds on clean Windows.
- [ ] app works without Typst installed globally.
- [ ] `.typ` appears as supported file type/Open-With handler.
- [ ] `.typ` argument to `tykuru.exe` opens document.
- [ ] double-click associated `.typ` opens Tykuru.
- [ ] second file launch reuses/focuses current instance.
- [ ] Unicode path works.
- [ ] spaces in path work.
- [ ] uninstall works.

### Reliability

- [ ] no orphan Typst child after normal close.
- [ ] no orphan child after document switch.
- [ ] no stale old-session preview can replace new document.
- [ ] no generated PDF appears in project directory.
- [ ] corrupted/partial candidate is not published.
- [ ] file deletion does not crash.
- [ ] 100 rapid saves do not crash.

### Engineering

- [ ] typecheck passes.
- [ ] frontend tests pass.
- [ ] Rust unit tests pass.
- [ ] Clippy passes with warnings denied.
- [ ] fixture integration tests pass.
- [ ] Windows E2E passes.
- [ ] release build is reproducible enough for project policy.
- [ ] bundled Typst version recorded.
- [ ] third-party licenses reviewed/included as required.

---

## 25. Risks to watch during implementation

### Risk: `typst watch` output events race PDF.js

Mitigation: candidate PDF -> stable read -> immutable committed revision -> revision-specific URL.

### Risk: compiler diagnostics format changes

Mitigation: v1 treats stderr primarily as human-readable text instead of deeply parsing unstable formatting.

### Risk: editor creates a divergent unsaved model

Mitigation: disk is canonical; short autosave; explicit conflict state; no hidden project format.

### Risk: old async preview load wins after newer revision

Mitigation: revision token check before every viewer swap.

### Risk: second Windows launch creates competing watchers

Mitigation: single-instance plugin + central `OpenRequestRouter` + one active session.

### Risk: Tauri frontend receives too much filesystem authority

Mitigation: narrow Rust commands and ID-based preview protocol.

### Risk: dependency growth undermines “minimal” goal

Mitigation: no frontend framework required; add packages only for PDF viewer/editor/native functionality actually used.

### Risk: Typst package network behavior makes “fully offline” claim false

Mitigation: market Tykuru as local-first/offline for local/cached dependencies; disclose that first retrieval of an uncached remote Typst package may require network according to Typst behavior.

---

## 26. Decisions that should not be revisited before v1 without evidence

To avoid architecture churn, consider these frozen until profiling/tests prove a problem:

- Tauri 2 instead of Electron.
- Rust backend.
- Official Typst CLI sidecar instead of reimplementing/embedding compiler internals.
- `typst watch` instead of Tykuru-owned dependency compilation logic.
- PDF output + PDF.js.
- one active document/window.
- TypeScript/HTML/CSS without a large UI framework.
- CodeMirror only for optional editing.
- disk file as canonical source.
- Windows-first release.
- NSIS as primary initial installer.

A future architecture decision record (ADR) should be required to replace any of these after implementation starts.

---

## 27. First implementation sprint — concrete checklist

This is the shortest path from zero to visible value.

### Step A

- [ ] scaffold Tauri;
- [ ] remove demo UI;
- [ ] create Start screen with Open button;
- [ ] commit.

### Step B

- [ ] native `.typ` picker;
- [ ] backend session path validation;
- [ ] show selected filename;
- [ ] tests;
- [ ] commit.

### Step C

- [ ] add pinned Typst sidecar;
- [ ] one-shot compile into cache;
- [ ] show Ready/Error text;
- [ ] fixture integration test;
- [ ] commit.

### Step D

- [ ] add PDF.js;
- [ ] custom preview protocol;
- [ ] render first PDF;
- [ ] E2E/manual verify;
- [ ] commit.

Only after Step D should live watch/editor work begin. This protects the project from spending effort on editor details before the core compiler-to-preview pipeline is known to work.

---

## 28. Technical references for implementation

- Tauri configuration / file associations / external binaries: https://v2.tauri.app/reference/config/
- Tauri sidecar binaries: https://v2.tauri.app/develop/sidecar/
- Tauri single instance: https://v2.tauri.app/plugin/single-instance/
- Tauri Windows installer: https://v2.tauri.app/distribute/windows-installer/
- Tauri Windows prerequisites / WebView2: https://v2.tauri.app/start/prerequisites/
- Tauri file-association example: https://github.com/tauri-apps/tauri/tree/dev/examples/file-associations
- Tauri WebDriver: https://v2.tauri.app/develop/tests/webdriver/
- Typst CLI/repository: https://github.com/typst/typst
- Typst compiler architecture: https://github.com/typst/typst/blob/main/docs/dev/architecture.md
- Typst PDF reference: https://typst.app/docs/reference/pdf/
- PDF.js examples: https://github.com/mozilla/pdf.js/tree/master/examples/components
- CodeMirror: https://codemirror.net/

