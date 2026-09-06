import { captionBox, placeCaption } from "./caption-place";
import { paintedImageRect } from "./image-box";
import { IMAGE_LAYER_ID } from "./image-targets";

export type OverlayLine = {
  readonly text: string;
  readonly translated: string;
};

type OverlayEntry = {
  readonly image: HTMLImageElement;
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

  add(image: HTMLImageElement, lines: readonly OverlayLine[]): void {
    if (!lines.length) return;
    const host = this.ensureHost();
    const root = document.createElement("div");
    root.setAttribute("translate", "no");
    root.style.cssText = [
      "position:absolute",
      "box-sizing:border-box",
      "pointer-events:auto",
      "overflow:auto",
      "background:#152033",
      "color:#e8eaed",
      "border:1px solid rgba(26,115,232,0.35)",
      "border-radius:12px",
      "padding:8px 10px",
      "box-shadow:0 10px 15px -3px rgba(0,0,0,0.25)",
      "font-family:ui-sans-serif,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif"
    ].join(";");
    for (const [index, line] of lines.entries()) {
      const block = document.createElement("div");
      if (index > 0) block.style.cssText = "margin-top:8px;padding-top:8px;border-top:1px solid rgba(232,234,237,0.12)";
      const translated = document.createElement("div");
      translated.textContent = line.translated;
      translated.style.cssText = "font-size:13px;line-height:1.4;font-weight:600;word-break:keep-all;overflow-wrap:anywhere";
      block.append(translated);
      if (line.text.trim() && line.text.trim() !== line.translated) {
        const original = document.createElement("div");
        original.textContent = line.text;
        original.style.cssText =
          "margin-top:3px;font-size:11px;line-height:1.35;color:#9aa0a6;word-break:keep-all;overflow-wrap:anywhere";
        block.append(original);
      }
      root.append(block);
    }
    host.append(root);
    this.entries.push({ image, root });
    this.layout();
    this.bind();
    this.observer?.observe(image);
  }

  private ensureHost(): HTMLDivElement {
    if (this.host?.isConnected) return this.host;
    const host = document.createElement("div");
    host.id = IMAGE_LAYER_ID;
    host.setAttribute("translate", "no");
    host.style.cssText = "position:fixed;inset:0;pointer-events:none;overflow:visible;z-index:2147483645;";
    (document.documentElement ?? document.body).append(host);
    this.host = host;
    return host;
  }

  private layout(): void {
    const leftovers: OverlayEntry[] = [];
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    for (const entry of this.entries) {
      if (!entry.image.isConnected) {
        entry.root.remove();
        continue;
      }
      leftovers.push(entry);
      const painted = paintedImageRect(entry.image, entry.image.naturalWidth || entry.image.width, entry.image.naturalHeight || entry.image.height);
      if (painted.bottom < 0 || painted.top > viewport.height || painted.right < 0 || painted.left > viewport.width) {
        entry.root.style.display = "none";
        continue;
      }
      entry.root.style.display = "block";
      const place = placeCaption(
        { left: painted.left, top: painted.top, width: painted.width, height: painted.height },
        viewport
      );
      const box = captionBox(place);
      entry.root.style.left = `${box.left}px`;
      entry.root.style.top = `${box.top}px`;
      entry.root.style.width = `${box.width}px`;
      entry.root.style.maxHeight = `${box.height}px`;
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
