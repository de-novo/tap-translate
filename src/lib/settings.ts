import { browser } from "wxt/browser";
import { defaultTargetLang, resolveInputTargetLang, resolveTargetLang } from "./i18n";
import type { LanguageCode } from "./language";
import { isContextInvalidated, runtimeAlive } from "./runtime";
import { parseSiteTranslate, type SiteTranslate } from "./site-translate";

export type Position = {
  right: number;
  bottom: number;
};

export type Settings = {
  alwaysTranslate: string[];
  hiddenHosts: string[];
  imageTranslate: boolean;
  inputTargetLang: LanguageCode;
  inputTranslate: boolean;
  position: Position;
  showFab: boolean;
  siteTranslate: SiteTranslate;
  targetLang: LanguageCode;
};

export const DEFAULT_SETTINGS: Settings = {
  alwaysTranslate: [],
  hiddenHosts: [],
  imageTranslate: false,
  inputTargetLang: "en",
  inputTranslate: false,
  position: { right: 20, bottom: 24 },
  showFab: true,
  siteTranslate: {},
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
    imageTranslate: stored.imageTranslate === true,
    inputTargetLang: resolveInputTargetLang(stored),
    inputTranslate: stored.inputTranslate === true,
    position: isPosition(stored.position) ? stored.position : DEFAULT_SETTINGS.position,
    showFab: stored.showFab !== false,
    siteTranslate: parseSiteTranslate(stored.siteTranslate),
    targetLang: resolveTargetLang(stored)
  };
}

export async function loadSettings(): Promise<Settings> {
  const fallback = {
    ...DEFAULT_SETTINGS,
    targetLang: defaultTargetLang()
  };
  if (!runtimeAlive()) return fallback;
  try {
    const stored = (await browser.storage.sync.get(fallback)) as Record<string, unknown>;
    return normalizeSettings(stored);
  } catch (error) {
    if (isContextInvalidated(error)) return fallback;
    throw error;
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  if (!runtimeAlive()) return;
  try {
    await browser.storage.sync.set(patch);
  } catch (error) {
    if (isContextInvalidated(error)) return;
    throw error;
  }
}
