import { placeBadge, placePair } from "./caption-place";
import { paintedImageRect } from "./image-box";
import { t } from "./i18n";
import { paintTranslatedImage, type PaintLine } from "./image-paint";
import { IMAGE_LAYER_ID } from "./image-targets";

export type OverlayLine = PaintLine & { readonly text: string };

type OverlayEntry = {
  readonly image: HTMLImageElement;
  readonly badge: HTMLButtonElement;
  readonly pair: HTMLCanvasElement;
  open: boolean;
  status: "pending" | "ready";
  ocrWidth: number;
  ocrHeight: number;
  lines: readonly OverlayLine[];
};

const CHIP = [
  "background:#152033",
  "color:#e8eaed",
  "border:1px solid rgba(26,115,232,0.55)",
  "box-shadow:0 10px 15px -3px rgba(0,0,0,0.25)",
  "font-family:ui-sans-serif,system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif"
].join(";");

export class ImageOverlayRoot {
  private host: HTMLDivElement | null = null;
  private entries: OverlayEntry[] = [];
  private byImage = new WeakMap<HTMLImageElement, OverlayEntry>();
  private listening = false;
  private observer: ResizeObserver | null = null;

  clear(): void {
    this.entries = [];
    this.byImage = new WeakMap();
    this.host?.remove();
    this.host = null;
    this.unbind();
  }

  mark(image: HTMLImageElement): void {
    if (this.byImage.has(image)) return;
    const host = this.ensureHost();
    const badge = document.createElement("button");
    badge.type = "button";
    badge.dataset.qt = "image-badge";
    badge.dataset.status = "pending";
    badge.textContent = "文";
    badge.title = t("translatingImages");
    badge.setAttribute("aria-label", t("translatingImages"));
    badge.setAttribute("aria-busy", "true");
    badge.style.cssText = [
      "position:absolute",
      "box-sizing:border-box",
      "pointer-events:auto",
      "margin:0",
      "padding:0",
      "display:grid",
      "place-items:center",
      "border-radius:12px",
      "font-size:13px",
      "font-weight:700",
      "line-height:1",
      "cursor:wait",
      "opacity:0.65",
      CHIP
    ].join(";");
    const pair = document.createElement("canvas");
    pair.dataset.qt = "image-pair";
    pair.setAttribute("translate", "no");
    pair.style.cssText = [
      "position:absolute",
      "box-sizing:border-box",
      "pointer-events:auto",
      "display:none",
      "border-radius:8px",
      "box-shadow:0 10px 15px -3px rgba(0,0,0,0.25)"
    ].join(";");
    const entry: OverlayEntry = {
      image,
      badge,
      pair,
      open: false,
      status: "pending",
      ocrWidth: 1,
      ocrHeight: 1,
      lines: []
    };
    badge.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggle(entry);
    });
    host.append(badge, pair);
    this.entries.push(entry);
    this.byImage.set(image, entry);
    this.layout();
    this.bind();
    this.observer?.observe(image);
  }

  ready(
    image: HTMLImageElement,
    ocrWidth: number,
    ocrHeight: number,
    lines: readonly OverlayLine[]
  ): void {
    if (!lines.length) {
      this.drop(image);
      return;
    }
    this.mark(image);
    const entry = this.byImage.get(image);
    if (!entry) return;
    entry.status = "ready";
    entry.ocrWidth = ocrWidth;
    entry.ocrHeight = ocrHeight;
    entry.lines = lines;
    entry.badge.dataset.status = "ready";
    entry.badge.title = t("imageCaption");
    entry.badge.setAttribute("aria-label", t("imageCaption"));
    entry.badge.removeAttribute("aria-busy");
    entry.badge.style.cursor = "pointer";
    entry.badge.style.opacity = "1";
    this.paint(entry);
    this.layout();
  }

  drop(image: HTMLImageElement): void {
    const entry = this.byImage.get(image);
    if (!entry) return;
    entry.badge.remove();
    entry.pair.remove();
    this.byImage.delete(image);
    this.entries = this.entries.filter((item) => item !== entry);
    if (!this.entries.length) this.clear();
    else this.layout();
  }

  private paint(entry: OverlayEntry): void {
    const painted = paintTranslatedImage(
      entry.image,
      entry.image.naturalWidth || entry.image.width,
      entry.image.naturalHeight || entry.image.height,
      entry.ocrWidth,
      entry.ocrHeight,
      entry.lines
    );
    const ctx = entry.pair.getContext("2d");
    entry.pair.width = painted.width;
    entry.pair.height = painted.height;
    ctx?.drawImage(painted, 0, 0);
  }

  private toggle(entry: OverlayEntry): void {
    if (entry.status !== "ready") return;
    const next = !entry.open;
    for (const item of this.entries) item.open = item === entry ? next : false;
    this.layout();
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
        entry.badge.remove();
        entry.pair.remove();
        this.byImage.delete(entry.image);
        continue;
      }
      leftovers.push(entry);
      const painted = paintedImageRect(
        entry.image,
        entry.image.naturalWidth || entry.image.width,
        entry.image.naturalHeight || entry.image.height
      );
      if (painted.bottom < 0 || painted.top > viewport.height || painted.right < 0 || painted.left > viewport.width) {
        entry.badge.style.display = "none";
        entry.pair.style.display = "none";
        continue;
      }
      const image = { left: painted.left, top: painted.top, width: painted.width, height: painted.height };
      const badge = placeBadge(image);
      entry.badge.style.display = "grid";
      entry.badge.style.left = `${badge.left}px`;
      entry.badge.style.top = `${badge.top}px`;
      entry.badge.style.width = `${badge.width}px`;
      entry.badge.style.height = `${badge.height}px`;
      entry.badge.style.borderColor = entry.open ? "#1a73e8" : "rgba(26,115,232,0.55)";
      if (!entry.open || entry.status !== "ready") {
        entry.pair.style.display = "none";
        continue;
      }
      const box = placePair(image, viewport);
      entry.pair.style.display = "block";
      entry.pair.style.left = `${box.left}px`;
      entry.pair.style.top = `${box.top}px`;
      entry.pair.style.width = `${box.width}px`;
      entry.pair.style.height = `${box.height}px`;
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
