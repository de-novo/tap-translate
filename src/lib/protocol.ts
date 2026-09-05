export const MessageType = {
  Translate: "QT_TRANSLATE",
  Detect: "QT_DETECT",
  Toggle: "QT_TOGGLE",
  Settings: "QT_SETTINGS",
  ShowSite: "QT_SHOW_SITE",
  Ocr: "QT_OCR"
} as const;

export type TranslateRequest = {
  readonly type: typeof MessageType.Translate;
  readonly texts: readonly string[];
  readonly sourceLang: string;
  readonly targetLang: string;
};

export type DetectRequest = {
  readonly type: typeof MessageType.Detect;
  readonly sample: string;
};

export type ToggleMessage = { readonly type: typeof MessageType.Toggle };
export type SettingsMessage = { readonly type: typeof MessageType.Settings };
export type ShowSiteMessage = { readonly type: typeof MessageType.ShowSite };

export type OcrLine = {
  readonly text: string;
  readonly confidence: number;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly rowHeight?: number;
  readonly bg?: string;
  readonly fg?: string;
};

export type OcrRequest = {
  readonly type: typeof MessageType.Ocr;
  readonly src: string;
  readonly lang: string;
};

export type OcrResponse =
  | { readonly ok: true; readonly width: number; readonly height: number; readonly lines: readonly OcrLine[] }
  | { readonly ok: false; readonly error: string };

export type WorkerRequest = TranslateRequest | DetectRequest;

export type ExtensionMessage =
  | TranslateRequest
  | DetectRequest
  | ToggleMessage
  | SettingsMessage
  | ShowSiteMessage
  | OcrRequest;

export type TranslateResponse =
  | { readonly ok: true; readonly translations: readonly string[] }
  | { readonly ok: false; readonly error: string };

export type DetectResponse =
  | { readonly ok: true; readonly language: string }
  | { readonly ok: false; readonly error: string };

export type WorkerResponse = TranslateResponse | DetectResponse;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export const isTranslateRequest = (value: unknown): value is TranslateRequest =>
  isRecord(value) &&
  value.type === MessageType.Translate &&
  isStringArray(value.texts) &&
  typeof value.sourceLang === "string" &&
  typeof value.targetLang === "string";

export const isDetectRequest = (value: unknown): value is DetectRequest =>
  isRecord(value) && value.type === MessageType.Detect && typeof value.sample === "string";

export const isToggleMessage = (value: unknown): value is ToggleMessage =>
  isRecord(value) && value.type === MessageType.Toggle;

export const isSettingsMessage = (value: unknown): value is SettingsMessage =>
  isRecord(value) && value.type === MessageType.Settings;

export const isShowSiteMessage = (value: unknown): value is ShowSiteMessage =>
  isRecord(value) && value.type === MessageType.ShowSite;

const isOcrLine = (value: unknown): value is OcrLine =>
  isRecord(value) &&
  typeof value.text === "string" &&
  typeof value.confidence === "number" &&
  typeof value.x0 === "number" &&
  typeof value.y0 === "number" &&
  typeof value.x1 === "number" &&
  typeof value.y1 === "number" &&
  (value.rowHeight === undefined || typeof value.rowHeight === "number") &&
  (value.bg === undefined || typeof value.bg === "string") &&
  (value.fg === undefined || typeof value.fg === "string");

export const isOcrRequest = (value: unknown): value is OcrRequest =>
  isRecord(value) &&
  value.type === MessageType.Ocr &&
  typeof value.src === "string" &&
  typeof value.lang === "string";

export const decodeOcrResponse = (value: unknown): OcrResponse | undefined => {
  if (!isRecord(value) || typeof value.ok !== "boolean") return undefined;
  if (value.ok && typeof value.width === "number" && typeof value.height === "number" && Array.isArray(value.lines)) {
    const lines = value.lines.filter(isOcrLine);
    return { ok: true, width: value.width, height: value.height, lines };
  }
  if (!value.ok && typeof value.error === "string") {
    return { ok: false, error: value.error };
  }
  return undefined;
};

export const isWorkerRequest = (value: unknown): value is WorkerRequest =>
  isTranslateRequest(value) || isDetectRequest(value);

export const decodeTranslateResponse = (value: unknown): TranslateResponse | undefined => {
  if (!isRecord(value) || typeof value.ok !== "boolean") return undefined;
  if (value.ok && isStringArray(value.translations)) {
    return { ok: true, translations: value.translations };
  }
  if (!value.ok && typeof value.error === "string") {
    return { ok: false, error: value.error };
  }
  return undefined;
};

export const decodeDetectResponse = (value: unknown): DetectResponse | undefined => {
  if (!isRecord(value) || typeof value.ok !== "boolean") return undefined;
  if (value.ok && typeof value.language === "string") {
    return { ok: true, language: value.language };
  }
  if (!value.ok && typeof value.error === "string") {
    return { ok: false, error: value.error };
  }
  return undefined;
};

export const matchTranslateResponse = <A>(
  response: TranslateResponse,
  handlers: {
    readonly onOk: (translations: readonly string[]) => A;
    readonly onError: (error: string) => A;
  }
): A => (response.ok ? handlers.onOk(response.translations) : handlers.onError(response.error));

export const matchDetectResponse = <A>(
  response: DetectResponse,
  handlers: {
    readonly onOk: (language: string) => A;
    readonly onError: (error: string) => A;
  }
): A => (response.ok ? handlers.onOk(response.language) : handlers.onError(response.error));
