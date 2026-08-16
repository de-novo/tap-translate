import { browser } from "wxt/browser";
import { defaultTargetLang, resolveTargetLang } from "./i18n";
import type { LanguageCode } from "./language";

export type Position = {
  right: number;
  bottom: number;
};

export type Settings = {
  alwaysTranslate: string[];
  hiddenHosts: string[];
  position: Position;
  showFab: boolean;
  targetLang: LanguageCode;
};

export const DEFAULT_SETTINGS: Settings = {
  alwaysTranslate: [],
  hiddenHosts: [],
  position: { right: 20, bottom: 24 },
  showFab: true,
  targetLang: "en"
};

function isPosition(value: unknown): value is Position {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Position).right === "number" &&
    typeof (value as Position).bottom === "number"
  );
}

function normalizeSettings(stored: Record<string, unknown>): Settings {
  return {
    alwaysTranslate: Array.isArray(stored.alwaysTranslate)
      ? stored.alwaysTranslate.filter((item): item is string => typeof item === "string")
      : [],
    hiddenHosts: Array.isArray(stored.hiddenHosts)
      ? stored.hiddenHosts.filter((item): item is string => typeof item === "string")
      : [],
    position: isPosition(stored.position) ? stored.position : DEFAULT_SETTINGS.position,
    showFab: stored.showFab !== false,
    targetLang: resolveTargetLang(stored)
  };
}

export async function loadSettings(): Promise<Settings> {
  const fallback = {
    ...DEFAULT_SETTINGS,
    targetLang: defaultTargetLang()
  };
  const stored = (await browser.storage.sync.get(fallback)) as Record<string, unknown>;
  return normalizeSettings(stored);
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await browser.storage.sync.set(patch);
}
