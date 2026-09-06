import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contrastForeground,
  hexRgb,
  inflateBox,
  joinOcrLines,
  looksLikeOcrNoise,
  medianRgb,
  mergeRegions,
  type OcrRegion
} from "./ocr-layout.ts";

const region = (partial: Partial<OcrRegion> & Pick<OcrRegion, "text" | "x0" | "y0" | "x1" | "y1">): OcrRegion => ({
  confidence: 80,
  rowHeight: 24,
  ...partial
});

test("joinOcrLines keeps English word spaces", () => {
  assert.equal(joinOcrLines(["How to get started", "with the new API"]), "How to get started with the new API");
});

test("joinOcrLines keeps Korean spaces and omits Chinese spaces", () => {
  assert.equal(joinOcrLines(["새로운", "API"]), "새로운 API");
  assert.equal(joinOcrLines(["오늘 날씨가", "좋다"]), "오늘 날씨가 좋다");
  assert.equal(joinOcrLines(["今天", "天气很好"]), "今天天气很好");
});

test("mergeRegions joins stacked sign lines into one sentence", () => {
  const merged = mergeRegions([
    region({ text: "WELCOME TO", x0: 20, y0: 10, x1: 220, y1: 40, rowHeight: 28 }),
    region({ text: "NEW YORK", x0: 40, y0: 46, x1: 200, y1: 78, rowHeight: 30 })
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.text, "WELCOME TO NEW YORK");
  assert.equal(merged[0]?.y0, 10);
  assert.equal(merged[0]?.y1, 78);
});

test("mergeRegions joins same-row fragments", () => {
  const merged = mergeRegions([
    region({ text: "Tap", x0: 10, y0: 8, x1: 50, y1: 32, rowHeight: 22 }),
    region({ text: "once", x0: 58, y0: 9, x1: 110, y1: 33, rowHeight: 22 })
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.text, "Tap once");
});

test("mergeRegions leaves distant caption separate", () => {
  const merged = mergeRegions([
    region({ text: "Headline on the photo", x0: 20, y0: 10, x1: 300, y1: 40, rowHeight: 24 }),
    region({ text: "tiny caption", x0: 20, y0: 220, x1: 140, y1: 238, rowHeight: 16 })
  ]);
  assert.equal(merged.length, 2);
});

test("mergeRegions does not fuse two columns", () => {
  const merged = mergeRegions([
    region({ text: "Left column body", x0: 10, y0: 10, x1: 120, y1: 200, rowHeight: 18 }),
    region({ text: "Right column body", x0: 220, y0: 12, x1: 330, y1: 198, rowHeight: 18 })
  ]);
  assert.equal(merged.length, 2);
});

test("looksLikeOcrNoise rejects glyph soup", () => {
  assert.equal(looksLikeOcrNoise("OK"), false);
  assert.equal(looksLikeOcrNoise("Hello, world"), false);
  assert.equal(looksLikeOcrNoise("||| __ /\\"), true);
  assert.equal(looksLikeOcrNoise("A"), true);
});

test("contrastForeground picks dark text on light paint", () => {
  assert.equal(contrastForeground(250, 250, 248), "#1a1a1a");
  assert.equal(contrastForeground(20, 40, 18), "#f8fafc");
});

test("medianRgb takes the middle luminance sample", () => {
  assert.deepEqual(
    medianRgb([
      [0, 0, 0],
      [10, 200, 10],
      [250, 250, 250]
    ]),
    [10, 200, 10]
  );
});

test("inflateBox clamps to the image", () => {
  assert.deepEqual(inflateBox({ x0: 2, y0: 2, x1: 20, y1: 10 }, 40, 30, 4), {
    x0: 0,
    y0: 0,
    x1: 24,
    y1: 14
  });
});

test("hexRgb pads channels", () => {
  assert.equal(hexRgb(0, 15, 255), "#000fff");
});
