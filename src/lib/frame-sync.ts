export const FRAME_SYNC = "QT_FRAME_SYNC";

export type FrameSync =
  | { readonly type: typeof FRAME_SYNC; readonly action: "translate"; readonly targetLang: string }
  | { readonly type: typeof FRAME_SYNC; readonly action: "restore" }
  | { readonly type: typeof FRAME_SYNC; readonly action: "imageTranslate"; readonly enabled: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function isFrameSync(value: unknown): value is FrameSync {
  if (!isRecord(value) || value.type !== FRAME_SYNC) return false;
  if (value.action === "restore") return true;
  if (value.action === "imageTranslate") return typeof value.enabled === "boolean";
  return value.action === "translate" && typeof value.targetLang === "string";
}

export function pageHasIframes(): boolean {
  return document.querySelectorAll("iframe").length > 0;
}

export function shouldTranslateFrame(): boolean {
  if (window.innerWidth < 120 || window.innerHeight < 120) return false;
  const text = document.body?.innerText?.trim() ?? "";
  if (text.length >= 40) return true;
  return document.images.length > 0;
}

function postToIframes(message: FrameSync): void {
  Array.from(document.querySelectorAll("iframe")).forEach((frame) => {
    frame.contentWindow?.postMessage(message, "*");
  });
}

let lastSync: FrameSync | null = null;

export function broadcastFrameSync(message: FrameSync): void {
  if (message.action !== "imageTranslate") lastSync = message;
  postToIframes(message);
}

export function listenFrameSync(handler: (message: FrameSync) => void): () => void {
  const onMessage = (event: MessageEvent) => {
    if (!isFrameSync(event.data)) return;
    handler(event.data);
    postToIframes(event.data);
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}

export function watchNewIframes(): () => void {
  let timer = 0;
  const replay = () => {
    if (!lastSync) return;
    postToIframes(lastSync);
  };
  const observer = new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(replay, 300);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    window.clearTimeout(timer);
  };
}
