export const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "OPTION",
  "CODE",
  "PRE",
  "KBD",
  "SAMP",
  "MATH",
  "SVG",
  "CANVAS",
  "VIDEO",
  "AUDIO"
]);

export const WIDGET_HOST_ID = "qt-floating-translate-host";

export function shouldTranslateText(text: string | undefined | null): boolean {
  const value = String(text || "").trim();
  if (value.length < 2) return false;
  if (!/[\p{L}]/u.test(value)) return false;
  if (/^https?:\/\/\S+$/i.test(value)) return false;
  if (/^[\w.+-]+@[\w.-]+\.\w+$/.test(value)) return false;
  return true;
}

export function collectTextNodes(root: Node | null): Text[] {
  const nodes: Text[] = [];
  if (!root) return nodes;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      let parent = node.parentElement;
      while (parent) {
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.isContentEditable || parent.closest("[contenteditable='true']")) {
          return NodeFilter.FILTER_REJECT;
        }
        // Ignore [translate=no] on the page. Sites put it on <html> to block Chrome's bar
        // (Weglot, Next). A chip tap still means translate. The widget host is skipped by id.
        if (parent.id === WIDGET_HOST_ID) return NodeFilter.FILTER_REJECT;
        parent = parent.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

export function collectSampleText(maxLen = 2000): string {
  const nodes = collectTextNodes(document.body);
  let sample = "";
  for (const node of nodes) {
    sample += node.nodeValue + " ";
    if (sample.length >= maxLen) break;
  }
  return sample.slice(0, maxLen).trim();
}

export function isNodeInViewport(node: Text): boolean {
  const element = node.parentElement;
  if (!element?.getBoundingClientRect) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.bottom >= 0 &&
    rect.top <= (window.innerHeight || 0) &&
    rect.right >= 0 &&
    rect.left <= (window.innerWidth || 0) &&
    rect.width + rect.height > 0
  );
}

export function splitChunks(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.4) cut = remaining.lastIndexOf(". ", maxLen);
    if (cut < maxLen * 0.4) cut = remaining.lastIndexOf(" ", maxLen);
    if (cut < maxLen * 0.4) cut = maxLen;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function collectPageLangs(
  guessTextLang: (text: string) => string,
  limit = 120
): Set<string> {
  const langs = new Set<string>();
  const nodes = collectTextNodes(document.body);
  const max = limit;
  for (let i = 0; i < nodes.length && i < max; i += 1) {
    const text = nodes[i]?.nodeValue;
    if (!shouldTranslateText(text)) continue;
    const guessed = guessTextLang(text ?? "");
    langs.add(guessed !== "auto" ? guessed : "latin");
  }
  return langs;
}
