import type { Effect } from "effect";
import type { DetectError, TranslateFailure } from "./errors";

export type { TranslateFailure };

export interface TranslationEngine {
  readonly id: string;
  translate(
    texts: readonly string[],
    sourceLang: string,
    targetLang: string
  ): Effect.Effect<readonly string[], TranslateFailure>;
  detect(sample: string): Effect.Effect<string, DetectError>;
}
