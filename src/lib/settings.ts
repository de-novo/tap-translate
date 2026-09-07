import { browser } from "wxt/browser";
import { defaultTargetLang, resolveInputTargetLang, resolveTargetLang } from "./i18n";
import type { LanguageCode } from "./language";
import { isContextInvalidated, runtimeAlive } from "./runtime";
import { dropGlobalAlways, parseSiteTranslate, type SiteTranslate } from "./site-translate";

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
      ? dropGlobalAlways(stored.alwaysTranslate.filter((item): item is string => typeof item === "string"))
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
    const { siteTranslate: _ignored, ...syncFallback } = fallback;
    const [syncStored, localStored] = await Promise.all([
      browser.storage.sync.get(syncFallback) as Promise<Record<string, unknown>>,
      browser.storage.local.get({ siteTranslate: {} }) as Promise<Record<string, unknown>>
    ]);
    const stored: Record<string, unknown> = {
      ...syncStored,
      siteTranslate: localStored.siteTranslate ?? syncStored.siteTranslate
    };
    const settings = normalizeSettings(stored);
    if (Array.isArray(syncStored.alwaysTranslate) && syncStored.alwaysTranslate.includes("*")) {
      await browser.storage.sync.set({ alwaysTranslate: settings.alwaysTranslate });
    }
    return settings;
  } catch (error) {
    if (isContextInvalidated(error)) return fallback;
    throw error;
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  if (!runtimeAlive()) return;
  try {
    const { siteTranslate, ...syncPatch } = patch;
    const writes: Promise<void>[] = [];
    if (siteTranslate !== undefined) {
      writes.push(browser.storage.local.set({ siteTranslate }));
    }
    if (Object.keys(syncPatch).length) {
      writes.push(browser.storage.sync.set(syncPatch));
    }
    await Promise.all(writes);
  } catch (error) {
    if (isContextInvalidated(error)) return;
    throw error;
  }
}
