# Testing

Canonical verification commands and test layout for Tykuru.

## Commands

| Command | Scope |
| --- | --- |
| `pnpm verify` | Frontend typecheck + lint + tests + build + `cargo fmt --check` + `cargo clippy -- -D warnings` + `cargo test`. |
| `pnpm typst:fixtures` | Rust integration tests that drive the **real** bundled Typst sidecar against `fixtures/`. |
| `pnpm test:e2e` | Desktop E2E (WebdriverIO) against a real built app. |
| `pnpm build:windows` | Windows integration/release build (also a verification gate). |

## Layout

- `tests/frontend/` — Vitest + React Testing Library. Pure logic (`revision-guard`, `view-state`, `source-sync`, autosave) is tested without a DOM.
- `tests/integration/` — Rust tests that compile real Typst fixtures with the sidecar and assert PDF output / revision behavior.
- `tests/e2e/` — Desktop flows (open, live preview, dependency watch, error recovery, editor, switch, shutdown, single-instance).

## Fixtures

`fixtures/` holds real Typst sources committed to the repo: `basic`, `imports`, `images`, `bibliography`, `unicode`, `multipage`, `errors`, `fonts`, `large`. Generated PDFs are git-ignored; only sources are committed.

Distinguish clearly:

```text
fully local document
cached Typst package
uncached package requiring network   # separate/optional, never flaky CI
```

## Reporting rules

- Never claim a test passed unless it actually ran.
- If a gate cannot run in the current environment (e.g. Windows-only build/E2E), state **`NOT TESTED ON WINDOWS`** explicitly.
- Keep regression tests for bugs: reproduce → add test → fix → confirm.
