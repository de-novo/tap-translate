import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { listenFrameSync, shouldTranslateFrame, type FrameSync } from "@/lib/frame-sync";
import { PageTranslator } from "@/lib/page-translator";
import { invalidatedMessage, runtimeAlive, scriptContextDead } from "@/lib/runtime";
import { loadSettings } from "@/lib/settings";
import { shouldStartTranslated } from "@/lib/site-translate";

export async function mountFrameTranslator(ctx: ContentScriptContext): Promise<void> {
  if (window.top === window || !shouldTranslateFrame()) return;

  const translator = new PageTranslator();

  const apply = async (sync: FrameSync) => {
    if (scriptContextDead(ctx) || !runtimeAlive()) return;
    if (sync.action === "restore") {
      translator.restore();
      return;
    }
    if (sync.action === "imageTranslate") {
      translator.setImageTranslate(sync.enabled);
      if (sync.enabled) translator.refreshImages();
      return;
    }
    if (!shouldTranslateFrame()) return;
    const settings = await loadSettings();
    translator.setImageTranslate(settings.imageTranslate);
    await translator.translatePage("auto", sync.targetLang);
  };

  const stop = listenFrameSync((sync) => {
    void apply(sync);
  });

  ctx.onInvalidated(() => {
    stop();
    translator.disconnectObserver();
  });

  try {
    const settings = await loadSettings();
    translator.setImageTranslate(settings.imageTranslate);
    if (
      shouldStartTranslated(location.hostname, settings.siteTranslate, settings.alwaysTranslate) &&
      shouldTranslateFrame()
    ) {
      await translator.translatePage("auto", settings.targetLang);
    }
  } catch (error) {
    if (!invalidatedMessage(error)) throw error;
  }
}
