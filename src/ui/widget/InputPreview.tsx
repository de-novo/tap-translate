import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { shouldTranslateText } from "@/lib/dom";
import { isRtl, t, uiLanguage } from "@/lib/i18n";
import { copyText, eventDeepTarget, findWritableField, placePreview, readFieldText } from "@/lib/input-field";
import { isAlreadyTargetLang, type LanguageCode } from "@/lib/language";
import { requestTranslations } from "@/lib/messaging";
import { matchTranslateResponse } from "@/lib/protocol";
import { runtimeAlive } from "@/lib/runtime";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 400;
const MAX_CHARS = 4000;

type InputPreviewProps = {
  targetLang: LanguageCode;
};

type PreviewState = {
  source: string;
  text: string;
  status: "idle" | "busy" | "done" | "failed";
};

const emptyPreview: PreviewState = { source: "", text: "", status: "idle" };

export function InputPreview({ targetLang }: InputPreviewProps) {
  const [field, setField] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [preview, setPreview] = useState<PreviewState>(emptyPreview);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const holdRef = useRef(false);
  const composingRef = useRef(false);
  const fieldRef = useRef<HTMLElement | null>(null);
  const generationRef = useRef(0);
  const cacheRef = useRef(new Map<string, string>());
  const timerRef = useRef(0);
  fieldRef.current = field;

  const cacheKey = useCallback((text: string) => `${targetLang}\0${text}`, [targetLang]);

  const syncRect = useCallback((next: HTMLElement | null) => {
    if (!next?.isConnected) {
      setRect(null);
      return;
    }
    setRect(next.getBoundingClientRect());
  }, []);

  const translateField = useCallback(
    async (next: HTMLElement) => {
      if (!runtimeAlive()) return;
      const source = readFieldText(next).slice(0, MAX_CHARS);
      if (!shouldTranslateText(source) || isAlreadyTargetLang(source, targetLang)) {
        setPreview(emptyPreview);
        return;
      }
      const cached = cacheRef.current.get(cacheKey(source));
      if (cached) {
        setPreview({ source, text: cached, status: "done" });
        return;
      }
      const token = ++generationRef.current;
      setPreview((prev) => ({ source, text: prev.source === source ? prev.text : prev.text, status: "busy" }));
      const response = await requestTranslations([source], "auto", targetLang);
      if (token !== generationRef.current) return;
      matchTranslateResponse(response, {
        onOk: (translations) => {
          const text = translations[0]?.trim() ?? "";
          if (!text) {
            setPreview({ source, text: "", status: "failed" });
            return;
          }
          cacheRef.current.set(cacheKey(source), text);
          setPreview({ source, text, status: "done" });
        },
        onError: () => setPreview({ source, text: "", status: "failed" })
      });
    },
    [cacheKey, targetLang]
  );

  const scheduleTranslate = useCallback(
    (next: HTMLElement) => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void translateField(next);
      }, DEBOUNCE_MS);
    },
    [translateField]
  );

  useEffect(() => {
    cacheRef.current.clear();
    generationRef.current += 1;
    setPreview(emptyPreview);
    if (field) scheduleTranslate(field);
  }, [field, scheduleTranslate, targetLang]);

  useEffect(() => {
    const adopt = (target: EventTarget | null) => {
      const next = findWritableField(target);
      if (!next) return;
      setField(next);
      syncRect(next);
    };

    const onFocusIn = (event: FocusEvent) => adopt(eventDeepTarget(event));

    const onFocusOut = () => {
      window.setTimeout(() => {
        if (holdRef.current) return;
        const active = findWritableField(document.activeElement);
        if (active) {
          setField(active);
          syncRect(active);
          return;
        }
        setField(null);
        setRect(null);
        setPreview(emptyPreview);
        setCopied(false);
      }, 180);
    };

    const onInput = (event: Event) => {
      if (composingRef.current) return;
      const next = findWritableField(eventDeepTarget(event)) ?? fieldRef.current;
      if (!next) return;
      setField(next);
      syncRect(next);
      scheduleTranslate(next);
    };

    const onCompositionStart = () => {
      composingRef.current = true;
    };
    const onCompositionEnd = (event: Event) => {
      composingRef.current = false;
      onInput(event);
    };

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("compositionstart", onCompositionStart, true);
    document.addEventListener("compositionend", onCompositionEnd, true);
    adopt(document.activeElement);
    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("compositionstart", onCompositionStart, true);
      document.removeEventListener("compositionend", onCompositionEnd, true);
      window.clearTimeout(timerRef.current);
    };
  }, [scheduleTranslate, syncRect]);

  useEffect(() => {
    if (!field) return;
    const update = () => {
      if (!field.isConnected) {
        setField(null);
        setRect(null);
        setPreview(emptyPreview);
        return;
      }
      syncRect(field);
    };
    const observer = new ResizeObserver(update);
    observer.observe(field);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [field, syncRect]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  const onCopy = async () => {
    if (!preview.text) return;
    const ok = await copyText(preview.text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
    field?.focus();
  };

  if (fullscreen || !field || !rect) return null;
  if (preview.status === "idle" && !preview.text) return null;

  const place = placePreview(rect, window.innerWidth, window.innerHeight);
  const visible = preview.status === "done" ? preview.text : preview.status === "failed" ? t("translateFailed") : preview.text;

  return (
    <div
      className="pointer-events-auto fixed z-[2147483646]"
      dir={isRtl() ? "rtl" : "ltr"}
      lang={uiLanguage()}
      style={{
        left: place.left,
        width: place.width,
        top: place.top ?? "auto",
        bottom: place.bottom ?? "auto"
      }}
      onPointerDown={() => {
        holdRef.current = true;
      }}
      onPointerUp={() => {
        window.setTimeout(() => {
          holdRef.current = false;
        }, 0);
      }}
      onPointerCancel={() => {
        holdRef.current = false;
      }}
    >
      <Card className="gap-0 overflow-hidden py-0 shadow-lg" role="status" aria-live="polite">
        <div className="flex items-start gap-2 px-2.5 py-2">
          <p
            className={cn(
              "min-w-0 flex-1 text-sm leading-snug whitespace-pre-wrap break-words",
              preview.status === "failed" && "text-muted-foreground",
              preview.status === "busy" && "opacity-70"
            )}
            style={{ maxHeight: place.maxHeight, overflow: "auto" }}
          >
            {visible || t("translating")}
          </p>
          {preview.status === "done" && preview.text ? (
            <Button type="button" variant="secondary" size="xs" onClick={() => void onCopy()}>
              {copied ? t("copied") : t("copyTranslation")}
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
