# Windows Release

Release pipeline and clean-machine acceptance for Tykuru on Windows.

## Pipeline

```text
tag / manual release
        ↓
verify exact dependencies
        ↓
verify official Typst sidecar + checksum
        ↓
all unit tests
        ↓
Typst integration fixtures
        ↓
Tauri Windows build
        ↓
Windows E2E
        ↓
NSIS installer
        ↓
installer smoke / clean-machine checks
        ↓
SHA-256 + release artifacts
```

(See `architecture.md §28` for the CI shape.)

## Clean-machine matrix

At minimum **Windows 11**; **Windows 10** if still a supported target. A clean VM is required because a dev machine can hide missing runtime dependencies or installer defects.

Checks on a clean VM (no global Typst installed):

- fresh install;
- normal launch;
- window bounds restored from the previous session (position/size/maximized);
- Open dialog + preview;
- external live edit refreshes;
- built-in editor autosave;
- Set Project Root (override persists across relaunch);
- Open With / associated double-click;
- second-instance file open;
- path with spaces; Unicode path;
- restart; uninstall;
- **no orphan `typst.exe` process** after exit/upgrade/reinstall.

The `windows-e2e` CI job (`.github/workflows/verify.yml`) runs `pnpm build:windows` and `pnpm test:e2e` on a `windows-latest` runner as the automated gate for the desktop-build path.

## No-orphan-process requirement

The bundled Typst watcher is a child of the Rust backend. `ShutdownCoordinator` must terminate and await exit of the child on app shutdown, and the installer/updater path must be tested so an upgrade/reinstall leaves no `typst.exe` behind. This is a release-gating acceptance test, not trusted to framework abstraction.

## Artifacts

- NSIS installer.
- SHA-256 checksum file.
- Release notes updated in root `CHANGELOG.md`.
