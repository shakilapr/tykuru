# Tykuru Documentation

This folder holds **how-to** guides for working on Tykuru. The authoritative specification lives in the repository root:

- [`architecture.md`](../architecture.md) — approved stack, boundaries, data flow, invariants.
- [`work-plan.md`](../work-plan.md) — staged, ordered implementation plan and acceptance criteria.

Read those first; this folder explains *how to do the work*, not *what the system is*.

## Guides

| Guide | Purpose |
| --- | --- |
| [development.md](./development.md) | Toolchain setup, repo layout, coding standards, running the app in dev. |
| [building.md](./building.md) | Production builds, Windows installer, WebView2, sidecar bundling. |
| [testing.md](./testing.md) | Canonical test commands, test layout, fixtures, reporting rules. |
| [windows-release.md](./windows-release.md) | Release pipeline, clean-machine matrix, no-orphan-process checks. |
| [contributing.md](./contributing.md) | Commit style, branch model, PR gates, doc-update rules. |

## Conventions

- Keep docs accurate and non-duplicative; never document planned features as completed.
- Update `architecture.md`/`work-plan.md` when behavior or boundaries change; update these guides when the *how* changes.
- Update `CHANGELOG.md` at the root when a user-facing or architecture-level change lands.
