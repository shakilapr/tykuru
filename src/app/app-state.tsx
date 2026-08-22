import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSettings, updateSettings } from "@/bridge/settings";
import type { Theme } from "@/bridge/types";

// Document UI state machine (architecture §7.5).
export type DocumentUiState =
  | { kind: "empty" }
  | { kind: "opening"; name?: string }
  | { kind: "open"; sessionId: string; filename: string }
  | { kind: "error"; message: string };

export interface AppState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  editorVisible: boolean;
  toggleEditor: () => void;
  setEditorVisible: (visible: boolean) => void;
  splitRatio: number;
  setSplitRatio: (ratio: number) => void;
  documentState: DocumentUiState;
  openDocumentState: (sessionId: string, filename: string) => void;
  openingDocumentState: (name?: string) => void;
  errorDocumentState: (message: string) => void;
  resetDocumentState: () => void;
  settingsLoaded: boolean;
}

const SPLIT_MIN = 0.2;
const SPLIT_MAX = 0.8;

export function clampSplitRatio(ratio: number): number {
  if (Number.isNaN(ratio)) return 0.5;
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, ratio));
}

const STORAGE_KEY = "tykuru.theme";

function resolveDark(pref: Theme): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function isValidTheme(v: unknown): v is Theme {
  return v === "system" || v === "light" || v === "dark";
}

const ThemeContext = createContext<AppState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored && isValidTheme(stored) ? stored : "system";
  });
  const [editorVisible, setEditorVisibleState] = useState(false);
  const [splitRatio, setSplitRatioState] = useState(0.5);
  const [documentState, setDocumentState] = useState<DocumentUiState>({ kind: "empty" });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load persisted settings from the backend (architecture §18). In a plain
  // browser (Vite dev, mocks) `invoke` is unavailable; fall back to defaults /
  // localStorage so the UI still functions.
  useEffect(() => {
    let cancelled = false;
    void getSettings()
      .then((settings) => {
        if (cancelled) return;
        setThemeState(settings.theme);
        setEditorVisibleState(settings.editor_visible);
        setSplitRatioState(clampSplitRatio(settings.split_ratio));
      })
      .catch(() => {
        if (cancelled) return;
        // Browser dev / mock environment: keep the localStorage fallback.
      })
      .finally(() => {
        if (!cancelled) setSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    const dark = resolveDark(theme);
    document.documentElement.classList.toggle("dark", dark);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      document.documentElement.classList.toggle("dark", mq.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Persist theme/editor/split changes to the backend. Best-effort: the in-app
  // state is authoritative for the session; persistence failures degrade to
  // localStorage. Guarded so the initial settings load doesn't write back.
  const persistPatch = useCallback(
    (patch: { theme?: Theme; editor_visible?: boolean; split_ratio?: number }) => {
      void updateSettings(patch).catch(() => {
        // Browser dev / mock environment: ignore.
      });
    },
    [],
  );

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      persistPatch({ theme: next });
    },
    [persistPatch],
  );
  const toggleEditor = useCallback(() => {
    setEditorVisibleState((v) => {
      persistPatch({ editor_visible: !v });
      return !v;
    });
  }, [persistPatch]);
  const setEditorVisible = useCallback(
    (v: boolean) => {
      setEditorVisibleState(v);
      persistPatch({ editor_visible: v });
    },
    [persistPatch],
  );
  const setSplitRatio = useCallback(
    (r: number) => {
      const clamped = clampSplitRatio(r);
      setSplitRatioState(clamped);
      persistPatch({ split_ratio: clamped });
    },
    [persistPatch],
  );
  const openDocumentState = useCallback((sessionId: string, filename: string) => {
    setDocumentState({ kind: "open", sessionId, filename });
  }, []);
  const openingDocumentState = useCallback((name?: string) => setDocumentState({ kind: "opening", name }), []);
  const errorDocumentState = useCallback((message: string) => setDocumentState({ kind: "error", message }), []);
  const resetDocumentState = useCallback(() => setDocumentState({ kind: "empty" }), []);

  const value = useMemo<AppState>(
    () => ({
      theme,
      setTheme,
      editorVisible,
      toggleEditor,
      setEditorVisible,
      splitRatio,
      setSplitRatio,
      documentState,
      openDocumentState,
      openingDocumentState,
      errorDocumentState,
      resetDocumentState,
      settingsLoaded,
    }),
    [
      theme,
      setTheme,
      editorVisible,
      toggleEditor,
      setEditorVisible,
      splitRatio,
      setSplitRatio,
      documentState,
      openDocumentState,
      openingDocumentState,
      errorDocumentState,
      resetDocumentState,
      settingsLoaded,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppState must be used within ThemeProvider");
  return ctx;
}
