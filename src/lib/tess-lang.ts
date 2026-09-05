const TESS_LANG: Record<string, string> = {
  ar: "ara",
  bg: "bul",
  cs: "ces",
  da: "dan",
  de: "deu",
  el: "ell",
  en: "eng",
  es: "spa",
  fi: "fin",
  fr: "fra",
  he: "heb",
  hi: "hin",
  hr: "hrv",
  hu: "hun",
  id: "ind",
  it: "ita",
  ja: "jpn",
  kn: "kan",
  ko: "kor",
  lt: "lit",
  nl: "nld",
  no: "nor",
  pl: "pol",
  pt: "por",
  ro: "ron",
  ru: "rus",
  sk: "slk",
  sl: "slv",
  sv: "swe",
  ta: "tam",
  te: "tel",
  th: "tha",
  tr: "tur",
  uk: "ukr",
  vi: "vie",
  zh: "chi_sim",
  "zh-Hant": "chi_tra"
};

export function tessLang(sourceLang: string): string {
  if (sourceLang === "zh-Hant") return TESS_LANG["zh-Hant"] ?? "chi_tra";
  if (sourceLang === "zh") return TESS_LANG.zh ?? "chi_sim";
  const mapped = TESS_LANG[sourceLang];
  if (mapped) return mapped;
  return "eng";
}
