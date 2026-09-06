export const OCR_MAX_EDGE = 1280;

export function ocrCanvasSize(
  width: number,
  height: number,
  maxEdge = OCR_MAX_EDGE
): { width: number; height: number; scale: number } {
  const edge = Math.max(width, height);
  if (edge <= maxEdge) return { width, height, scale: 1 };
  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale
  };
}
