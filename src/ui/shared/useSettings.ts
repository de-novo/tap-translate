import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { isSupportedLang } from "../../lib/language";
import { runtimeAlive } from "../../lib/runtime";
import { loadSettings, saveSettings, type Settings } from "../../lib/settings";

function applyStorageChange(prev: Settings, changes: Record<string, { newValue?: unknown }>): Settings {
  const next = { ...prev, position: { ...prev.position } };
  if (typeof changes.targetLang?.newValue === "string" && isSupportedLang(changes.targetLang.newValue)) {
    next.targetLang = changes.targetLang.newValue;
  }
  if (Array.isArray(changes.alwaysTranslate?.newValue)) {
    next.alwaysTranslate = changes.alwaysTranslate.newValue.filter(
      (item): item is string => typeof item === "string"
    );
  }
  if (Array.isArray(changes.hiddenHosts?.newValue)) {
    next.hiddenHosts = changes.hiddenHosts.newValue.filter((item): item is string => typeof item === "string");
  }
  if (typeof changes.showFab?.newValue === "boolean") {
    next.showFab = changes.showFab.newValue;
  }
  const position = changes.position?.newValue;
  if (position && typeof position === "object") {
    const value = position as Settings["position"];
    if (typeof value.right === "number" && typeof value.bottom === "number") {
      next.position = value;
    }
  }
  return next;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((value) => {
      if (!cancelled) setSettings(value);
    });
    const onChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (!runtimeAlive() || area !== "sync") return;
      setSettings((prev) => (prev ? applyStorageChange(prev, changes) : prev));
    };
    browser.storage.onChanged.addListener(onChange);
    return () => {
      cancelled = true;
      browser.storage.onChanged.removeListener(onChange);
    };
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...patch,
        position: patch.position ?? prev.position,
        alwaysTranslate: patch.alwaysTranslate ?? prev.alwaysTranslate,
        hiddenHosts: patch.hiddenHosts ?? prev.hiddenHosts
      };
    });
    await saveSettings(patch);
  }, []);

  const reload = useCallback(async () => {
    setSettings(await loadSettings());
  }, []);

  return { settings, update, reload, ready: settings !== null };
}
