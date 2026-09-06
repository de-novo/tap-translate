import { shouldTranslateText } from "./dom";
import { collectPageImages, imageSource, isImageInViewport, MAX_PAGE_IMAGES } from "./image-targets";
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

  restore(): void {
    this.generation += 1;
    this.overlays.clear();
    this.seen = new WeakSet();
    removeOcrFrame();
  }

  async translatePage(sourceLang: string, targetLang: string, alive: () => boolean): Promise<void> {
    if (!runtimeAlive() || !alive()) return;
    const token = this.generation;
    const images = collectPageImages();
    const visible = images.filter(isImageInViewport);
    const rest = images.filter((image) => !visible.includes(image));
    const queue = [...visible, ...rest].slice(0, MAX_PAGE_IMAGES);
    const lang = imageTessLang(sourceLang);
    await mapPool(queue, CONCURRENCY, async (image) => {
      if (!alive() || !runtimeAlive() || token !== this.generation) return;
      await this.translateImage(image, lang, targetLang, alive, token);
    });
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
    if (!src || !alive()) return;
    let ocr;
    try {
      ocr = await recognizeImage(src, lang);
    } catch (error) {
      console.error("image ocr failed", error);
      return;
    }
    if (!alive()) return;
    if (!ocr.ok) {
      console.error("image ocr failed", ocr.error);
      return;
    }
    const pending = ocr.lines.filter(
      (line) =>
        line.confidence >= CONFIDENCE &&
        shouldTranslateText(line.text) &&
        !looksLikeOcrNoise(line.text) &&
        !isAlreadyTargetLang(line.text, targetLang)
    );
    if (!pending.length) return;
    const response = await requestTranslations(
      pending.map((line) => line.text),
      "auto",
      targetLang
    );
    if (!response.ok || !alive()) return;
    const lines = pending.flatMap((line, index) => {
      const translated = response.translations[index]?.trim() ?? "";
      if (!translated || translated === line.text.trim()) return [];
      return [{ text: line.text, translated }];
    });
    if (!lines.length || token !== this.generation || !alive()) return;
    this.overlays.add(image, lines);
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
