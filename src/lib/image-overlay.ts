import { captionBox, placeBadge, placeCaption } from "./caption-place";
import { paintedImageRect } from "./image-box";
import { t } from "./i18n";
import { IMAGE_LAYER_ID } from "./image-targets";

export type OverlayLine = {
  readonly text: string;
  readonly translated: string;
};

type OverlayEntry = {
  readonly image: HTMLImageElement;
  readonly badge: HTMLButtonElement;
  readonly caption: HTMLDivElement;
  open: boolean;
  status: "pending" | "ready";
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
    const caption = document.createElement("div");
    caption.dataset.qt = "image-caption";
    caption.setAttribute("translate", "no");
    caption.style.cssText = [
      "position:absolute",
      "box-sizing:border-box",
      "pointer-events:auto",
      "overflow:auto",
      "border-radius:12px",
      "padding:8px 10px",
      "display:none",
      CHIP
    ].join(";");
    this.fillCaption(caption, [{ text: "", translated: t("translatingImages") }]);
    const entry: OverlayEntry = { image, badge, caption, open: false, status: "pending" };
    badge.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggle(entry);
    });
    host.append(badge, caption);
    this.entries.push(entry);
    this.byImage.set(image, entry);
    this.layout();
    this.bind();
    this.observer?.observe(image);
  }

  ready(image: HTMLImageElement, lines: readonly OverlayLine[]): void {
    if (!lines.length) {
      this.drop(image);
      return;
    }
    this.mark(image);
    const entry = this.byImage.get(image);
    if (!entry) return;
    entry.status = "ready";
    entry.badge.dataset.status = "ready";
    entry.badge.title = t("imageCaption");
    entry.badge.setAttribute("aria-label", t("imageCaption"));
    entry.badge.removeAttribute("aria-busy");
    entry.badge.style.cursor = "pointer";
    entry.badge.style.opacity = "1";
    this.fillCaption(entry.caption, lines);
    this.layout();
  }

  drop(image: HTMLImageElement): void {
    const entry = this.byImage.get(image);
    if (!entry) return;
    entry.badge.remove();
    entry.caption.remove();
    this.byImage.delete(image);
    this.entries = this.entries.filter((item) => item !== entry);
    if (!this.entries.length) this.clear();
    else this.layout();
  }

  private fillCaption(caption: HTMLDivElement, lines: readonly OverlayLine[]): void {
    caption.replaceChildren();
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
      caption.append(block);
    }
  }

  private toggle(entry: OverlayEntry): void {
    const next = !entry.open;
    for (const item of this.entries) item.open = item === entry ? next : false;
    this.layout();
  }

  private closeAll(): void {
    let changed = false;
    for (const item of this.entries) {
      if (!item.open) continue;
      item.open = false;
      changed = true;
    }
    if (changed) this.layout();
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
        entry.caption.remove();
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
        entry.caption.style.display = "none";
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
      if (!entry.open) {
        entry.caption.style.display = "none";
        continue;
      }
      const box = captionBox(placeCaption(image, viewport));
      entry.caption.style.display = "block";
      entry.caption.style.left = `${box.left}px`;
      entry.caption.style.top = `${box.top}px`;
      entry.caption.style.width = `${box.width}px`;
      entry.caption.style.maxHeight = `${box.height}px`;
    }
    this.entries = leftovers;
    if (!this.entries.length) this.clear();
  }

  private bind(): void {
    if (this.listening) return;
    this.listening = true;
    const onMove = () => this.layout();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (this.entries.some((entry) => entry.badge.contains(target) || entry.caption.contains(target))) return;
      this.closeAll();
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.visualViewport?.addEventListener("resize", onMove);
    window.visualViewport?.addEventListener("scroll", onMove);
    this.observer = new ResizeObserver(onMove);
    for (const entry of this.entries) this.observer.observe(entry.image);
    this.onMove = onMove;
    this.onPointerDown = onPointerDown;
  }

  private onMove: (() => void) | null = null;
  private onPointerDown: ((event: PointerEvent) => void) | null = null;

  private unbind(): void {
    if (!this.listening || !this.onMove) return;
    window.removeEventListener("scroll", this.onMove, true);
    window.removeEventListener("resize", this.onMove);
    if (this.onPointerDown) window.removeEventListener("pointerdown", this.onPointerDown, true);
    window.visualViewport?.removeEventListener("resize", this.onMove);
    window.visualViewport?.removeEventListener("scroll", this.onMove);
    this.observer?.disconnect();
    this.observer = null;
    this.listening = false;
    this.onMove = null;
    this.onPointerDown = null;
  }
}
