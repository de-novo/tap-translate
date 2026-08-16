import { Effect, Either, Match, Option } from "effect";
import { queryActiveTab, sendTabMessage } from "./chrome";
import { detectUserMessage, translateUserMessage } from "./errors";
import { detectLanguage, translateTexts } from "./google-translate";
import {
  isWorkerRequest,
  MessageType,
  type DetectRequest,
  type DetectResponse,
  type TranslateRequest,
  type TranslateResponse,
  type WorkerRequest,
  type WorkerResponse
} from "./protocol";

const respondTranslate = (request: TranslateRequest): Effect.Effect<TranslateResponse> =>
  translateTexts(request.texts, request.sourceLang, request.targetLang).pipe(
    Effect.either,
    Effect.map((result) =>
      Either.match(result, {
        onLeft: (error): TranslateResponse => ({ ok: false, error: translateUserMessage(error) }),
        onRight: (translations): TranslateResponse => ({ ok: true, translations })
      })
    )
  );

const respondDetect = (request: DetectRequest): Effect.Effect<DetectResponse> =>
  detectLanguage(request.sample).pipe(
    Effect.either,
    Effect.map((result) =>
      Either.match(result, {
        onLeft: (error): DetectResponse => ({ ok: false, error: detectUserMessage(error) }),
        onRight: (language): DetectResponse => ({ ok: true, language })
      })
    )
  );

const dispatchRequest = (request: WorkerRequest): Effect.Effect<WorkerResponse> =>
  Match.value(request).pipe(
    Match.when({ type: MessageType.Translate }, respondTranslate),
    Match.when({ type: MessageType.Detect }, respondDetect),
    Match.exhaustive
  );

export const handleWorkerMessage = (message: unknown): Effect.Effect<Option.Option<WorkerResponse>> =>
  Option.liftPredicate(isWorkerRequest)(message).pipe(
    Option.match({
      onNone: () => Effect.succeed(Option.none()),
      onSome: (request) => dispatchRequest(request).pipe(Effect.map(Option.some))
    })
  );

const toggleActiveTab = queryActiveTab.pipe(
  Effect.either,
  Effect.flatMap((result) =>
    Either.match(result, {
      onLeft: () => Effect.void,
      onRight: (tab) =>
        Option.match(tab, {
          onNone: () => Effect.void,
          onSome: (active) => sendTabMessage(active.id, { type: MessageType.Toggle }).pipe(Effect.either, Effect.asVoid)
        })
    })
  )
);

export const handleCommand = (command: string): Effect.Effect<void> =>
  Match.value(command).pipe(
    Match.when("toggle-translate", () => toggleActiveTab),
    Match.orElse(() => Effect.void)
  );
