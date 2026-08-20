// Subscribes to `compile-state-changed` and exposes the current compile state.
// Pure listener; no React rendering logic beyond the hook.

import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { COMPILE_STATE_CHANGED } from "@/bridge/events";
import type { CompileState } from "@/bridge/types";

const INITIAL: CompileState = { status: "idle" };

export function useCompileState(): CompileState {
  const [state, setState] = useState<CompileState>(INITIAL);
  useEffect(() => {
    const unlisten = listen<[string, RawState]>(COMPILE_STATE_CHANGED, (e) => {
      const [, raw] = e.payload;
      setState(toCompileState(raw));
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);
  return state;
}

interface RawState {
  Idle?: null;
  Compiling?: null;
  Ready?: { revision: number };
  Error?: { message: string; last_good_revision: number | null };
}

function toCompileState(raw: RawState): CompileState {
  if (raw.Ready) return { status: "ready", revision: raw.Ready.revision };
  if (raw.Error)
    return {
      status: "error",
      message: raw.Error.message,
      lastGoodRevision: raw.Error.last_good_revision,
    };
  if (raw.Compiling) return { status: "compiling" };
  return { status: "idle" };
}
