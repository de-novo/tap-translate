import { browser } from "wxt/browser";
import {
  collectPageLangs,
  collectSampleText,
  collectTextNodes,
  isNodeInViewport,
  shouldTranslateText,
  splitChunks
} from "./dom";
import { googleSourceLang, guessTextLang, isAlreadyTargetLang, normalizeLang } from "./language";
import { requestDetect, requestTranslations } from "./messaging";
import { createOnDeviceTranslator, type OnDeviceTranslator } from "./on-device";
import { matchDetectResponse, matchTranslateResponse, type TranslateResponse } from "./protocol";
import { isContextInvalidated, runtimeAlive } from "./runtime";
import { type PageTranslateResult } from "./translate-result";

export type TranslatorState = "original" | "translating" | "translated";
export type ProgressHandler = (progress: number, status?: string) => void;

export class PageTranslator {
  private originals = new WeakMap<Text, string>();
  private cache = new Map<string, string>();
  private cacheTarget = "";
  private onDevice: OnDeviceTranslator | null = null;
  private onDeviceKey = "";
  engine = "";
  sourceLang = "";
  targetLang = "ko";
  state: TranslatorState = "original";
  private generation = 0;
  private originalTitle = "";
  private observer: MutationObserver | null = null;
  private onProgress: ProgressHandler | null = null;
  private pendingTimer = 0;

  setProgressHandler(handler: ProgressHandler | null): void {
    this.onProgress = handler;
  }

  report(progress: number, status?: string): void {
    this.onProgress?.(progress, status);
  }

  async detectLanguage(): Promise<string> {
    const htmlLang = normalizeLang(document.documentElement.lang);
    const pageLangs = collectPageLangs(guessTextLang, 150);
    const concrete = [...pageLangs].filter((code) => code !== "latin");
    if (concrete.length > 1 || (concrete.length === 1 && pageLangs.has("latin"))) {
      return "multi";
    }
    if (concrete.length === 1 && concrete[0]) return concrete[0];
    const sample = collectSampleText(2500);
    if (!sample && htmlLang) return htmlLang;

    if (!browser.runtime?.id) return htmlLang || "";
    const detected = matchDetectResponse(await requestDetect(sample || document.title || ""), {
      onOk: (language) => normalizeLang(language),
      onError: () => ""
    });
    return detected || htmlLang || "";
  }

  private cacheKey(text: string): string {
    return this.targetLang + "\0" + text;
  }

  rememberCache(text: string, translated: string): void {
    this.cache.set(this.cacheKey(text), translated);
  }

  cachedTranslation(text: string): string | undefined {
    return this.cache.get(this.cacheKey(text));
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheTarget = this.targetLang;
  }

  private async translateGroupGoogle(pending: string[], sourceLang: string): Promise<TranslateResponse> {
    const expanded: string[] = [];
    const owners: { text: string; from: number; count: number }[] = [];
    for (const text of pending) {
      const chunks = splitChunks(text);
      owners.push({ text, from: expanded.length, count: chunks.length });
      expanded.push(...chunks);
    }
    const response = await requestTranslations(expanded, sourceLang, this.targetLang);
    return matchTranslateResponse(response, {
      onOk: (translations) => {
        owners.forEach((owner) => {
          const parts = translations.slice(owner.from, owner.from + owner.count);
          this.rememberCache(owner.text, parts.join(""));
        });
        return response;
      },
      onError: () => response
    });
  }

  private async translateManyGoogle(texts: string[]): Promise<TranslateResponse> {
    const groups = new Map<string, string[]>();
    for (const text of texts) {
      if (this.cachedTranslation(text)) continue;
      if (isAlreadyTargetLang(text, this.targetLang)) {
        this.rememberCache(text, text);
        continue;
      }
      const sourceLang = googleSourceLang(guessTextLang(text));
      const bucket = groups.get(sourceLang);
      if (bucket) bucket.push(text);
      else groups.set(sourceLang, [text]);
    }
    const results = await Promise.all(
      [...groups.entries()].map(([sourceLang, pending]) => this.translateGroupGoogle(pending, sourceLang))
    );
    return results.find((result) => !result.ok) ?? { ok: true, translations: [] };
  }

  private async ensureOnDeviceTranslator(
    sourceLang: string,
    targetLang: string
  ): Promise<{ ok: true; translator: OnDeviceTranslator } | { ok: false; reason: "unsupported" | "unavailable" }> {
    const key = sourceLang + ":" + targetLang;
    if (this.onDevice && this.onDeviceKey === key) return { ok: true, translator: this.onDevice };
    const created = await createOnDeviceTranslator(sourceLang, targetLang);
    if (!created.ok) return created;
    this.onDevice = created.translator;
    this.onDeviceKey = key;
    return created;
  }

  private async translateManyOnDevice(texts: string[]): Promise<PageTranslateResult> {
    const created = await this.ensureOnDeviceTranslator(this.sourceLang, this.targetLang);
    if (!created.ok) {
      return created.reason === "unsupported"
        ? { _tag: "Unsupported" }
        : { _tag: "Failed", message: created.reason };
    }
    const chunksByText = texts
      .filter((text) => !this.cachedTranslation(text))
      .map((text) => ({ text, chunks: splitChunks(text) }));
    const translated = await Promise.all(
      chunksByText.map(({ chunks }) => Promise.all(chunks.map((chunk) => created.translator.translate(chunk))))
    );
    chunksByText.forEach((item, index) => {
      this.rememberCache(item.text, (translated[index] ?? []).join(""));
    });
    return { _tag: "Translated", engine: "ondevice" };
  }

