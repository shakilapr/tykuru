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
- Settings model with atomic persistence (typed `SettingsV1` + atomic store), persisted theme/editor/split/project-root override/recent files, and keyboard shortcuts.
- Project-root configuration via **Set Project Root…** (native folder picker, persisted override, watcher restart, last-good preserved).
- Real-Typst fixture matrix and integration harness (incl. Unicode temp-path check).
- Desktop E2E suite (Playwright driving the real Tauri WebView), CI pipeline (`verify.yml` with frontend/rust/typst-fixture gates), NSIS installer wiring with WebView2 bootstrapper and SHA-256 artifact checksums, and release hardening.
