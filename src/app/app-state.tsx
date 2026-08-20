import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

// Document UI state machine (architecture §7.5).
export type DocumentUiState =
  | { kind: "empty" }
  | { kind: "opening"; name?: string }
  | { kind: "open"; sessionId: string; filename: string }
  | { kind: "error"; message: string };

export interface AppState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
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
}

const SPLIT_MIN = 0.2;
const SPLIT_MAX = 0.8;

export function clampSplitRatio(ratio: number): number {
  if (Number.isNaN(ratio)) return 0.5;
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, ratio));
}

const STORAGE_KEY = "tykuru.theme";

function resolveDark(pref: ThemePreference): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

const ThemeContext = createContext<AppState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const [editorVisible, setEditorVisibleState] = useState(false);
  const [splitRatio, setSplitRatioState] = useState(0.5);
  const [documentState, setDocumentState] = useState<DocumentUiState>({ kind: "empty" });

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

  const setTheme = useCallback((next: ThemePreference) => setThemeState(next), []);
  const toggleEditor = useCallback(() => setEditorVisibleState((v) => !v), []);
  const setEditorVisible = useCallback((v: boolean) => setEditorVisibleState(v), []);
  const setSplitRatio = useCallback((r: number) => setSplitRatioState(clampSplitRatio(r)), []);
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
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppState must be used within ThemeProvider");
  return ctx;
}
