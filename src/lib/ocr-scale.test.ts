import assert from "node:assert/strict";
import { test } from "node:test";
import { OCR_MAX_EDGE, ocrCanvasSize } from "./ocr-scale.ts";

test("ocrCanvasSize leaves small images alone", () => {
  assert.deepEqual(ocrCanvasSize(640, 240), { width: 640, height: 240, scale: 1 });
});

test("ocrCanvasSize shrinks a tweet screenshot so the long edge is the cap", () => {
  const size = ocrCanvasSize(1488, 1408);
  assert.equal(Math.max(size.width, size.height), OCR_MAX_EDGE);
  assert.ok(size.scale < 1);
  assert.ok(size.width < 1488);
});
