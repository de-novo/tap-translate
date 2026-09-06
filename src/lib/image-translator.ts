import { shouldTranslateText } from "./dom";
import { collectPageImages, IMAGE_LAYER_ID, imageSource, isImageInViewport, MAX_PAGE_IMAGES } from "./image-targets";
import { ImageOverlayRoot } from "./image-overlay";
import { isAlreadyTargetLang } from "./language";
import { requestTranslations } from "./messaging";
import { recognizeImage, removeOcrFrame } from "./ocr-bridge";
import { looksLikeOcrNoise } from "./ocr-layout";
import { runtimeAlive } from "./runtime";
import { imageTessLang } from "./tess-lang";

const CONFIDENCE = 55;
const CONCURRENCY = 2;

export class ImageTranslator {
  private overlays = new ImageOverlayRoot();
  private seen = new WeakSet<HTMLImageElement>();
  private generation = 0;
  private chain: Promise<void> = Promise.resolve();
  private observer: MutationObserver | null = null;
  private watchTimer = 0;

  restore(): void {
    this.generation += 1;
    this.unwatch();
    this.overlays.clear();
    this.seen = new WeakSet();
    this.chain = Promise.resolve();
    removeOcrFrame();
  }

  async translatePage(sourceLang: string, targetLang: string, alive: () => boolean): Promise<void> {
    if (!runtimeAlive() || !alive()) return;
    this.watch(sourceLang, targetLang, alive);
    const token = this.generation;
    this.chain = this.chain
      .then(() => this.runBatch(sourceLang, targetLang, alive, token))
      .catch((error: unknown) => {
        console.error("image translate failed", error);
      });
    await this.chain;
  }

  private async runBatch(
    sourceLang: string,
    targetLang: string,
    alive: () => boolean,
    token: number
  ): Promise<void> {
    if (!alive() || token !== this.generation) return;
    const images = collectPageImages();
    const visible = images.filter((image) => isImageInViewport(image) && !this.seen.has(image));
    const rest = images.filter((image) => !visible.includes(image) && !this.seen.has(image));
    const queue = [...visible, ...rest].slice(0, MAX_PAGE_IMAGES);
    if (!queue.length) return;
    for (const image of queue) this.overlays.mark(image);
    const lang = imageTessLang(sourceLang);
    await mapPool(queue, CONCURRENCY, async (image) => {
      if (!alive() || !runtimeAlive() || token !== this.generation) return;
      await this.translateImage(image, lang, targetLang, alive, token);
    });
  }

  private watch(sourceLang: string, targetLang: string, alive: () => boolean): void {
    if (this.observer) return;
    const kick = () => {
      window.clearTimeout(this.watchTimer);
      this.watchTimer = window.setTimeout(() => {
        if (!alive() || !runtimeAlive()) {
          this.unwatch();
          return;
        }
        void this.translatePage(sourceLang, targetLang, alive);
      }, 400);
    };
    this.observer = new MutationObserver((records) => {
      const ours = records.every((record) => {
        const target = record.target;
        return target instanceof Element && Boolean(target.closest(`#${IMAGE_LAYER_ID}`));
      });
      if (ours) return;
      kick();
    });
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("scroll", kick, true);
    this.onScroll = kick;
  }

  private onScroll: (() => void) | null = null;

  private unwatch(): void {
    this.observer?.disconnect();
    this.observer = null;
    window.clearTimeout(this.watchTimer);
    if (this.onScroll) window.removeEventListener("scroll", this.onScroll, true);
    this.onScroll = null;
  }

  private async translateImage(
    image: HTMLImageElement,
    lang: string,
    targetLang: string,
    alive: () => boolean,
    token: number
  ): Promise<void> {
    if (this.seen.has(image)) return;
    this.seen.add(image);
    const src = await imageSource(image);
    if (!src || !alive()) {
      this.overlays.drop(image);
      return;
    }
    let ocr;
    try {
      ocr = await recognizeImage(src, lang);
    } catch (error) {
      console.error("image ocr failed", error);
      this.overlays.drop(image);
      return;
    }
    if (!alive() || token !== this.generation) return;
    if (!ocr.ok) {
      console.error("image ocr failed", ocr.error);
      this.overlays.drop(image);
      return;
    }
    const pending = ocr.lines.filter(
      (line) =>
        line.confidence >= CONFIDENCE &&
        shouldTranslateText(line.text) &&
        !looksLikeOcrNoise(line.text) &&
        !isAlreadyTargetLang(line.text, targetLang)
    );
    if (!pending.length) {
      this.overlays.drop(image);
      return;
    }
    const response = await requestTranslations(
      pending.map((line) => line.text),
      "auto",
      targetLang
    );
    if (!response.ok || !alive() || token !== this.generation) return;
    const lines = pending.flatMap((line, index) => {
      const translated = response.translations[index]?.trim() ?? "";
      if (!translated || translated === line.text.trim()) return [];
      return [{ text: line.text, translated }];
    });
    if (!lines.length) {
      this.overlays.drop(image);
      return;
    }
    this.overlays.ready(image, lines);
  }
}

async function mapPool<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<void>
): Promise<void> {
  const pending = [...items];
  const workers = Array.from({ length: Math.min(limit, pending.length) }, async () => {
    while (pending.length) {
      const item = pending.shift();
      if (item === undefined) return;
      await work(item);
    }
  });
  await Promise.all(workers);
}
