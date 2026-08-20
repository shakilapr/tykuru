# Contributing

How to contribute changes to Tykuru.

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): imperative message
```

Common types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `build`, `ci`, `perf`. Examples:

```text
feat(preview): render committed pdf revisions
fix(session): reject stale compiler events
docs(architecture): clarify preview pipeline
```

## Commits are atomic

- One logical change per commit (one file, one function, one test group, one config entry).
- Keep the repository buildable at every commit.
- Do not mix unrelated refactors, dependency bumps, and features.
- Never commit generated output, caches, secrets, or temporary PDFs (`architecture.md §27.5`).

## Branch model

- `main` is the stable line.
- Use short-lived `feat/*`, `fix/*`, `chore/*`, `test/*` branches as needed.
- No long-lived environment branches.

## Before committing

```text
git status
git diff --check
git diff
```

Then run the relevant gate: `pnpm verify`, `pnpm typst:fixtures`, `pnpm test:e2e`, or `pnpm build:windows`. If a check can't run here, note `NOT TESTED ON WINDOWS`.

## Documentation rules

Update docs when behavior or boundaries change (`AGENTS.md` Documentation):

- `architecture.md` — stack, boundary, data-flow, platform changes.
- `work-plan.md` — stage order, deliverables, test gates, acceptance criteria.
- `README.md` — setup, usage, shortcuts, build, supported behavior.
- `docs/` — how-to changes.
- `CHANGELOG.md` — user-facing / architecture-level changes.

Do not document planned features as completed, and do not duplicate large sections between docs.
