import { invalidatedMessage, installContextGuard } from "@/lib/runtime";
import { mountFrameTranslator } from "@/ui/widget/mount-frame";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  allFrames: true,
  main(ctx) {
    installContextGuard();
    if (window.top === window) return;
    void mountFrameTranslator(ctx).catch((error) => {
      if (!invalidatedMessage(error)) console.error(error);
    });
  }
});
