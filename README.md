# Tap Translate

Open-source Chrome extension. Tap the floating chip to translate the current page in place, then drag it wherever you want.

Chrome-only, Manifest V3. No account and no first-party server. Translation goes from the extension service worker to Google’s public web translate endpoint.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Tooling | [WXT](https://wxt.dev) + Vite + TypeScript | Current recommended Chrome extension stack. File-based entrypoints, typed manifest, `pnpm dev` reload. |
| Service worker | [Effect](https://effect.website) 3.x | Translation, detect, Chrome I/O, and message dispatch are Effect programs. `for` / `let` stay out of this layer. |
| UI | React 19 + Tailwind + shadcn/ui | Shared tokens and components for popup and the Shadow DOM chip. Add new screens with `pnpm dlx shadcn@latest add`. |

## Develop

Requires Node 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev          # unpacked build with reload
pnpm build        # production build → .output/chrome-mv3
pnpm typecheck
pnpm locales      # regenerate public/_locales from scripts/build_locales.py
```

Load unpacked from `.output/chrome-mv3` in `chrome://extensions`. After you reload the extension, refresh the tab — an old content script cannot talk to a new service worker.

## Layout

```
src/
  entrypoints/          WXT entrypoints (background, content, popup)
  lib/                  typed core — no DOM widget code
    engine.ts           TranslationEngine interface for new backends
    google-translate.ts Effect client: batch, retry 429/503, concurrency 5
    worker.ts           message/command programs
    chrome.ts           Effect wrappers around tabs APIs
    settings.ts         chrome.storage.sync
    settings-effect.ts  optional Effect Schema decode
    translate-result.ts page-level Translated | Invalidated | Unsupported | Failed
    page-translator.ts  viewport-first page rewrite (content script, imperative DOM)
  components/ui/        shadcn primitives (button, select, card, …)
  styles/globals.css    Tailwind v4 + theme tokens (`:root` and `:host`)
  ui/
    shared/             LanguageSelect, settings hook
    widget/             floating chip (React + closed Shadow DOM)
    popup/              toolbar popup
public/                 icons + _locales
```

`chrome.storage.sync` keys are unchanged from 1.x (`targetLang`, `alwaysTranslate`, `hiddenHosts`, `position`, `showFab`), so existing installs keep their settings.

## Adding a translation engine

1. Implement `TranslationEngine` in `src/lib/engine.ts`.
2. Return `Effect.Effect<string[], TranslateFailure>` from `translate`.
3. Call it from `src/entrypoints/background.ts` the same way `googleTranslateEngine` is called.

The page translator talks to the background through `src/lib/protocol.ts`. It does not import a specific vendor.

The service worker is the functional core: `reduce` / `map` / `Effect.forEach` instead of `for` and `let`. Predictable failures are `Either` / `Option` (or the Effect error channel), then folded with `Either.match` / `Match.tagsExhaustive`. Chrome listeners in `background.ts` only call `Effect.runPromise`. DOM mutation in the content script is the exception, not the template for new backend code.

## Adding a UI component

```bash
pnpm dlx shadcn@latest add dialog
```

Files land in `src/components/ui/`. If the component uses a Radix portal (Dialog, Popover, Select, Dropdown), pass the Shadow DOM container through `useShadowPortal()` the same way `select.tsx` does, so menus stay inside the chip.

## License

MIT. See [LICENSE](LICENSE).
