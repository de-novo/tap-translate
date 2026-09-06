import { createWorker, PSM, type Worker } from "tesseract.js";
import {
  contrastForeground,
  hexRgb,
  inflateBox,
  inflatePad,
  joinOcrLines,
  medianRgb,
  mergeRegions,
  type OcrRegion
} from "@/lib/ocr-layout";
import { ocrCanvasSize } from "@/lib/ocr-scale";
import { type OcrLine, type OcrResponse } from "@/lib/protocol";
import { runtimeUrl } from "@/lib/runtime";

type TessBbox = { x0: number; y0: number; x1: number; y1: number };

let worker: Worker | null = null;
let workerLang = "";

async function tessWorker(lang: string): Promise<Worker> {
  if (worker && workerLang === lang) return worker;
  await worker?.terminate();
  worker = null;
  const next = await createWorker(lang, 1, {
    workerPath: runtimeUrl("/tesseract/worker.min.js"),
    corePath: runtimeUrl("/tesseract/"),
    workerBlobURL: false,
    gzip: true
  });
  await next.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: "1"
  });
  worker = next;
  workerLang = lang;
  return next;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pixel(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  x: number,
  y: number
): [number, number, number] {
  const px = clamp(Math.round(x), 0, width - 1);
  const py = clamp(Math.round(y), 0, height - 1);
  const data = context.getImageData(px, py, 1, 1).data;
  return [data[0] ?? 255, data[1] ?? 255, data[2] ?? 255];
}

function samplePaint(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  box: TessBbox
): { bg: string; fg: string } {
  const pad = 3;
  const samples: Array<[number, number, number]> = [];
  const spanX = Math.max(1, box.x1 - box.x0);
  const spanY = Math.max(1, box.y1 - box.y0);
  const stepsX = Math.max(6, Math.min(24, Math.round(spanX / 8)));
  const stepsY = Math.max(4, Math.min(16, Math.round(spanY / 8)));
  for (let i = 0; i <= stepsX; i += 1) {
    const x = box.x0 + (spanX * i) / stepsX;
    samples.push(pixel(context, width, height, x, box.y0 - pad));
    samples.push(pixel(context, width, height, x, box.y1 + pad));
  }
  for (let i = 0; i <= stepsY; i += 1) {
    const y = box.y0 + (spanY * i) / stepsY;
    samples.push(pixel(context, width, height, box.x0 - pad, y));
    samples.push(pixel(context, width, height, box.x1 + pad, y));
  }
  const [r, g, b] = medianRgb(samples);
  return { bg: hexRgb(r, g, b), fg: contrastForeground(r, g, b) };
}

function rowHeightOf(line: { bbox: TessBbox; rowAttributes?: { rowHeight?: number } }): number {
  const fromRow = line.rowAttributes?.rowHeight;
  if (fromRow && fromRow > 0) return fromRow;
  return Math.max(8, line.bbox.y1 - line.bbox.y0);
}

async function recognize(src: string, lang: string): Promise<OcrResponse> {
  const blob = await (await fetch(src)).blob();
  const bitmap = await createImageBitmap(blob);
  const sized = ocrCanvasSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = sized.width;
  canvas.height = sized.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context?.drawImage(bitmap, 0, 0, sized.width, sized.height);
  bitmap.close();
  const tess = await tessWorker(lang);
  const result = await tess.recognize(canvas, {}, { text: true, blocks: true });
  const width = sized.width;
  const height = sized.height;
  const regions: OcrRegion[] = [];
  for (const block of result.data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      const lines = paragraph.lines.filter((line) => line.text.trim());
      if (!lines.length) continue;
      const text = joinOcrLines(lines.map((line) => line.text));
      if (!text) continue;
      const heights = lines.map(rowHeightOf).sort((a, b) => a - b);
      const rowHeight = heights[Math.floor(heights.length / 2)] ?? 16;
      regions.push({
        text,
        confidence: paragraph.confidence,
        x0: paragraph.bbox.x0,
        y0: paragraph.bbox.y0,
        x1: paragraph.bbox.x1,
        y1: paragraph.bbox.y1,
        rowHeight
      });
    }
  }
  const lines: OcrLine[] = mergeRegions(regions).map((region) => {
    const box = inflateBox(region, width, height, inflatePad(region.rowHeight));
    const colors = context ? samplePaint(context, width, height, box) : { bg: "#ffffff", fg: "#1a1a1a" };
    return {
      text: region.text,
      confidence: region.confidence,
      x0: box.x0,
      y0: box.y0,
      x1: box.x1,
      y1: box.y1,
      rowHeight: region.rowHeight,
      bg: colors.bg,
      fg: colors.fg
    };
  });
  return { ok: true, width, height, lines };
}

const reply = (source: MessageEventSource | null, payload: unknown): void => {
  source?.postMessage(payload, { targetOrigin: "*" });
};

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "QT_OCR" || typeof data.src !== "string" || typeof data.lang !== "string") return;
  void recognize(data.src, data.lang)
    .then((result) => reply(event.source, { type: "QT_OCR_RESULT", id: data.id, result }))
    .catch((error: unknown) => {
      reply(event.source, {
        type: "QT_OCR_RESULT",
        id: data.id,
        result: { ok: false, error: error instanceof Error ? error.message : String(error) }
      });
    });
});

window.parent.postMessage({ type: "QT_OCR_READY" }, "*");