  async translateMany(texts: string[]): Promise<PageTranslateResult> {
    const google = await this.translateManyGoogle(texts);
    if (google.ok) {
      this.engine = "google";
      return { _tag: "Translated", engine: "google" };
    }
    if (isContextInvalidated(google.error)) return { _tag: "Invalidated" };
    const device = await this.translateManyOnDevice(texts);
    if (device._tag === "Translated") this.engine = "ondevice";
    return device;
  }

  applyCacheToNodes(nodes: Text[]): void {
    for (const node of nodes) {
      if (!node.isConnected) continue;
      const original = this.originals.get(node);
      if (original == null) continue;
      const translated = this.cachedTranslation(original);
      if (translated != null) node.nodeValue = translated;
    }
  }

  rememberNodes(nodes: Text[]): void {
    for (const node of nodes) {
      const current = node.nodeValue ?? "";
      const original = this.originals.get(node);
      const translated = original != null ? this.cachedTranslation(original) : undefined;
      if (!this.originals.has(node)) {
        this.originals.set(node, current);
      } else if (current !== original && current !== translated) {
        this.originals.set(node, current);
      }
    }
  }

  collectPending(nodes: Text[]): { visible: string[]; rest: string[] } {
    const visible: string[] = [];
    const rest: string[] = [];
    const seen = new Set<string>();
    const take = (text: string | undefined, bucket: string[]) => {
      if (!text || seen.has(text) || this.cachedTranslation(text)) return;
      if (!shouldTranslateText(text)) return;
      if (isAlreadyTargetLang(text, this.targetLang)) return;
      seen.add(text);
      bucket.push(text);
    };
    for (const node of nodes) {
      if (isNodeInViewport(node)) take(this.originals.get(node), visible);
    }
    for (const node of nodes) {
      take(this.originals.get(node), rest);
    }
    return { visible, rest };
  }

  finishVisible(nodes: Text[]): void {
    this.applyCacheToNodes(nodes);
    const translatedTitle = this.cachedTranslation(this.originalTitle);
    if (translatedTitle != null) document.title = translatedTitle;
    this.state = "translated";
    this.watchMutations();
  }

  async translateRemaining(token: number, rest: string[]): Promise<PageTranslateResult> {
    if (!rest.length) {
      this.report(1, "done");
      return { _tag: "Translated", engine: this.engine === "ondevice" ? "ondevice" : "google" };
    }
    const result = await this.translateMany(rest);
    if (token !== this.generation) return result;
    if (result._tag === "Translated") {
      this.applyCacheToNodes(collectTextNodes(document.body));
      this.report(1, "done");
    }
    return result;
  }

  async translatePage(sourceLang: string, targetLang: string): Promise<PageTranslateResult> {
    const token = ++this.generation;
    this.sourceLang = sourceLang || "auto";
    if (this.cacheTarget && this.cacheTarget !== targetLang) this.clearCache();
    this.targetLang = targetLang;
    this.cacheTarget = targetLang;
    this.state = "translating";
    this.report(0.05, "preparing");

    const nodes = collectTextNodes(document.body);
    this.rememberNodes(nodes);

    if (!this.originalTitle) this.originalTitle = document.title;
    const { visible, rest } = this.collectPending(nodes);
    if (
      this.originalTitle &&
      shouldTranslateText(this.originalTitle) &&
      !this.cachedTranslation(this.originalTitle) &&
      !visible.includes(this.originalTitle)
    ) {
      visible.unshift(this.originalTitle);
    }

    const visibleResult = await this.translateMany(visible);
    if (token !== this.generation) return visibleResult;
    if (visibleResult._tag !== "Translated") {
      this.state = "original";
      return visibleResult;
    }
    this.finishVisible(nodes);
    this.report(rest.length ? 0.65 : 1, "translating");
    void this.translateRemaining(token, rest).then((result) => {
      if (token !== this.generation) return;
      if (result._tag === "Translated" || result._tag === "Failed") this.report(1, "done");
    });
    return visibleResult;
  }

  restore(): void {
    this.generation += 1;
    this.state = "original";
    this.disconnectObserver();
    const nodes = collectTextNodes(document.body);
    for (const node of nodes) {
      const original = this.originals.get(node);
      if (original != null) node.nodeValue = original;
    }
    if (this.originalTitle) document.title = this.originalTitle;
    this.report(0, "restored");
  }

  watchMutations(): void {
    this.disconnectObserver();
    if (!document.body) return;
    this.observer = new MutationObserver(() => {
      if (!runtimeAlive()) {
        this.disconnectObserver();
        return;
      }
      if (this.state !== "translated") return;
      window.clearTimeout(this.pendingTimer);
      this.pendingTimer = window.setTimeout(() => {
        this.translateNewNodes().catch(() => {});
      }, 350);
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  async translateNewNodes(): Promise<void> {
    if (!runtimeAlive() || this.state !== "translated") return;
    const token = this.generation;
    const nodes = collectTextNodes(document.body);
    this.rememberNodes(nodes);
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const node of nodes) {
      const original = this.originals.get(node);
      if (!original || seen.has(original) || this.cachedTranslation(original)) continue;
      if (!shouldTranslateText(original)) continue;
      seen.add(original);
      unique.push(original);
    }
    if (unique.length) {
      if (token !== this.generation) return;
      const result = await this.translateMany(unique);
      if (result._tag !== "Translated") return;
    }
    if (token !== this.generation) return;
    this.applyCacheToNodes(nodes);
  }

  disconnectObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    window.clearTimeout(this.pendingTimer);
  }
}
