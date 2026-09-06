import { browser } from "wxt/browser";
import {
  isSupportedLang,
  LANGUAGE_CODES,
  normalizeLang,
  PREFERRED_LANGS,
  type LanguageCode
} from "./language";
import { runtimeAlive } from "./runtime";

export type MessageKey =
  | "extName"
  | "extDescription"
  | "actionTitle"
  | "commandToggle"
  | "translatePage"
  | "translateDialog"
  | "moveButton"
  | "moreOptions"
  | "close"
  | "originalLanguage"
  | "alwaysTranslate"
  | "thisLanguage"
  | "mixedLanguages"
  | "autoDetect"
  | "alwaysTranslateForeign"
  | "targetLanguage"
  | "hideOnThisSite"
  | "alreadyTargetLanguage"
  | "pairUnsupported"
  | "openGoogleTranslate"
  | "preparing"
  | "downloadingModel"
  | "translating"
  | "apiUnsupported"
  | "translateFailed"
  | "reloadPage"
  | "popupTagline"
  | "showFloatingButton"
  | "restoreOnThisSite"
  | "shortcutHint"
  | "inputTranslate"
  | "inputTargetLanguage"
  | "copyTranslation"
  | "copied"
  | "translatingImages"
  | "imageTranslate"
  | "imageCaption"
  | "translateOn"
  | "translateOff";

export function t(key: MessageKey, substitutions?: string | string[]): string {
  try {
    if (!runtimeAlive()) return key;
    return browser.i18n.getMessage(key, substitutions) || key;
  } catch {
    return key;
  }
}

export function uiLanguage(): string {
  try {
    if (!runtimeAlive()) return "en";
    return browser.i18n.getUILanguage() || "en";
  } catch {
    return "en";
  }
}

export function isRtl(): boolean {
  return /^(ar|he|fa|ur)\b/i.test(uiLanguage());
}

let displayNamesCache: Intl.DisplayNames | undefined;

export function displayNames(): Intl.DisplayNames {
  if (displayNamesCache) return displayNamesCache;
  try {
    displayNamesCache = new Intl.DisplayNames([uiLanguage()], { type: "language" });
  } catch {
    displayNamesCache = new Intl.DisplayNames(["en"], { type: "language" });
  }
  return displayNamesCache;
}

export function languageName(code: string | undefined | null): string {
  if (!code) return t("originalLanguage");
  try {
    return displayNames().of(code) || code;
  } catch {
    return code;
  }
}

export type LanguageOption = {
  code: LanguageCode;
  name: string;
};

export function sortedLanguages(): LanguageOption[] {
  const locale = uiLanguage();
  const preferred = new Map(PREFERRED_LANGS.map((code, index) => [code, index]));
  return LANGUAGE_CODES.map((code) => ({
    code,
    name: languageName(code)
  })).sort((a, b) => {
    const aPref = preferred.get(a.code) ?? 1000;
    const bPref = preferred.get(b.code) ?? 1000;
    if (aPref !== bPref) return aPref - bPref;
    return a.name.localeCompare(b.name, locale);
  });
}

export function defaultTargetLang(): LanguageCode {
  const ui = normalizeLang(uiLanguage());
  return isSupportedLang(ui) ? ui : "en";
}

export function resolveTargetLang(stored: { targetLang?: unknown }): LanguageCode {
  if (typeof stored.targetLang === "string" && isSupportedLang(stored.targetLang)) {
    return stored.targetLang;
  }
  return defaultTargetLang();
}

export function resolveInputTargetLang(stored: { inputTargetLang?: unknown }): LanguageCode {
  if (typeof stored.inputTargetLang === "string" && isSupportedLang(stored.inputTargetLang)) {
    return stored.inputTargetLang;
  }
  return "en";
}

export function applyDocumentLocale(root: HTMLElement): void {
  root.lang = uiLanguage();
  root.dir = isRtl() ? "rtl" : "ltr";
}
