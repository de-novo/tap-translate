import assert from "node:assert/strict";
import { test } from "node:test";
import { captionBox, overlaps, placeCaption, type Rect } from "./caption-place.ts";

const viewport = { width: 900, height: 700 };

test("placeCaption uses the right gutter when it is wide enough", () => {
  const image = { left: 20, top: 40, width: 300, height: 200 };
  const place = placeCaption(image, viewport);
  assert.equal(place.side, "right");
  assert.ok(place.left >= image.left + image.width);
  assert.equal(overlaps(image, captionBox(place)), false);
});

test("placeCaption uses the left gutter when only the left is wide", () => {
  const image = { left: 500, top: 40, width: 380, height: 200 };
  const place = placeCaption(image, { width: 900, height: 700 });
  assert.equal(place.side, "left");
  assert.ok(place.left + place.width <= image.left);
  assert.equal(overlaps(image, captionBox(place)), false);
});

test("placeCaption falls below when both sides are tight", () => {
  const image = { left: 10, top: 40, width: 780, height: 200 };
  const place = placeCaption(image, { width: 800, height: 700 });
  assert.equal(place.side, "below");
  assert.ok(place.top >= image.top + image.height);
  assert.equal(overlaps(image, captionBox(place)), false);
});

test("placeCaption sits above when the image sits on the bottom edge", () => {
  const image = { left: 10, top: 520, width: 780, height: 170 };
  const place = placeCaption(image, { width: 800, height: 700 });
  assert.equal(place.side, "above");
  assert.ok(place.top + place.maxHeight <= image.top);
  assert.equal(overlaps(image, captionBox(place)), false);
});

test("placeCaption never covers the image in the common page shapes", () => {
  const fixtures: Rect[] = [
    { left: 20, top: 40, width: 300, height: 200 },
    { left: 500, top: 40, width: 380, height: 200 },
    { left: 10, top: 40, width: 780, height: 200 },
    { left: 10, top: 520, width: 780, height: 170 },
    { left: 80, top: -40, width: 240, height: 180 }
  ];
  for (const image of fixtures) {
    assert.equal(overlaps(image, captionBox(placeCaption(image, viewport))), false);
  }
});
