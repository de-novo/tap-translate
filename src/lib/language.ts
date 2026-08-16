export const LANGUAGE_CODES = [
  "ar",
  "bg",
  "bn",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "fi",
  "fr",
  "he",
  "hi",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "kn",
  "ko",
  "lt",
  "mr",
  "nl",
  "no",
  "pl",
  "pt",
  "ro",
  "ru",
  "sk",
  "sl",
  "sv",
  "ta",
  "te",
  "th",
  "tr",
  "uk",
  "vi",
  "zh",
  "zh-Hant"
] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export const PREFERRED_LANGS: readonly LanguageCode[] = [
  "ko",
  "en",
  "ja",
  "zh",
  "zh-Hant",
  "es",
  "fr",
  "de",
  "pt",
  "vi",
  "id",
  "th",
  "ar",
  "ru"
];

const LANGUAGE_SET = new Set<string>(LANGUAGE_CODES);

export const isSupportedLang = (code: string | undefined | null): code is LanguageCode =>
  Boolean(code && LANGUAGE_SET.has(code));

export const normalizeLang = (code: string | undefined | null): string => {
  if (!code || code === "und" || code === "unknown") return "";
  const lower = String(code).trim().replace("_", "-").toLowerCase();
  if (
    lower.startsWith("zh-hant") ||
    lower.startsWith("zh-tw") ||
    lower.startsWith("zh-hk") ||
    lower.startsWith("zh-mo")
  ) {
    return "zh-Hant";
  }
  if (lower.startsWith("zh")) return "zh";
  return lower.split("-")[0] ?? "";
};

type ScriptKey = "ko" | "ja" | "zh" | "ar" | "he" | "cyrl" | "th" | "el" | "hi" | "latin";

const SCRIPT_TESTS: readonly { readonly key: ScriptKey; readonly test: (code: number) => boolean }[] = [
  { key: "ko", test: (code) => code >= 0xac00 && code <= 0xd7a3 },
  {
    key: "ja",
    test: (code) =>
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0x31f0 && code <= 0x31ff) ||
      (code >= 0xff66 && code <= 0xff9d)
  },
  { key: "zh", test: (code) => code >= 0x4e00 && code <= 0x9fff },
  {
    key: "ar",
    test: (code) =>
      (code >= 0x0600 && code <= 0x06ff) ||
      (code >= 0x0750 && code <= 0x077f) ||
      (code >= 0x08a0 && code <= 0x08ff)
  },
  { key: "he", test: (code) => code >= 0x0590 && code <= 0x05ff },
  { key: "cyrl", test: (code) => code >= 0x0400 && code <= 0x04ff },
  { key: "th", test: (code) => code >= 0x0e00 && code <= 0x0e7f },
  { key: "el", test: (code) => code >= 0x0370 && code <= 0x03ff },
  { key: "hi", test: (code) => code >= 0x0900 && code <= 0x097f },
  {
    key: "latin",
    test: (code) => (code >= 0x41 && code <= 0x7a) || (code >= 0xc0 && code <= 0x024f)
  }
];

const classifyCodePoint = (code: number): ScriptKey | undefined =>
  SCRIPT_TESTS.find((entry) => entry.test(code))?.key;

const RANKED_SCRIPTS = ["ko", "zh", "ar", "he", "th", "el", "hi", "cyrl"] as const;

export const guessTextLang = (text: string | undefined | null): string => {
  const scripts = Array.from(String(text || ""))
    .map((ch) => ch.codePointAt(0))
    .filter((code): code is number => code != null && code > 0x40)
    .map(classifyCodePoint)
    .filter((key): key is ScriptKey => key != null);

  if (scripts.length === 0) return "auto";
  if (scripts.includes("ja")) return "ja";

  const top = RANKED_SCRIPTS.map((key) => [key, scripts.filter((item) => item === key).length] as const).sort(
    (a, b) => b[1] - a[1]
  )[0];

  if (top && top[1] / scripts.length >= 0.25) {
    return top[0] === "cyrl" ? "auto" : top[0];
  }
  return "auto";
};

export const googleSourceLang = (code: string | undefined | null): string => {
  if (code === "zh-Hant") return "zh-TW";
  if (code === "zh") return "zh-CN";
  if (!code || code === "auto" || code === "multi") return "auto";
  return code;
};

export const isAlreadyTargetLang = (text: string, targetLang: string): boolean => {
  const target = normalizeLang(targetLang);
  const guessed = guessTextLang(text);
  if (!target || guessed === "auto") return false;
  if (target === "zh" || target === "zh-Hant") return guessed === "zh";
  return guessed === target;
};
