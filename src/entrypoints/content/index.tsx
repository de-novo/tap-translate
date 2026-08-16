import { mountFloatingWidget } from "@/ui/widget/mount";
import "@/styles/globals.css";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  cssInjectionMode: "ui",
  main(ctx) {
    if (window.top !== window) return;
    void mountFloatingWidget(ctx);
  }
});
