import { IMAGE_LAYER_ID, WIDGET_HOST_ID } from "./dom";

export { IMAGE_LAYER_ID };

const MIN_WIDTH = 80;
const MIN_HEIGHT = 36;
const MIN_AREA = 6000;
export const MAX_PAGE_IMAGES = 16;

export function collectPageImages(): HTMLImageElement[] {
  return Array.from(document.images).filter((image) => {
    if (!image.isConnected) return false;
    if (image.closest(`#${WIDGET_HOST_ID}, #${IMAGE_LAYER_ID}`)) return false;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (width < MIN_WIDTH || height < MIN_HEIGHT || width * height < MIN_AREA) return false;
    const rect = image.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 20) return false;
    const src = image.currentSrc || image.src;
    return Boolean(src) && !src.startsWith("chrome-extension:");
  });
}

export function isImageInViewport(image: HTMLImageElement): boolean {
  const rect = image.getBoundingClientRect();
  return (
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  );
}

export async function imageSource(image: HTMLImageElement): Promise<string> {
  const src = image.currentSrc || image.src;
  if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) return src;
  if (!src.startsWith("blob:")) return "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d");
    if (!context) return "";
    context.drawImage(image, 0, 0);
    return canvas.toDataURL();
  } catch {
    return "";
  }
}
