export type Box = {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
};

export type OcrRegion = Box & {
  readonly text: string;
  readonly confidence: number;
  readonly rowHeight: number;
};

const NO_SPACE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function joinOcrLines(texts: readonly string[]): string {
  const parts = texts.map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!parts.length) return "";
  return parts.reduce((acc, part) => {
    if (!acc) return part;
    const tight = NO_SPACE.test(acc.slice(-1)) && NO_SPACE.test(part[0] ?? "");
    return `${acc}${tight ? "" : " "}${part}`;
  });
}

export function looksLikeOcrNoise(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 2) return true;
  const letters = [...compact].filter((ch) => /\p{L}/u.test(ch)).length;
  if (letters < 2) return true;
  return letters / compact.length < 0.4;
}

export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function hexRgb(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function contrastForeground(r: number, g: number, b: number): string {
  return luminance(r, g, b) > 150 ? "#1a1a1a" : "#f8fafc";
}

export function medianRgb(samples: readonly (readonly [number, number, number])[]): [number, number, number] {
  if (!samples.length) return [255, 255, 255];
  const sorted = [...samples].sort((a, b) => luminance(a[0], a[1], a[2]) - luminance(b[0], b[1], b[2]));
  const mid = sorted[Math.floor(sorted.length / 2)] ?? [255, 255, 255];
  return [mid[0], mid[1], mid[2]];
}

export function inflatePad(rowHeight: number): number {
  return Math.max(2, Math.round(rowHeight * 0.14));
}

export function inflateBox(box: Box, width: number, height: number, pad: number): Box {
  return {
    x0: Math.max(0, box.x0 - pad),
    y0: Math.max(0, box.y0 - pad),
    x1: Math.min(width, box.x1 + pad),
    y1: Math.min(height, box.y1 + pad)
  };
}

export function shouldCenterOverlay(
  line: Box & { readonly translated: string },
  imageWidth: number
): boolean {
  const width = line.x1 - line.x0;
  const mid = (line.x0 + line.x1) / 2;
  const short = line.translated.length <= 24 && width < imageWidth * 0.42;
  const centeredTitle =
    Math.abs(mid - imageWidth / 2) < imageWidth * 0.08 &&
    width < imageWidth * 0.62 &&
    line.translated.length <= 48;
  return short || centeredTitle;
}

export function mergeRegions(regions: readonly OcrRegion[]): OcrRegion[] {
  const sorted = [...regions].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const out: OcrRegion[] = [];
  for (const region of sorted) {
    const prev = out[out.length - 1];
    if (prev && canMerge(prev, region)) out[out.length - 1] = combine(prev, region);
    else out.push(region);
  }
  return out;
}

function canMerge(a: OcrRegion, b: OcrRegion): boolean {
  const row = Math.max(6, Math.min(a.rowHeight, b.rowHeight));
  const xOverlap = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const minW = Math.min(a.x1 - a.x0, b.x1 - b.x0);
  const left = a.x0 <= b.x0 ? a : b;
  const right = left === a ? b : a;
  const hGap = right.x0 - left.x1;
  const sameRow = Math.abs(a.y0 - b.y0) <= row * 0.55 && Math.abs(a.y1 - b.y1) <= row * 0.55;
  if (sameRow && hGap >= -row * 0.25 && hGap <= row * 1.6) return true;

  const earlier = a.y0 <= b.y0 ? a : b;
  const later = earlier === a ? b : a;
  const vGap = later.y0 - earlier.y1;
  if (vGap < -row * 0.2 || vGap > row * 0.72) return false;
  if (xOverlap < minW * 0.28) return false;
  const taller = Math.max(a.rowHeight, b.rowHeight);
  const shorter = Math.min(a.rowHeight, b.rowHeight);
  return taller <= shorter * 1.9;
}

function combine(a: OcrRegion, b: OcrRegion): OcrRegion {
  const first = a.y0 < b.y0 - 2 ? a : b.y0 < a.y0 - 2 ? b : a.x0 <= b.x0 ? a : b;
  const second = first === a ? b : a;
  return {
    text: joinOcrLines([first.text, second.text]),
    confidence: (a.confidence + b.confidence) / 2,
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
    rowHeight: (a.rowHeight + b.rowHeight) / 2
  };
}
