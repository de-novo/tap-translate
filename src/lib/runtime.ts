import { browser } from "wxt/browser";

export const runtimeAlive = (): boolean => {
  try {
    return Boolean(browser.runtime?.id);
  } catch {
    return false;
  }
};

export const isContextInvalidated = (error: unknown): boolean => {
  if (!runtimeAlive()) return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Extension context invalidated");
};
