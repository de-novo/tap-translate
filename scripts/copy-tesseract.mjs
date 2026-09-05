import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const dest = join(root, "public", "tesseract");
const worker = join(root, "node_modules", "tesseract.js", "dist", "worker.min.js");
const pnpmCore = readdirSync(join(root, "node_modules", ".pnpm")).find((name) =>
  name.startsWith("tesseract.js-core@")
);
const coreDir = pnpmCore
  ? join(root, "node_modules", ".pnpm", pnpmCore, "node_modules", "tesseract.js-core")
  : join(root, "node_modules", "tesseract.js-core");

if (!existsSync(worker) || !existsSync(coreDir)) {
  throw new Error("tesseract.js assets not found. Run pnpm install first.");
}

mkdirSync(dest, { recursive: true });
copyFileSync(worker, join(dest, "worker.min.js"));

for (const name of readdirSync(coreDir)) {
  if (!name.includes("lstm")) continue;
  copyFileSync(join(coreDir, name), join(dest, name));
}

console.log(`copied tesseract assets to ${dest}`);
