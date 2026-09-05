import { createRoot, type Root } from "react-dom/client";
import { browser } from "wxt/browser";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { ShadowPortalProvider } from "@/components/shadow-portal";
import { WIDGET_HOST_ID } from "@/lib/dom";
import { PageTranslator } from "@/lib/page-translator";
import { invalidatedMessage, runtimeAlive, scriptContextDead } from "@/lib/runtime";
import { WidgetApp } from "./WidgetApp";

const HOST_CSS =
  ":host{all:initial!important;display:block!important;position:fixed!important;inset:0!important;width:100%!important;height:100%!important;pointer-events:none!important;overflow:visible!important;z-index:2147483646!important;}";

function clearStaleWidgetHost(): void {
  document.getElementById(WIDGET_HOST_ID)?.remove();
  Array.from(document.querySelectorAll("tap-translate")).forEach((node) => node.remove());
}

async function widgetCss(): Promise<string> {
  if (!runtimeAlive()) return HOST_CSS;
  try {
    const url = (browser.runtime.getURL as (path: string) => string)("/content-scripts/content.css");
    const text = await (await fetch(url)).text();
    return `${HOST_CSS}\n${text.replaceAll(":root", ":host")}`;
  } catch (error) {
    if (!invalidatedMessage(error)) console.error(error);
    return HOST_CSS;
  }
}

function attachHost(host: HTMLElement): void {
  const root = document.documentElement ?? document.body;
  if (!root || host.isConnected) return;
  root.append(host);
}

export async function mountFloatingWidget(ctx: ContentScriptContext): Promise<void> {
  if (scriptContextDead(ctx)) return;
  clearStaleWidgetHost();

  const host = document.createElement("div");
  host.id = WIDGET_HOST_ID;
  host.setAttribute("translate", "no");
  host.style.cssText =
    "display:block;position:fixed;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:2147483646;";

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = await widgetCss();
  const app = document.createElement("div");
  app.style.cssText = "position:relative;width:100%;height:100%;pointer-events:none;";
  shadow.append(style, app);
  attachHost(host);

  const translator = new PageTranslator();
  const root: Root = createRoot(app, {
    onUncaughtError(error) {
      if (!invalidatedMessage(error)) console.error(error);
    },
    onCaughtError(error) {
      if (!invalidatedMessage(error)) console.error(error);
    }
  });
  root.render(
    <ShadowPortalProvider container={app}>
      <div className="dark" style={{ position: "relative", width: "100%", height: "100%", pointerEvents: "none" }}>
        <WidgetApp translator={translator} onHide={() => undefined} />
      </div>
    </ShadowPortalProvider>
  );

  const observer = new MutationObserver(() => {
    if (scriptContextDead(ctx)) return;
    if (!host.isConnected) attachHost(host);
  });
  observer.observe(document.documentElement, { childList: true });

  ctx.onInvalidated(() => {
    observer.disconnect();
    translator.disconnectObserver();
    root.unmount();
    host.remove();
  });
}
