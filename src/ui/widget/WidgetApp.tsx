import { ChevronDownIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { collectTextNodes, shouldTranslateText, WIDGET_HOST_ID } from "@/lib/dom";
import { collectPageImages } from "@/lib/image-targets";
import { broadcastFrameSync, FRAME_SYNC, pageHasIframes, watchNewIframes } from "@/lib/frame-sync";
import { defaultTargetLang, isRtl, t, uiLanguage } from "@/lib/i18n";
import { isAlreadyTargetLang, type LanguageCode } from "@/lib/language";
import type { PageTranslator } from "@/lib/page-translator";
import { isSettingsMessage, isShowSiteMessage, isToggleMessage } from "@/lib/protocol";
import { ignoreChrome, runtimeAlive, runtimeUrl } from "@/lib/runtime";
import { matchPageTranslate } from "@/lib/translate-result";
import type { Position } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { currentHost } from "../shared/host";
import { rememberSiteTranslate, shouldStartTranslated } from "@/lib/site-translate";
import { InputTranslateControls } from "../shared/InputTranslateControls";
import { LanguageSelect } from "../shared/LanguageSelect";
import { useSettings } from "../shared/useSettings";
import { Grip } from "./Grip";
import { InputPreview } from "./InputPreview";
import { clampPosition, useDragPosition } from "./useDragPosition";

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
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sourceLang, setSourceLang] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status | null>(null);
  const [translatorState, setTranslatorState] = useState(translator.state);
  const [framesTranslated, setFramesTranslated] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [position, setPosition] = useState<Position>(settings?.position ?? { right: 20, bottom: 24 });
  const [iconBroken, setIconBroken] = useState(false);
  const iconUrl = runtimeUrl("/icons/icon48.png");
  const failed = Boolean(status?.action);

  useEffect(() => {
    if (!settings?.position) return;
    const next = clampPosition(null, settings.position.right, settings.position.bottom);
    setPosition(next);
    if (next.right !== settings.position.right || next.bottom !== settings.position.bottom) {
      void update({ position: next });
    }
  }, [settings?.position, update]);

  const commitPosition = useCallback(
    (next: Position) => {
      setPosition(next);
      void update({ position: next });
    },
    [update]
  );

  const chipHidden = !settings.showFab || settings.hiddenHosts.includes(currentHost());
  const canDrag = !chipHidden;
  const { dragging, dragRef, onPointerDown } = useDragPosition(canDrag, position, setPosition, commitPosition);

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

  const fail = useCallback((next: Status) => {
    setStatus(next);
    setExpanded(true);
  }, []);

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
      broadcastFrameSync({ type: FRAME_SYNC, action: "translate", targetLang });
      translator.setImageTranslate(settings.imageTranslate);
      const hasImages = settings.imageTranslate && collectPageImages().length > 0;
      if (!pageHasForeignText(targetLang) && !hasImages) {
        if (pageHasIframes()) setFramesTranslated(true);
        setStatus(null);
        syncTranslatorUi();
        return;
      }

      setBusy(true);
      setStatus(null);
      setFramesTranslated(true);
      translator.setProgressHandler((value) => {
        setProgress(value);
        setTranslatorState(translator.state);
      });
      const result = await translator.translatePage(nextSource, targetLang);
      matchPageTranslate(result, {
        onTranslated: () => {
          setStatus(null);
          void update({
            siteTranslate: rememberSiteTranslate(settings.siteTranslate, currentHost(), true)
          });
        },
        onInvalidated: () =>
          fail({
            text: t("translateFailed"),
            actionLabel: t("reloadPage"),
            action: () => location.reload()
          }),
        onUnsupported: () =>
          fail({
            text: t("apiUnsupported"),
            actionLabel: t("openGoogleTranslate"),
            action: openGoogleTranslate
          }),
        onFailed: () =>
          fail({
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
      fail,
      openGoogleTranslate,
      pageHasForeignText,
      selectedTarget,
      settings,
      sourceLang,
      syncTranslatorUi,
      translator,
      update
    ]
  );

  const showOriginal = useCallback(() => {
    translator.restore();
    setFramesTranslated(false);
    broadcastFrameSync({ type: FRAME_SYNC, action: "restore" });
    setStatus(null);
    syncTranslatorUi();
    if (settings) {
      void update({
        siteTranslate: rememberSiteTranslate(settings.siteTranslate, currentHost(), false)
      });
    }
  }, [settings, syncTranslatorUi, translator, update]);

  const togglePage = useCallback(() => {
    if (busy) return;
    if (failed) {
      setExpanded(true);
      return;
    }
    if (translator.state === "translated" || framesTranslated) showOriginal();
    else void translateToTarget();
  }, [busy, failed, framesTranslated, showOriginal, translateToTarget, translator]);

  useEffect(() => {
    translator.setProgressHandler((value) => {
      setProgress(value);
      setTranslatorState(translator.state);
    });
    return () => {
      translator.setProgressHandler(null);
    };
  }, [translator]);

  const imageTranslateReady = useRef(false);
  const imageTranslate = settings?.imageTranslate ?? false;
  useEffect(() => {
    translator.setImageTranslate(imageTranslate);
    if (!imageTranslateReady.current) {
      imageTranslateReady.current = true;
      return;
    }
    broadcastFrameSync({ type: FRAME_SYNC, action: "imageTranslate", enabled: imageTranslate });
    if (imageTranslate) translator.refreshImages();
  }, [imageTranslate, translator]);

  useEffect(() => {
    if (!ready || !settings) return;
    let cancelled = false;
    void (async () => {
      await detectSource();
      if (cancelled) return;
      if (!shouldStartTranslated(currentHost(), settings.siteTranslate, settings.alwaysTranslate)) return;
      if (
        pageHasForeignText(settings.targetLang) ||
        pageHasIframes() ||
        (settings.imageTranslate && collectPageImages().length > 0)
      ) {
        await translateToTarget();
      }
    })();
    return () => {
      cancelled = true;
    };
    // First paint after settings load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    const onMessage = (message: unknown) => {
      if (!runtimeAlive() || !message) return;
      if (isToggleMessage(message)) togglePage();
      if (isSettingsMessage(message) || isShowSiteMessage(message)) {
        void reload();
      }
    };
    ignoreChrome(() => browser.runtime.onMessage.addListener(onMessage));
    return () => ignoreChrome(() => browser.runtime.onMessage.removeListener(onMessage));
  }, [reload, togglePage]);

  useEffect(() => watchNewIframes(), []);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onPointerDownOutside = (event: PointerEvent) => {
      const host = document.getElementById(WIDGET_HOST_ID);
      if (host && (event.target === host || host.contains(event.target as Node))) return;
      setExpanded(false);
    };
    window.addEventListener("pointerdown", onPointerDownOutside, true);
    return () => window.removeEventListener("pointerdown", onPointerDownOutside, true);
  }, [expanded]);

  if (!settings) return null;

  const alwaysOn = settings.alwaysTranslate.includes("*");
  const translating = busy || translatorState === "translating";
  const translated = translatorState === "translated" || framesTranslated;

  return (
    <>
      {settings.inputTranslate ? <InputPreview targetLang={settings.inputTargetLang} /> : null}
      {chipHidden ? null : (
    <div
      ref={dragRef}
      onPointerDown={onPointerDown}
      className={cn(
        "pointer-events-auto fixed z-[2147483646] text-card-foreground select-none touch-none",
        dragging && "opacity-90 cursor-grabbing"
      )}
      dir={isRtl() ? "rtl" : "ltr"}
      lang={uiLanguage()}
      style={{
        position: "fixed",
        right: position.right,
        bottom: position.bottom,
        left: "auto",
        top: "auto",
        zIndex: 2147483646,
        pointerEvents: "auto",
        visibility: fullscreen ? "hidden" : "visible"
      }}
    >
      {!expanded && (
        <div
          className={cn(
            "relative flex items-center gap-0.5 rounded-2xl border bg-card p-1.5 pr-1 shadow-lg",
            failed ? "border-destructive" : translated ? "border-primary" : "border-primary/35"
          )}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            borderRadius: 16,
            border: failed ? "1px solid #f28b82" : "1px solid rgba(26,115,232,0.55)",
            background: "#152033",
            color: "#e8eaed",
            padding: "6px 4px 6px 6px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.25)"
          }}
        >
          <span data-drag-handle className="cursor-grab px-0.5" title={t("moveButton")}>
            <Grip />
          </span>
          <button
            type="button"
            className="fab-action relative flex items-center overflow-hidden rounded-lg"
            role="switch"
            aria-checked={translated}
            aria-label={t("translatePage")}
            title={translated ? t("translateOn") : t("translateOff")}
            onClick={togglePage}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 36,
              padding: "0 8px 0 6px",
              border: 0,
              borderRadius: 10,
              background: translated ? "#1a73e8" : "rgba(255,255,255,0.08)",
              color: "#e8eaed",
              cursor: translating ? "wait" : "pointer"
            }}
          >
            {iconUrl && !iconBroken ? (
              <img
                src={iconUrl}
                alt=""
                style={{ width: 22, height: 22, display: "block", borderRadius: 4 }}
                onError={() => setIconBroken(true)}
              />
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1 }}>文</span>
            )}
            <span
              aria-hidden="true"
              style={{
                position: "relative",
                width: 30,
                height: 16,
                borderRadius: 99,
                background: translated ? "#fff" : "rgba(255,255,255,0.28)",
                flex: "0 0 auto"
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: translated ? 16 : 2,
                  width: 12,
                  height: 12,
                  borderRadius: 99,
                  background: translated ? "#1a73e8" : "#e8eaed",
                  display: "block"
                }}
              />
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {translated ? t("translateOn") : t("translateOff")}
            </span>
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground grid size-7 place-items-center rounded-md"
            title={t("moreOptions")}
            aria-label={t("moreOptions")}
            onClick={() => setExpanded(true)}
          >
            <ChevronDownIcon className="size-4" />
          </button>
          {failed && <span className="bg-destructive absolute top-1.5 right-1.5 size-1.5 rounded-full" />}
          {translating && (
            <div className="absolute inset-x-1.5 bottom-1 h-[3px] overflow-hidden rounded-full bg-primary/20">
              <div
                className="bg-primary h-full transition-[width] duration-150"
                style={{ width: `${Math.max(8, Math.min(100, progress * 100))}%` }}
              />
            </div>
          )}
        </div>
      )}

      {expanded && (
        <Card className="w-[min(280px,calc(100vw-24px))] gap-0 overflow-hidden py-0 shadow-xl" role="dialog" aria-label={t("translateDialog")}>
          <div className="flex items-center gap-2 px-2.5 py-2">
            <span data-drag-handle className="cursor-grab" title={t("moveButton")}>
              <Grip />
            </span>
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
          <CardContent className="space-y-3 px-2.5 pt-1 pb-2.5">
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
            <Label className="text-muted-foreground font-normal">
              <Checkbox
                checked={settings.imageTranslate}
                onCheckedChange={(checked) => void update({ imageTranslate: checked === true })}
              />
              {t("imageTranslate")}
            </Label>
            <InputTranslateControls
              enabled={settings.inputTranslate}
              targetLang={settings.inputTargetLang}
              onEnabled={(next) => update({ inputTranslate: next })}
              onTargetLang={(code) => update({ inputTargetLang: code })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-auto justify-start px-0"
              onClick={async () => {
                const hosts = Array.from(new Set(settings.hiddenHosts.concat(currentHost())));
                await update({ hiddenHosts: hosts });
                onHide();
              }}
            >
              {t("hideOnThisSite")}
            </Button>
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
      )}
    </>
  );
}
