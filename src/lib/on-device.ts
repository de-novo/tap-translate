export type OnDeviceFailure = "unsupported" | "unavailable";

export type CreateOnDeviceResult =
  | { readonly ok: true; readonly translator: OnDeviceTranslator }
  | { readonly ok: false; readonly reason: OnDeviceFailure };

type TranslatorAvailability = "unavailable" | "downloadable" | "downloading" | "available";

export interface OnDeviceTranslator {
  translate(text: string): Promise<string>;
}

interface TranslatorStatic {
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<TranslatorAvailability>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<OnDeviceTranslator>;
}

const translatorApi = (): TranslatorStatic | undefined =>
  (globalThis as { Translator?: TranslatorStatic }).Translator;

export const onDeviceAvailable = (): boolean => Boolean(translatorApi());

export const createOnDeviceTranslator = (
  sourceLang: string,
  targetLang: string
): Promise<CreateOnDeviceResult> => {
  const api = translatorApi();
  if (!api) return Promise.resolve({ ok: false, reason: "unsupported" });
  return api
    .availability({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang
    })
    .then((availability): Promise<CreateOnDeviceResult> => {
      if (availability === "unavailable") {
        return Promise.resolve({ ok: false, reason: "unavailable" });
      }
      return api
        .create({
          sourceLanguage: sourceLang,
          targetLanguage: targetLang
        })
        .then((translator): CreateOnDeviceResult => ({ ok: true, translator }));
    })
    .catch((): CreateOnDeviceResult => ({ ok: false, reason: "unavailable" }));
};
