import { Effect, Either, Schema } from "effect";
import { StorageError } from "./errors";
import { defaultTargetLang } from "./i18n";
import { isSupportedLang } from "./language";
import { loadSettings, saveSettings, type Settings } from "./settings";

export const PositionSchema = Schema.Struct({
  right: Schema.Number,
  bottom: Schema.Number
});

export const SettingsSchema = Schema.Struct({
  alwaysTranslate: Schema.Array(Schema.String),
  hiddenHosts: Schema.Array(Schema.String),
  position: PositionSchema,
  showFab: Schema.Boolean,
  targetLang: Schema.String
});

const toSettings = (decoded: Schema.Schema.Type<typeof SettingsSchema>): Settings => ({
  alwaysTranslate: [...decoded.alwaysTranslate],
  hiddenHosts: [...decoded.hiddenHosts],
  position: { ...decoded.position },
  showFab: decoded.showFab,
  targetLang: isSupportedLang(decoded.targetLang) ? decoded.targetLang : defaultTargetLang()
});

export const loadSettingsEffect: Effect.Effect<Settings, StorageError> = Effect.tryPromise({
  try: () => loadSettings(),
  catch: (cause) => new StorageError({ cause })
}).pipe(
  Effect.map((settings) => Schema.decodeUnknownEither(SettingsSchema)(settings)),
  Effect.flatMap((decoded) =>
    Either.match(decoded, {
      onLeft: (error) => Effect.fail(new StorageError({ cause: error })),
      onRight: (value) => Effect.succeed(toSettings(value))
    })
  )
);

export const saveSettingsEffect = (patch: Partial<Settings>): Effect.Effect<void, StorageError> =>
  Effect.tryPromise({
    try: () => saveSettings(patch),
    catch: (cause) => new StorageError({ cause })
  });
