export type PageTranslateResult =
  | { readonly _tag: "Translated"; readonly engine: "google" | "ondevice" }
  | { readonly _tag: "Invalidated" }
  | { readonly _tag: "Unsupported" }
  | { readonly _tag: "Failed"; readonly message: string };

export const matchPageTranslate = <A>(
  result: PageTranslateResult,
  handlers: {
    readonly onTranslated: (engine: "google" | "ondevice") => A;
    readonly onInvalidated: () => A;
    readonly onUnsupported: () => A;
    readonly onFailed: (message: string) => A;
  }
): A => {
  switch (result._tag) {
    case "Translated":
      return handlers.onTranslated(result.engine);
    case "Invalidated":
      return handlers.onInvalidated();
    case "Unsupported":
      return handlers.onUnsupported();
    case "Failed":
      return handlers.onFailed(result.message);
  }
};
