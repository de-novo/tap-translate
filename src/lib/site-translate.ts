export type SiteTranslate = Record<string, boolean>;

export function parseSiteTranslate(value: unknown): SiteTranslate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: SiteTranslate = {};
  for (const [host, on] of Object.entries(value)) {
    if (host && typeof on === "boolean") out[host] = on;
  }
  return out;
}

export function rememberSiteTranslate(prev: SiteTranslate, host: string, on: boolean): SiteTranslate {
  if (!host) return prev;
  return { ...prev, [host]: on };
}

/** Last toggle for this host wins. Unknown hosts follow the global always-translate flag. */
export function shouldStartTranslated(
  host: string,
  siteTranslate: SiteTranslate,
  alwaysTranslate: readonly string[]
): boolean {
  const saved = siteTranslate[host];
  if (saved === true) return true;
  if (saved === false) return false;
  return alwaysTranslate.includes("*") || alwaysTranslate.includes(host);
}
