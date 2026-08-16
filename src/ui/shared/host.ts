export function currentHost(): string {
  return location.hostname;
}

export function hostFromUrl(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname : "";
  } catch {
    return "";
  }
}

export function isHiddenOnHost(hiddenHosts: readonly string[], host: string): boolean {
  return hiddenHosts.includes(host);
}
