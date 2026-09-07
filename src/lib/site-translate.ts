export type SiteTranslate = Record<string, boolean>;

/** Path is ignored. `www.x.com` and `x.com` are the same site. */
export function siteKey(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, "");
}

export function parseSiteTranslate(value: unknown): SiteTranslate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: SiteTranslate = {};
  for (const [host, on] of Object.entries(value)) {
    if (host && typeof on === "boolean") out[host] = on;
  }
  return out;
}

export function rememberSiteTranslate(prev: SiteTranslate, host: string, on: boolean): SiteTranslate {
  const key = siteKey(host);
  if (!key) return prev;
  return { ...prev, [key]: on };
}

/** Last switch for this host. Opening a page does not read this to auto-start. */
export function shouldStartTranslated(host: string, siteTranslate: SiteTranslate): boolean {
  return siteTranslate[siteKey(host)] === true;
}
