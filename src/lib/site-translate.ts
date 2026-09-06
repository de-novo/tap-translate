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

/** Only hosts the user turned on. Global always-translate does not start a page by itself. */
export function shouldStartTranslated(host: string, siteTranslate: SiteTranslate): boolean {
  return siteTranslate[host] === true;
}
