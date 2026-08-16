import { createRoot, type Root } from "react-dom/client";
import { browser } from "wxt/browser";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { ShadowPortalProvider } from "@/components/shadow-portal";
import { WIDGET_HOST_ID } from "@/lib/dom";
import { PageTranslator } from "@/lib/page-translator";
import { isSettingsMessage, isShowSiteMessage } from "@/lib/protocol";
import { runtimeAlive } from "@/lib/runtime";
import { loadSettings } from "@/lib/settings";
import { currentHost } from "../shared/host";
import { WidgetApp } from "./WidgetApp";

export async function mountFloatingWidget(ctx: ContentScriptContext): Promise<void> {
  if (document.getElementById(WIDGET_HOST_ID)) return;

  const translator = new PageTranslator();
  const ui = await createShadowRootUi(ctx, {
    name: "tap-translate",
    position: "inline",
    anchor: "html",
    mode: "closed",
    isolateEvents: ["keydown", "keyup", "keypress"],
    onMount(container, _shadow, host) {
      host.id = WIDGET_HOST_ID;
      host.setAttribute("translate", "no");
      host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483646";
      const app = document.createElement("div");
      container.append(app);
      const root = createRoot(app);
      root.render(
        <ShadowPortalProvider container={container}>
          <div className="dark contents">
            <WidgetApp translator={translator} onHide={() => ui.remove()} />
          </div>
        </ShadowPortalProvider>
      );
      return root;
    },
    onRemove(root: Root | undefined) {
      translator.disconnectObserver();
      root?.unmount();
    }
  });

  const applyVisibility = async () => {
    if (ctx.isInvalid || !runtimeAlive()) return;
    const settings = await loadSettings();
    const hidden = !settings.showFab || settings.hiddenHosts.includes(currentHost());
    if (hidden) ui.remove();
    else ui.mount();
  };

  const onMessage = (message: unknown) => {
    if (!runtimeAlive() || ctx.isInvalid) return;
    if (isSettingsMessage(message) || isShowSiteMessage(message)) void applyVisibility();
  };

  browser.runtime.onMessage.addListener(onMessage);
  browser.storage.onChanged.addListener((changes, area) => {
    if (!runtimeAlive() || ctx.isInvalid || area !== "sync") return;
    if (changes.showFab || changes.hiddenHosts) void applyVisibility();
  });

  ctx.onInvalidated(() => {
    browser.runtime.onMessage.removeListener(onMessage);
    ui.remove();
  });

  await applyVisibility();
}
