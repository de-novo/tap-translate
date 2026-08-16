import { Duration, Effect, Either, Option, Schedule } from "effect";
import type { TranslationEngine } from "./engine";
import {
  DetectError,
  TranslateHttpError,
  TranslateNetworkError,
  TranslateParseError,
  type TranslateFailure
} from "./errors";

const TRANSLATE_URL = "https://translate.googleapis.com/translate_a/t";
const DETECT_URL = "https://translate.googleapis.com/translate_a/single";
export const MAX_BATCH_CHARS = 8000;
export const MAX_BATCH_ITEMS = 40;
export const MAX_PARALLEL = 5;

type BatchAcc = {
  readonly batches: readonly (readonly string[])[];
  readonly current: readonly string[];
  readonly chars: number;
};

const emptyAcc: BatchAcc = { batches: [], current: [], chars: 0 };

const appendText = (state: BatchAcc, text: string): BatchAcc => {
  const size = text.length;
  const shouldFlush =
    state.current.length > 0 &&
    (state.current.length >= MAX_BATCH_ITEMS || state.chars + size > MAX_BATCH_CHARS);
  return {
    batches: shouldFlush ? [...state.batches, state.current] : state.batches,
    current: [...(shouldFlush ? [] : state.current), text],
    chars: (shouldFlush ? 0 : state.chars) + size
  };
};

export const splitBatches = (texts: readonly string[]): readonly (readonly string[])[] => {
  const { batches, current } = texts.reduce(appendText, emptyAcc);
  return current.length > 0 ? [...batches, current] : batches;
};

const itemToString = (item: unknown): string => {
  if (typeof item === "string") return item;
  if (Array.isArray(item) && typeof item[0] === "string") return item[0];
  return String(item ?? "");
};

const normalizeList = (
  data: unknown,
  expected: number
): Either.Either<readonly string[], TranslateParseError> => {
  if (typeof data === "string") return Either.right([data]);
  if (!Array.isArray(data)) {
    return Either.left(new TranslateParseError({ reason: "unexpected translate response" }));
  }
  const values = data.map(itemToString);
  return values.length === expected
    ? Either.right(values)
    : Either.left(new TranslateParseError({ reason: "translate count mismatch" }));
};

const isRetryableHttp = (error: TranslateFailure): boolean =>
  error._tag === "TranslateHttpError" && (error.status === 429 || error.status === 503);

const readJson = (response: Response): Effect.Effect<unknown, TranslateParseError> =>
  Effect.tryPromise({
    try: () => response.json() as Promise<unknown>,
    catch: () => new TranslateParseError({ reason: "invalid json" })
  });

const fetchJson = (url: string, init?: RequestInit): Effect.Effect<unknown, TranslateFailure> =>
  Effect.tryPromise({
    try: () => fetch(url, init),
    catch: () => new TranslateNetworkError()
  }).pipe(
    Effect.filterOrFail(
      (response) => response.ok,
      (response) => new TranslateHttpError({ status: response.status })
    ),
    Effect.flatMap(readJson)
  );

export const translateBatch = (
  texts: readonly string[],
  sourceLang: string,
  targetLang: string
): Effect.Effect<readonly string[], TranslateFailure> => {
  const params = new URLSearchParams({
    client: "gtx",
    sl: sourceLang || "auto",
    tl: targetLang || "en"
  });
  const body = texts.map((text) => "q=" + encodeURIComponent(text)).join("&");
  return fetchJson(`${TRANSLATE_URL}?${params.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body
  }).pipe(
    Effect.flatMap((data) =>
      Either.match(normalizeList(data, texts.length), {
        onLeft: (error) => Effect.fail(error),
        onRight: (values) => Effect.succeed(values)
      })
    ),
    Effect.retry({
      times: 2,
      schedule: Schedule.exponential(Duration.millis(250)),
      while: isRetryableHttp
    })
  );
};

export const translateTexts = (
  texts: readonly string[],
  sourceLang: string,
  targetLang: string
): Effect.Effect<readonly string[], TranslateFailure> =>
  Effect.forEach(splitBatches(texts), (batch) => translateBatch(batch, sourceLang, targetLang), {
    concurrency: MAX_PARALLEL
  }).pipe(Effect.map((parts) => parts.flat()));

const detectSample = (data: unknown): Option.Option<string> =>
  Array.isArray(data) && typeof data[2] === "string" ? Option.some(data[2]) : Option.none();

export const detectLanguage = (sample: string): Effect.Effect<string, DetectError> => {
  const params = new URLSearchParams({
    client: "gtx",
    sl: "auto",
    tl: "en",
    dt: "t",
    q: String(sample || "").slice(0, 800)
  });
  return Effect.tryPromise({
    try: () => fetch(`${DETECT_URL}?${params.toString()}`),
    catch: () => new DetectError({ reason: "network" })
  }).pipe(
    Effect.filterOrFail(
      (response) => response.ok,
      (response) =>
        new DetectError({
          status: response.status,
          reason: `detect http ${response.status}`
        })
    ),
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.json() as Promise<unknown>,
        catch: () => new DetectError({ reason: "invalid json" })
      })
    ),
    Effect.map((data) => Option.getOrElse(detectSample(data), () => ""))
  );
};

export const googleTranslateEngine: TranslationEngine = {
  id: "google",
  translate: translateTexts,
  detect: detectLanguage
};
