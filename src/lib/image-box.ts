function cssPx(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function objectOffset(token: string, container: number, object: number): number {
  if (token === "left" || token === "top") return 0;
  if (token === "right" || token === "bottom") return container - object;
  if (token === "center") return (container - object) / 2;
  if (token.endsWith("%")) return (container - object) * (cssPx(token) / 100);
  return cssPx(token);
}

/** Viewport rect of the painted image pixels, after padding, border, and object-fit. */
export function paintedImageRect(
  image: HTMLImageElement,
  naturalWidth: number,
  naturalHeight: number
): DOMRect {
  const box = image.getBoundingClientRect();
  const style = getComputedStyle(image);
  const left =
    box.left + cssPx(style.borderLeftWidth) + cssPx(style.paddingLeft);
  const top = box.top + cssPx(style.borderTopWidth) + cssPx(style.paddingTop);
  const contentW = Math.max(
    0,
    box.width -
      cssPx(style.borderLeftWidth) -
      cssPx(style.borderRightWidth) -
      cssPx(style.paddingLeft) -
      cssPx(style.paddingRight)
  );
  const contentH = Math.max(
    0,
    box.height -
      cssPx(style.borderTopWidth) -
      cssPx(style.borderBottomWidth) -
      cssPx(style.paddingTop) -
      cssPx(style.paddingBottom)
  );
  const nw = Math.max(1, naturalWidth);
  const nh = Math.max(1, naturalHeight);
  const fit = style.objectFit;
  let width = contentW;
  let height = contentH;
  if (fit !== "fill") {
    const contain = Math.min(contentW / nw, contentH / nh);
    const cover = Math.max(contentW / nw, contentH / nh);
    const scale =
      fit === "cover" ? cover : fit === "none" ? 1 : fit === "scale-down" ? Math.min(1, contain) : contain;
    width = nw * scale;
    height = nh * scale;
  }
  const pos = style.objectPosition.trim().split(/\s+/);
  const xToken = pos[0] ?? "50%";
  const yToken = pos[1] ?? (xToken === "left" || xToken === "right" || xToken === "center" ? "50%" : xToken);
  return new DOMRect(
    left + objectOffset(xToken, contentW, width),
    top + objectOffset(yToken, contentH, height),
    width,
    height
  );
}
