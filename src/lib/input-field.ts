import { WIDGET_HOST_ID } from "./dom";

const SKIP_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "date",
  "datetime-local",
  "email",
  "file",
  "hidden",
  "image",
  "month",
  "number",
  "password",
  "radio",
  "range",
  "reset",
  "submit",
  "tel",
  "time",
  "url",
  "week"
]);

const CODE_EDITOR = ".CodeMirror, .monaco-editor, .cm-editor, .ace_editor, .ql-editor";

const OTP = /(?:^|[\s_-])(?:otp|totp|2fa|one-?time)(?:$|[\s_-])/i;

export type PreviewPlacement = {
  left: number;
  width: number;
  top: number | null;
  bottom: number | null;
  maxHeight: number;
};

export function eventDeepTarget(event: Event): EventTarget | null {
  return event.composedPath()[0] ?? event.target;
}

export function findWritableField(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Node)) return null;
  const start = target instanceof Element ? target : target.parentElement;
  if (!start || start.closest(`#${WIDGET_HOST_ID}`)) return null;

  const field = start.closest("input, textarea, [contenteditable]");
  if (!(field instanceof HTMLElement)) return null;
  if (field.closest(`#${WIDGET_HOST_ID}`)) return null;
  if (!isWritableField(field)) return null;
  return field;
}

export function isWritableField(field: HTMLElement): boolean {
  if (field.closest(CODE_EDITOR)) return false;

  if (field instanceof HTMLInputElement) {
    const type = (field.type || "text").toLowerCase();
    if (SKIP_INPUT_TYPES.has(type)) return false;
    if (field.readOnly || field.disabled) return false;
    if (field.autocomplete === "one-time-code") return false;
    if (OTP.test(field.name) || OTP.test(field.id) || OTP.test(field.autocomplete)) return false;
    return type === "text" || type === "search" || type === "";
  }

  if (field instanceof HTMLTextAreaElement) {
    return !field.readOnly && !field.disabled;
  }

  const editable = field.getAttribute("contenteditable");
  if (editable === "false" || editable == null) return false;
  return field.isContentEditable || editable === "true" || editable === "plaintext-only";
}

export function readFieldText(field: HTMLElement): string {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    return field.value;
  }
  return field.innerText ?? field.textContent ?? "";
}

export function placePreview(rect: DOMRect, vw: number, vh: number): PreviewPlacement {
  const width = Math.min(Math.max(rect.width, 180), Math.max(180, vw - 16));
  const left = Math.min(Math.max(8, rect.left), Math.max(8, vw - width - 8));
  const gap = 6;
  const spaceBelow = vh - rect.bottom - gap - 8;
  const spaceAbove = rect.top - gap - 8;
  const above = spaceBelow < 64 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(160, Math.max(48, above ? spaceAbove : spaceBelow));
  if (above) {
    return { left, width, top: null, bottom: vh - rect.top + gap, maxHeight };
  }
  return { left, width, top: rect.bottom + gap, bottom: null, maxHeight };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
