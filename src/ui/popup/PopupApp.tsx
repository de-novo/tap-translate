import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { applyDocumentLocale, t } from "@/lib/i18n";
import { notifyActiveTab } from "@/lib/messaging";
import { MessageType } from "@/lib/protocol";
import { hostFromUrl } from "../shared/host";
import { InputTranslateControls } from "../shared/InputTranslateControls";
import { LanguageSelect } from "../shared/LanguageSelect";
import { useSettings } from "../shared/useSettings";

export function PopupApp() {
  const { settings, update, ready } = useSettings();
  const [host, setHost] = useState("");

  useEffect(() => {
    applyDocumentLocale(document.documentElement);
    document.title = t("extName");
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setHost(hostFromUrl(tab?.url));
    });
  }, []);

  if (!ready || !settings) return null;

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform) || navigator.userAgent.includes("Mac");
  const hiddenHere = Boolean(host) && settings.hiddenHosts.includes(host);

  return (
    <div className="w-[280px] space-y-3.5 p-3.5">
      <header className="flex items-center gap-2.5">
        <div
          className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold"
          aria-hidden="true"
        >
          文A
        </div>
        <div>
          <h1 className="text-sm font-semibold">{t("extName")}</h1>
          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{t("popupTagline")}</p>
        </div>
      </header>

      <div className="space-y-1.5">
        <Label htmlFor="targetLang" className="text-muted-foreground text-xs font-normal">
          {t("targetLanguage")}
        </Label>
        <LanguageSelect
          id="targetLang"
          value={settings.targetLang}
          onChange={async (code) => {
            await update({ targetLang: code });
            await notifyActiveTab(MessageType.Settings);
          }}
        />
      </div>

      <InputTranslateControls
        enabled={settings.inputTranslate}
        targetLang={settings.inputTargetLang}
        onEnabled={async (next) => {
          await update({ inputTranslate: next });
          await notifyActiveTab(MessageType.Settings);
        }}
        onTargetLang={async (code) => {
          await update({ inputTargetLang: code });
          await notifyActiveTab(MessageType.Settings);
        }}
      />

      <Label className="font-normal">
        <Checkbox
          checked={settings.showFab}
          onCheckedChange={async (checked) => {
            await update({ showFab: checked === true });
            await notifyActiveTab(MessageType.Settings);
          }}
        />
        {t("showFloatingButton")}
      </Label>

      {hiddenHere && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={async () => {
            await update({ hiddenHosts: settings.hiddenHosts.filter((item) => item !== host) });
            await notifyActiveTab(MessageType.ShowSite);
          }}
        >
          {t("restoreOnThisSite")}
        </Button>
      )}

      <p className="text-muted-foreground text-xs leading-snug">{t("shortcutHint", [isMac ? "⌥⇧T" : "Alt+Shift+T"])}</p>
    </div>
  );
}
