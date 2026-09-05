import { decodeOcrResponse, type OcrResponse } from "./protocol";
import { runtimeUrl } from "./runtime";

const FRAME_ID = "qt-ocr-frame";
let ready: Promise<Window> | null = null;
let nextId = 1;

function frameWindow(): Promise<Window> {
  if (ready) return ready;
  const pending = new Promise<Window>((resolve, reject) => {
    const existing = document.getElementById(FRAME_ID);
    if (existing instanceof HTMLIFrameElement && existing.contentWindow && existing.dataset.ready === "1") {
      resolve(existing.contentWindow);
      return;
    }
    const url = runtimeUrl("/ocr.html");
    if (!url) {
      reject(new Error("ocr page unavailable"));
      return;
    }
    const iframe = existing instanceof HTMLIFrameElement ? existing : document.createElement("iframe");
    iframe.id = FRAME_ID;
    iframe.setAttribute("translate", "no");
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";
    const onReady = (event: MessageEvent) => {
      if (event.data?.type !== "QT_OCR_READY") return;
      if (event.source !== iframe.contentWindow) return;
      window.removeEventListener("message", onReady);
      iframe.dataset.ready = "1";
      if (iframe.contentWindow) resolve(iframe.contentWindow);
      else reject(new Error("ocr frame missing"));
    };
    window.addEventListener("message", onReady);
    iframe.addEventListener("error", () => reject(new Error("ocr frame failed")));
    iframe.src = url;
    if (!iframe.isConnected) (document.documentElement ?? document.body).append(iframe);
    window.setTimeout(() => reject(new Error("ocr frame timeout")), 15000);
  });
  ready = pending.catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

export async function recognizeImage(src: string, lang: string): Promise<OcrResponse> {
  const target = await frameWindow();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("ocr timeout"));
    }, 180000);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== target) return;
      if (event.data?.type !== "QT_OCR_RESULT" || event.data.id !== id) return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      const result = decodeOcrResponse(event.data.result);
      if (result) resolve(result);
      else reject(new Error("ocr failed"));
    };
    window.addEventListener("message", onMessage);
    target.postMessage({ type: "QT_OCR", id, src, lang }, "*");
  });
}

export function removeOcrFrame(): void {
  document.getElementById(FRAME_ID)?.remove();
  ready = null;
}
