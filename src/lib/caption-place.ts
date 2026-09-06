export type Rect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export type CaptionPlace = Rect & {
  readonly maxHeight: number;
  readonly side: "right" | "left" | "below" | "above";
};

export const CAPTION_GAP = 8;
export const CAPTION_MIN_SIDE = 180;
export const CAPTION_MAX_WIDTH = 280;
export const CAPTION_MIN_STACK = 72;
export const BADGE_SIZE = 36;
export const BADGE_INSET = 8;

const rightEdge = (box: Rect): number => box.left + box.width;
const bottomEdge = (box: Rect): number => box.top + box.height;

export function overlaps(a: Rect, b: Rect): boolean {
  return a.left < rightEdge(b) && rightEdge(a) > b.left && a.top < bottomEdge(b) && bottomEdge(a) > b.top;
}

export function captionBox(place: CaptionPlace): Rect {
  return { left: place.left, top: place.top, width: place.width, height: place.maxHeight };
}

export function placeBadge(image: Rect): Rect {
  const size = Math.min(BADGE_SIZE, Math.max(22, Math.min(image.width, image.height) * 0.18));
  const inset = Math.min(BADGE_INSET, Math.max(4, size * 0.22));
  return {
    left: image.left + image.width - size - inset,
    top: image.top + image.height - size - inset,
    width: size,
    height: size
  };
}

export function placeCaption(image: Rect, viewport: { width: number; height: number }): CaptionPlace {
  const gap = CAPTION_GAP;
  const rightRoom = viewport.width - rightEdge(image) - gap;
  const leftRoom = image.left - gap;
  const belowRoom = viewport.height - bottomEdge(image) - gap;
  const aboveRoom = image.top - gap;
  const sideTop = Math.min(Math.max(image.top, gap), Math.max(gap, viewport.height - CAPTION_MIN_STACK));

  if (rightRoom >= CAPTION_MIN_SIDE) {
    const width = Math.min(CAPTION_MAX_WIDTH, Math.max(CAPTION_MIN_SIDE, rightRoom - gap));
    return {
      left: rightEdge(image) + gap,
      top: sideTop,
      width: Math.min(width, rightRoom - gap),
      height: image.height,
      maxHeight: Math.max(CAPTION_MIN_STACK, Math.min(image.height, viewport.height - sideTop - gap)),
      side: "right"
    };
  }

  if (leftRoom >= CAPTION_MIN_SIDE) {
    const width = Math.min(CAPTION_MAX_WIDTH, Math.max(160, leftRoom - gap));
    const clamped = Math.min(width, leftRoom - gap);
    return {
      left: image.left - gap - clamped,
      top: sideTop,
      width: clamped,
      height: image.height,
      maxHeight: Math.max(CAPTION_MIN_STACK, Math.min(image.height, viewport.height - sideTop - gap)),
      side: "left"
    };
  }

  const width = Math.min(Math.max(image.width, 160), CAPTION_MAX_WIDTH + 40, Math.max(160, viewport.width - 16));
  const left = Math.min(Math.max(8, image.left), Math.max(8, viewport.width - width - 8));

  if (belowRoom >= CAPTION_MIN_STACK || belowRoom >= aboveRoom) {
    return {
      left,
      top: bottomEdge(image) + gap,
      width,
      height: Math.max(CAPTION_MIN_STACK, belowRoom),
      maxHeight: Math.max(CAPTION_MIN_STACK, belowRoom > 0 ? belowRoom : 160),
      side: "below"
    };
  }

  const maxHeight = Math.max(CAPTION_MIN_STACK, aboveRoom > 0 ? aboveRoom : 160);
  return {
    left,
    top: image.top - gap - maxHeight,
    width,
    height: maxHeight,
    maxHeight,
    side: "above"
  };
}
