import { MoreVerticalIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { collectTextNodes, shouldTranslateText } from "@/lib/dom";
import { defaultTargetLang, isRtl, t, uiLanguage } from "@/lib/i18n";
import { isAlreadyTargetLang, type LanguageCode } from "@/lib/language";
import type { PageTranslator } from "@/lib/page-translator";
import { isSettingsMessage, isShowSiteMessage, isToggleMessage } from "@/lib/protocol";
import { runtimeAlive } from "@/lib/runtime";
import { matchPageTranslate } from "@/lib/translate-result";
import type { Position } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { currentHost } from "../shared/host";
import { LanguageSelect } from "../shared/LanguageSelect";
import { useSettings } from "../shared/useSettings";
import { Grip } from "./Grip";
import { useDragPosition } from "./useDragPosition";

type Status = {
  text: string;
  actionLabel?: string;
  action?: () => void;
};

type WidgetAppProps = {
  translator: PageTranslator;
  onHide: () => void;
};

export function WidgetApp({ translator, onHide }: WidgetAppProps) {
  const { settings, update, reload, ready } = useSettings();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sourceLang, setSourceLang] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status | null>(null);
  const [translatorState, setTranslatorState] = useState(translator.state);
  const [hidden, setHidden] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [position, setPosition] = useState<Position>(settings?.position ?? { right: 20, bottom: 24 });
  const iconUrl = browser.runtime.getURL("/icons/icon48.png");

  useEffect(() => {
    if (settings?.position) setPosition(settings.position);
  }, [settings?.position]);

  const commitPosition = useCallback(
    (next: Position) => {
      setPosition(next);
      void update({ position: next });
    },
    [update]
  );

  const { dragging } = useDragPosition(wrapRef, position, setPosition, commitPosition);

  const syncTranslatorUi = useCallback(() => {
    setTranslatorState(translator.state);
    setProgress(translator.state === "translated" ? 1 : translator.state === "translating" ? 0.4 : 0);
  }, [translator]);

  const detectSource = useCallback(async () => {
    const detected = await translator.detectLanguage();
    const next = detected === "multi" ? "multi" : detected || "auto";
    setSourceLang(next);
    return next;
  }, [translator]);

  const selectedTarget = settings?.targetLang ?? defaultTargetLang();

  const pageHasForeignText = useCallback(
    (targetLang: string) =>
      collectTextNodes(document.body).some(
        (node) =>
          shouldTranslateText(node.nodeValue) && !isAlreadyTargetLang(node.nodeValue ?? "", targetLang)
      ),
    []
  );

  const openGoogleTranslate = useCallback(() => {
    const sl = sourceLang || "auto";
    const tl = settings?.targetLang || defaultTargetLang();
    const hl = uiLanguage();
    location.assign(
      `https://translate.google.com/translate?sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&hl=${encodeURIComponent(hl)}&u=${encodeURIComponent(location.href)}`
    );
  }, [settings?.targetLang, sourceLang]);

  const translateToTarget = useCallback(
    async (targetOverride?: string) => {
      if (busy || !settings) return;
      const targetLang = targetOverride ?? selectedTarget;
      let nextSource = sourceLang;
      if (!nextSource) {
        nextSource = "auto";
        setSourceLang("auto");
        void detectSource();
      }
      if (!pageHasForeignText(targetLang)) {
        setStatus({ text: t("alreadyTargetLanguage") });
        syncTranslatorUi();
        return;
      }

      setBusy(true);
      setExpanded(true);
      setStatus({ text: t("preparing") });
      translator.setProgressHandler((value) => {
        setProgress(value);
        setTranslatorState(translator.state);
      });
      const result = await translator.translatePage(nextSource, targetLang);
      matchPageTranslate(result, {
        onTranslated: () => setStatus(null),
        onInvalidated: () =>
          setStatus({
            text: t("translateFailed"),
            actionLabel: t("reloadPage"),
            action: () => location.reload()
          }),
        onUnsupported: () =>
          setStatus({
            text: t("apiUnsupported"),
            actionLabel: t("openGoogleTranslate"),
            action: openGoogleTranslate
          }),
        onFailed: () =>
          setStatus({
            text: t("translateFailed"),
            actionLabel: t("openGoogleTranslate"),
            action: openGoogleTranslate
          })
      });
      setBusy(false);
      syncTranslatorUi();
    },
    [
      busy,
      detectSource,
      openGoogleTranslate,
      pageHasForeignText,
      selectedTarget,
      settings,
      sourceLang,
      syncTranslatorUi,
      translator
    ]
  );

  const showOriginal = useCallback(() => {
    translator.restore();
    setStatus(null);
    syncTranslatorUi();
  }, [syncTranslatorUi, translator]);

  const onFabClick = useCallback(async () => {
    setExpanded(true);
    if (translator.state !== "translated") await translateToTarget();
  }, [translateToTarget, translator]);

  useEffect(() => {
    translator.setProgressHandler((value) => {
      setProgress(value);
      setTranslatorState(translator.state);
    });
    return () => {
      translator.setProgressHandler(null);
    };
  }, [translator]);

  useEffect(() => {
    if (!ready || !settings) return;
    if (!settings.showFab || settings.hiddenHosts.includes(currentHost())) {
      setHidden(true);
      return;
    }
    setHidden(false);
  }, [ready, settings]);

  useEffect(() => {
    if (!ready || !settings || hidden) return;
    let cancelled = false;
    void (async () => {
      await detectSource();
      if (cancelled) return;
      if (settings.alwaysTranslate.includes("*") && pageHasForeignText(settings.targetLang)) {
        setExpanded(true);
        await translateToTarget();
      }
    })();
    return () => {
      cancelled = true;
    };
    // First paint after settings load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, hidden]);

  useEffect(() => {
    const onMessage = (message: unknown) => {
      if (!runtimeAlive() || !message) return;
      if (isToggleMessage(message)) {
        if (translator.state === "translated") {
          showOriginal();
          setExpanded(true);
        } else {
          void onFabClick();
        }
      }
      if (isSettingsMessage(message) || isShowSiteMessage(message)) {
        void reload();
      }
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, [onFabClick, reload, showOriginal, translator]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  if (!ready || !settings || hidden) return null;

  const alwaysOn = settings.alwaysTranslate.includes("*");

  return (
    <div
      ref={wrapRef}
      className={cn(
        "pointer-events-auto fixed z-[2147483646] text-card-foreground select-none touch-none",
        dragging && "opacity-90 cursor-grabbing"
      )}
      dir={isRtl() ? "rtl" : "ltr"}
      lang={uiLanguage()}
      style={{
        right: position.right,
        bottom: position.bottom,
        left: "auto",
        top: "auto",
        visibility: fullscreen ? "hidden" : "visible"
      }}
    >
      {!expanded && (
        <div
          className="flex cursor-grab items-center gap-1.5 rounded-2xl border border-primary/35 bg-card p-1.5 pr-2 shadow-lg"
          title={t("moveButton")}
        >
          <Grip />
          <button
            type="button"
            className="size-9 overflow-hidden rounded-lg"
            title={t("translatePage")}
            onClick={() => void onFabClick()}
          >
            <img src={iconUrl} alt="" className="size-9" />
          </button>
        </div>
      )}

      {expanded && (
        <Card className="w-[min(280px,calc(100vw-24px))] gap-0 overflow-hidden py-0 shadow-xl" role="dialog" aria-label={t("translateDialog")}>
          <div className="flex cursor-grab items-center gap-2 px-2.5 py-2" title={t("moveButton")}>
            <Grip />
            <LanguageSelect
              className="h-8 min-w-0 flex-1 font-semibold"
              id="target-select"
              value={settings.targetLang}
              onChange={async (nextLang: LanguageCode) => {
                await update({ targetLang: nextLang });
                translator.clearCache();
                syncTranslatorUi();
                if (translator.state === "translated" || translator.state === "translating") {
                  translator.restore();
                  await translateToTarget(nextLang);
                }
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="menu-btn" title={t("moreOptions")} aria-label={t("moreOptions")}>
                  <MoreVerticalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={async () => {
                    const hosts = Array.from(new Set(settings.hiddenHosts.concat(currentHost())));
                    await update({ hiddenHosts: hosts });
                    onHide();
                  }}
                >
                  {t("hideOnThisSite")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon-sm"
              title={t("close")}
              aria-label={t("close")}
              onClick={() => setExpanded(false)}
            >
              <XIcon />
            </Button>
          </div>
          <Progress value={Math.max(0, Math.min(100, progress * 100))} className="h-[3px] rounded-none" />
          <CardContent className="space-y-3 px-2.5 pt-2.5 pb-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={translatorState !== "translated" ? "default" : "secondary"}
                size="sm"
                onClick={showOriginal}
              >
                {t("originalLanguage")}
              </Button>
              <Button
                type="button"
                variant={translatorState === "translated" ? "default" : "secondary"}
                size="sm"
                onClick={() => void translateToTarget()}
              >
                {t("translatePage")}
              </Button>
            </div>
            <Label className="text-muted-foreground font-normal">
              <Checkbox
                checked={alwaysOn}
                onCheckedChange={async (checked) => {
                  const next = settings.alwaysTranslate.filter((code) => code !== "*");
                  if (checked === true) next.push("*");
                  await update({ alwaysTranslate: next });
                }}
              />
              {t("alwaysTranslateForeign")}
            </Label>
            {status && (
              <p className="text-muted-foreground text-xs">
                {status.text}
                {status.actionLabel && status.action ? (
                  <>
                    {" "}
                    <Button variant="link" size="xs" className="h-auto px-0" onClick={status.action}>
                      {status.actionLabel}
                    </Button>
                  </>
                ) : null}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
