import { browser } from "wxt/browser";
import {
  decodeDetectResponse,
  decodeTranslateResponse,
  MessageType,
  type DetectResponse,
  type TranslateResponse
} from "./protocol";
import { isContextInvalidated, runtimeAlive } from "./runtime";

const invalidatedTranslate: TranslateResponse = {
  ok: false,
  error: "Extension context invalidated."
};

const invalidatedDetect: DetectResponse = {
  ok: false,
  error: "Extension context invalidated."
};

export const requestTranslations = async (
  texts: readonly string[],
  sourceLang: string,
  targetLang: string
): Promise<TranslateResponse> => {
  if (!runtimeAlive()) return invalidatedTranslate;
  return browser.runtime
    .sendMessage({
      type: MessageType.Translate,
      texts,
      sourceLang,
      targetLang
    })
    .then(
      (raw) => decodeTranslateResponse(raw) ?? { ok: false, error: "google translate failed" },
      (error) => (isContextInvalidated(error) ? invalidatedTranslate : { ok: false, error: String(error) })
    );
};

export const requestDetect = async (sample: string): Promise<DetectResponse> => {
  if (!runtimeAlive()) return invalidatedDetect;
  return browser.runtime.sendMessage({ type: MessageType.Detect, sample }).then(
    (raw) => decodeDetectResponse(raw) ?? { ok: false, error: "detect failed" },
    (error) => (isContextInvalidated(error) ? invalidatedDetect : { ok: false, error: String(error) })
  );
};

export const notifyActiveTab = async (
  type: typeof MessageType.Settings | typeof MessageType.ShowSite
): Promise<{ readonly ok: true } | { readonly ok: false }> => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return { ok: false };
  return browser.tabs.sendMessage(tab.id, { type }).then(
    () => ({ ok: true }),
    () => ({ ok: false })
  );
};
