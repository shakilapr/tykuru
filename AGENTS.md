# AGENTS.md — Tykuru

Read `AGENTS.md`, `architecture.md`, then the current stage in `work-plan.md`.
Priority: user instruction > `AGENTS.md` > `architecture.md` > `work-plan.md`.

## Architecture

Approved v1 stack: Tauri 2 + Rust; React + TypeScript + Vite; Tailwind CSS + shadcn/ui + Lucide; CodeMirror 6; bundled official Typst CLI with `typst watch`; PDF + PDF.js; Windows-first.

Rules:
- Do not replace the stack or add another compiler/UI framework without explicit approval.
- `.typ` on disk is the source of truth; Typst CLI is the only compiler.
- Never reimplement Typst parsing, layout, imports, packages, fonts, or rendering.
- v1 has one active session and at most one Typst watcher.
- Reject stale `SessionId` / preview-revision events.
- Keep the last valid PDF visible on compile errors.
- PDF.js may load only committed immutable preview revisions, never the actively written candidate PDF.
- Generated PDFs stay inside Tykuru cache.
- Shutdown must leave no orphan `typst` process.

## Coding

Frontend:
- TypeScript strict mode; avoid `any`; handle async races explicitly.
- Reuse shadcn/ui; use Tailwind semantic tokens and Lucide; avoid duplicate controls and unnecessary hard-coded colors.
- Keep filesystem, process, cache, path, settings, Windows-open, and other native logic out of React.

Rust/backend:
- Backend owns filesystem, process, cache, session, paths, settings, and Windows-open logic.
- Use `Path` / `PathBuf`; avoid `unwrap()` / `expect()` for realistic failures.
- Never run Typst through shell strings, PowerShell, `cmd.exe`, or `sh`; pass arguments separately.
- Expose narrow typed Tauri commands only; never generic filesystem/process access.
- Cache deletion must be root-bounded to Tykuru's cache.

Editor/data safety:
- CodeMirror may hold temporary unsaved state only; source writes go through Rust.
- Never silently overwrite external edits; detect conflicts before saving.

Scope:
- Keep diffs focused; no unrelated refactors, speculative infrastructure, or direct edits to generated/vendor output.

## Windows / file opening

All open methods must use the same backend open-request path: File > Open, drag/drop, `tykuru.exe file.typ`, Open With, `.typ` association, and second-instance forwarding.

- Support spaces and Unicode paths.
- Do not force Tykuru as the default `.typ` application.

## Testing

Tests are part of implementation.

For bugs: reproduce -> add a regression test when practical -> fix -> targeted test -> wider verification.

Canonical checks:
- `pnpm verify`
- compiler/preview changes: `pnpm typst:fixtures`
- desktop/E2E changes when supported: `pnpm test:e2e`
- Windows integration/release changes: `pnpm build:windows`

Rules:
- Use real Typst fixtures for Typst compatibility claims.
- Never claim a test passed unless it actually ran.
- If Windows verification was not possible, state `NOT TESTED ON WINDOWS`.

## Documentation

Keep docs accurate, concise, and non-duplicative.

Update:
- `architecture.md` for approved architecture, boundary, dependency, data-flow, or platform changes.
- `work-plan.md` for stage order, deliverables, test gates, or acceptance-criteria changes.
- `README.md` for user-facing setup, usage, shortcuts, build steps, or supported behavior changes.

Do not:
- document planned features as completed;
- duplicate large sections between docs;
- rewrite unrelated docs during a code change;
- change architecture docs just to justify an implementation shortcut.

Comments should explain non-obvious constraints/reasoning, not restate code.

## Commits

Use Conventional Commits: `type(scope): imperative message`.

Examples: `feat(preview): preserve viewport on refresh`, `fix(session): reject stale compiler events`, `docs(architecture): clarify preview pipeline`.

Before committing:
- `git status`
- `git diff --check`
- `git diff`
- run relevant tests

Rules:
- Commits must be atomic and keep the repo buildable.
- Do not mix unrelated refactors, dependencies, and features.
- Never commit generated build output, caches, secrets, signing keys, temporary PDFs, `node_modules/`, `dist/`, or `src-tauri/target/`.
- Commit only when authorized by the user/workflow; report the commit hash afterward.

## Definition of done

Before reporting completion:
- implementation is complete;
- relevant tests/checks pass;
- architecture invariants remain intact;
- no unrelated changes are included;
- docs are updated when behavior/architecture changed;
- untested platforms/checks are stated explicitly.

Primary rule: keep Tykuru a thin, reliable layer around `Typst -> PDF -> PDF.js`; prefer simple delegation over reimplementation.
