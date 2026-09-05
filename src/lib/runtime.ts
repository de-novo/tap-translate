import { browser } from "wxt/browser";

export const runtimeAlive = (): boolean => {
  try {
    return Boolean(browser.runtime?.id);
  } catch {
    return false;
  }
};

export const invalidatedMessage = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Extension context invalidated");
};

export const isContextInvalidated = (error: unknown): boolean =>
  invalidatedMessage(error) || !runtimeAlive();

export const scriptContextDead = (ctx?: { readonly signal?: AbortSignal }): boolean =>
  Boolean(ctx?.signal?.aborted);

export const runtimeUrl = (path: `/${string}`): string => {
  try {
    if (!runtimeAlive()) return "";
    return (browser.runtime.getURL as (next: string) => string)(path);
  } catch {
    return "";
  }
};

export const ignoreChrome = (fn: () => void): void => {
  try {
    fn();
  } catch (error) {
    if (!invalidatedMessage(error)) throw error;
  }
};

let guardInstalled = false;

export const installContextGuard = (): void => {
  if (guardInstalled) return;
  guardInstalled = true;
  const silence = (error: unknown): boolean => invalidatedMessage(error);
  window.addEventListener(
    "error",
    (event) => {
      if (!silence(event.error ?? event.message)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );
  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (!silence(event.reason)) return;
      event.preventDefault();
    },
    true
  );
};
