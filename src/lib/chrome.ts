import { Effect, Option } from "effect";
import { browser } from "wxt/browser";
import { ChromeMessageError, ChromeQueryError } from "./errors";

export type ActiveTab = {
  readonly id: number;
  readonly url?: string;
};

export const queryActiveTab: Effect.Effect<Option.Option<ActiveTab>, ChromeQueryError> = Effect.tryPromise({
  try: () => browser.tabs.query({ active: true, currentWindow: true }),
  catch: (cause) => new ChromeQueryError({ cause })
}).pipe(
  Effect.map((tabs) =>
    Option.fromNullable(tabs[0]).pipe(
      Option.filter((tab): tab is typeof tab & { id: number } => typeof tab.id === "number"),
      Option.map((tab) => ({ id: tab.id, url: tab.url }))
    )
  )
);

export const sendTabMessage = (tabId: number, message: unknown): Effect.Effect<unknown, ChromeMessageError> =>
  Effect.tryPromise({
    try: () => browser.tabs.sendMessage(tabId, message),
    catch: (cause) => new ChromeMessageError({ cause })
  });
