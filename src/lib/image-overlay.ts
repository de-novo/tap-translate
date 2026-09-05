import { paintedImageRect } from "./image-box";
import { IMAGE_LAYER_ID } from "./image-targets";
import { shouldCenterOverlay } from "./ocr-layout";
import type { OcrLine } from "./protocol";

export type OverlayLine = OcrLine & { readonly translated: string };

type OverlayEntry = {
  readonly image: HTMLImageElement;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  readonly lines: readonly OverlayLine[];
  readonly root: HTMLDivElement;
};

export class ImageOverlayRoot {
  private host: HTMLDivElement | null = null;
  private entries: OverlayEntry[] = [];
  private listening = false;
  private observer: ResizeObserver | null = null;

  clear(): void {
    this.entries = [];
    this.host?.remove();
    this.host = null;
    this.unbind();
  }

  add(
    image: HTMLImageElement,
    naturalWidth: number,
    naturalHeight: number,
    lines: readonly OverlayLine[]
  ): void {
    if (!lines.length) return;
    const host = this.ensureHost();
    const root = document.createElement("div");
    root.setAttribute("translate", "no");
    root.style.cssText = "position:fixed;pointer-events:none;overflow:hidden;";
    for (const line of lines) {
      const box = document.createElement("div");
      const span = document.createElement("span");
      span.textContent = line.translated;
      box.append(span);
      box.style.cssText = [
        "position:absolute",
        "box-sizing:border-box",
        "display:flex",
        "align-items:center",
        "background:" + (line.bg ?? "#ffffff"),
        "color:" + (line.fg ?? "#1a1a1a"),
        "font-family:ui-sans-serif,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif",
        "overflow:hidden"
      ].join(";");
      root.append(box);
    }
    host.append(root);
    this.entries.push({ image, naturalWidth, naturalHeight, lines, root });
    this.layout();
    this.bind();
    this.observer?.observe(image);
  }

  private ensureHost(): HTMLDivElement {
    if (this.host?.isConnected) return this.host;
    const host = document.createElement("div");
    host.id = IMAGE_LAYER_ID;
    host.setAttribute("translate", "no");
    host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483645;";
    (document.documentElement ?? document.body).append(host);
    this.host = host;
    return host;
  }

  private layout(): void {
    const leftovers: OverlayEntry[] = [];
    for (const entry of this.entries) {
      if (!entry.image.isConnected) {
        entry.root.remove();
        continue;
      }
      leftovers.push(entry);
      const rect = paintedImageRect(entry.image, entry.naturalWidth, entry.naturalHeight);
      entry.root.style.left = `${rect.left}px`;
      entry.root.style.top = `${rect.top}px`;
      entry.root.style.width = `${rect.width}px`;
      entry.root.style.height = `${rect.height}px`;
      const scaleX = rect.width / Math.max(1, entry.naturalWidth);
      const scaleY = rect.height / Math.max(1, entry.naturalHeight);
      Array.from(entry.root.children).forEach((child, index) => {
        const line = entry.lines[index];
        if (!(child instanceof HTMLElement) || !line) return;
        const width = Math.max(8, (line.x1 - line.x0) * scaleX);
        const height = Math.max(8, (line.y1 - line.y0) * scaleY);
        const rowHeight = Math.max(8, (line.rowHeight ?? line.y1 - line.y0) * scaleY);
        const centered = shouldCenterOverlay(line, entry.naturalWidth);
        child.style.left = `${line.x0 * scaleX}px`;
        child.style.top = `${line.y0 * scaleY}px`;
        child.style.width = `${width}px`;
        child.style.height = `${height}px`;
        child.style.justifyContent = centered ? "center" : "flex-start";
        child.style.textAlign = centered ? "center" : "left";
        child.style.fontWeight = rowHeight >= 26 ? "600" : "500";
        child.style.borderRadius = `${Math.min(8, Math.max(2, rowHeight * 0.18))}px`;
        const span = child.firstElementChild;
        if (span instanceof HTMLElement) fitBlock(child, span, line.translated, height, rowHeight);
      });
    }
    this.entries = leftovers;
    if (!this.entries.length) this.clear();
  }

  private bind(): void {
    if (this.listening) return;
    this.listening = true;
    const onMove = () => this.layout();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    window.visualViewport?.addEventListener("resize", onMove);
    window.visualViewport?.addEventListener("scroll", onMove);
    this.observer = new ResizeObserver(onMove);
    for (const entry of this.entries) this.observer.observe(entry.image);
    this.onMove = onMove;
  }

  private onMove: (() => void) | null = null;

  private unbind(): void {
    if (!this.listening || !this.onMove) return;
    window.removeEventListener("scroll", this.onMove, true);
    window.removeEventListener("resize", this.onMove);
    window.visualViewport?.removeEventListener("resize", this.onMove);
    window.visualViewport?.removeEventListener("scroll", this.onMove);
    this.observer?.disconnect();
    this.observer = null;
    this.listening = false;
    this.onMove = null;
  }
}

function fitBlock(el: HTMLElement, span: HTMLElement, text: string, height: number, rowHeight: number): void {
  const key = `${Math.round(el.clientWidth || 0)}x${Math.round(height)}:${text}`;
  if (el.dataset.fit === key) return;
  el.dataset.fit = key;
  span.textContent = text;
  const padX = Math.max(3, Math.min(10, rowHeight * 0.18));
  const padY = Math.max(2, Math.min(8, rowHeight * 0.1));
  el.style.padding = `${padY}px ${padX}px`;
  span.style.cssText = [
    "min-width:0",
    "width:100%",
    "white-space:normal",
    "word-break:keep-all",
    "overflow-wrap:anywhere",
    "line-height:1.2",
    "text-align:inherit"
  ].join(";");
  let lo = Math.max(8, rowHeight * 0.42);
  let hi = Math.max(lo + 1, Math.min(height * 0.9, rowHeight * 0.95));
  for (let i = 0; i < 8; i += 1) {
    const mid = (lo + hi) / 2;
    span.style.fontSize = `${mid}px`;
    const fits = span.scrollWidth <= span.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1;
    if (fits) lo = mid;
    else hi = mid;
  }
  span.style.fontSize = `${lo}px`;
}
