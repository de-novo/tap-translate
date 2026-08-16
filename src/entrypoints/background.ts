import { Effect, Option } from "effect";
import { handleCommand, handleWorkerMessage } from "../lib/worker";

export default defineBackground(() => {
  browser.commands.onCommand.addListener((command) => {
    void Effect.runPromise(handleCommand(command));
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void Effect.runPromise(handleWorkerMessage(message)).then((response) =>
      Option.match(response, {
        onNone: () => undefined,
        onSome: sendResponse
      })
    );
    return true;
  });
});
