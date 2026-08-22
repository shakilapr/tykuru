// Typed wrappers around Tauri `invoke` for settings commands.
// The frontend never writes the settings file directly — only these narrow,
// typed commands (architecture §18, §20).

import { invoke } from "@tauri-apps/api/core";
import type { SettingsV1, SettingsPatch } from "./types";

export async function getSettings(): Promise<SettingsV1> {
  return invoke<SettingsV1>("get_settings");
}

export async function updateSettings(patch: SettingsPatch): Promise<SettingsV1> {
  return invoke<SettingsV1>("update_settings", { patch });
}
