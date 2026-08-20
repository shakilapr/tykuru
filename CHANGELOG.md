# Changelog

All notable changes to Tykuru are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project will adhere to [Semantic Versioning](https://semver.org/) once v1 ships.

## [Unreleased]

### Added
- Project foundation: `.gitignore`, GPLv3 `LICENSE`, `README.md`, and `CHANGELOG.md`.
- Architecture and staged work plan (`architecture.md`, `work-plan.md`).
- `docs/` how-to guides: development, building, testing, Windows release, contributing.
- Application skeleton: Tauri 2 + React + TypeScript + Vite, strict TypeScript, Tailwind, shadcn/ui (Base UI), Lucide, Vitest/RTL, `config/versions.toml`, and scripts.
- Backend verticals: session/document opening, compiler subsystem (bundled Typst sidecar), immutable preview revision store with binary IPC delivery, PDF.js viewer, live `typst watch`, error/last-good handling, viewport preservation, CodeMirror editor with `SourceWriter`, external-edit conflict safety.
- Windows integration: command-line open, single-instance, `.typ` file association.
- Settings model with atomic persistence, project root support, keyboard shortcuts.
- Real-Typst fixture matrix and integration harness.
- Desktop E2E suite, CI pipeline, NSIS installer with Evergreen WebView2, and release hardening.
