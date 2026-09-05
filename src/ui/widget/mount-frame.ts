import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { listenFrameSync, shouldTranslateFrame, type FrameSync } from "@/lib/frame-sync";
import { PageTranslator } from "@/lib/page-translator";
import { invalidatedMessage, runtimeAlive, scriptContextDead } from "@/lib/runtime";
import { loadSettings } from "@/lib/settings";

export async function mountFrameTranslator(ctx: ContentScriptContext): Promise<void> {
  if (window.top === window || !shouldTranslateFrame()) return;

  const translator = new PageTranslator();

  const apply = async (sync: FrameSync) => {
    if (scriptContextDead(ctx) || !runtimeAlive()) return;
    if (sync.action === "restore") {
      translator.restore();
      return;
    }
    if (!shouldTranslateFrame()) return;
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
    if (settings.alwaysTranslate.includes("*") && shouldTranslateFrame()) {
      await translator.translatePage("auto", settings.targetLang);
    }
  } catch (error) {
    if (!invalidatedMessage(error)) throw error;
  }
}
