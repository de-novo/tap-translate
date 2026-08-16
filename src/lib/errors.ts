import { Data, Match } from "effect";

export class TranslateHttpError extends Data.TaggedError("TranslateHttpError")<{
  readonly status: number;
}> {}

export class TranslateNetworkError extends Data.TaggedError("TranslateNetworkError") {}

export class TranslateParseError extends Data.TaggedError("TranslateParseError")<{
  readonly reason: string;
}> {}

export class DetectError extends Data.TaggedError("DetectError")<{
  readonly status?: number;
  readonly reason: string;
}> {}

export class StorageError extends Data.TaggedError("StorageError")<{
  readonly cause: unknown;
}> {}

export class UnsupportedEngine extends Data.TaggedError("UnsupportedEngine")<{
  readonly reason: string;
}> {}

export class ChromeQueryError extends Data.TaggedError("ChromeQueryError")<{
  readonly cause: unknown;
}> {}

export class ChromeMessageError extends Data.TaggedError("ChromeMessageError")<{
  readonly cause: unknown;
}> {}

export type TranslateFailure = TranslateHttpError | TranslateNetworkError | TranslateParseError;

export const translateUserMessage = (error: TranslateFailure): string =>
  Match.value(error).pipe(
    Match.tagsExhaustive({
      TranslateHttpError: ({ status }) => `translate http ${status}`,
      TranslateNetworkError: () => "network",
      TranslateParseError: ({ reason }) => reason
    })
  );

export const detectUserMessage = (error: DetectError): string => error.reason;
