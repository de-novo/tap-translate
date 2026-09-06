export type PaintLine = {
  readonly translated: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly bg?: string;
  readonly fg?: string;
};

export function paintTranslatedImage(
  image: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  ocrWidth: number,
  ocrHeight: number,
  lines: readonly PaintLine[]
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, naturalWidth);
  canvas.height = Math.max(1, naturalHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const scaleX = canvas.width / Math.max(1, ocrWidth);
  const scaleY = canvas.height / Math.max(1, ocrHeight);
  for (const line of lines) {
    const x = line.x0 * scaleX;
    const y = line.y0 * scaleY;
    const width = Math.max(8, (line.x1 - line.x0) * scaleX);
    const height = Math.max(8, (line.y1 - line.y0) * scaleY);
    ctx.fillStyle = line.bg ?? "#ffffff";
    ctx.fillRect(x, y, width, height);
    drawFitted(ctx, line.translated, x, y, width, height, line.fg ?? "#1a1a1a");
  }
  return canvas;
}

function drawFitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): void {
  const pad = 3;
  const maxWidth = Math.max(8, width - pad * 2);
  const maxHeight = Math.max(8, height - pad * 2);
  let size = Math.max(8, Math.min(height * 0.78, 48));
  let lines: string[] = [text];
  for (let i = 0; i < 12; i += 1) {
    ctx.font = `600 ${size}px ui-sans-serif,system-ui,"Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
    lines = wrapText(ctx, text, maxWidth);
    if (lines.length * size * 1.15 <= maxHeight) break;
    size = Math.max(8, size - 1);
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineHeight = size * 1.15;
  const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  const midX = x + width / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, midX, startY + index * lineHeight, maxWidth);
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    const next = current + ch;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = ch.trim() ? ch : "";
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}
