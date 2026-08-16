export const MessageType = {
  Translate: "QT_TRANSLATE",
  Detect: "QT_DETECT",
  Toggle: "QT_TOGGLE",
  Settings: "QT_SETTINGS",
  ShowSite: "QT_SHOW_SITE"
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

export type WorkerRequest = TranslateRequest | DetectRequest;

export type ExtensionMessage =
  | TranslateRequest
  | DetectRequest
  | ToggleMessage
  | SettingsMessage
  | ShowSiteMessage;

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
