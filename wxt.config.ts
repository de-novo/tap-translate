import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import remToPx from "postcss-rem-to-responsive-pixel";
import { defineConfig } from "wxt";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  srcDir: "src",
  outDir: ".output",
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(root, "src")
      }
    },
    css: {
      postcss: {
        plugins: [
          remToPx({
            rootValue: 16,
            propList: ["*"],
            transformUnit: "px"
          })
        ]
      }
    }
  }),
  manifest: {
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    minimum_chrome_version: "116",
    permissions: ["storage"],
    host_permissions: [
      "http://*/*",
      "https://*/*",
      "https://translate.googleapis.com/*",
      "https://cdn.jsdelivr.net/*"
    ],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
    },
    action: {
      default_title: "__MSG_actionTitle__"
    },
    commands: {
      "toggle-translate": {
        suggested_key: {
          default: "Alt+Shift+T",
          mac: "Alt+Shift+T"
        },
        description: "__MSG_commandToggle__"
      }
    },
    icons: {
      16: "icons/icon16.png",
      32: "icons/icon32.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png"
    },
    web_accessible_resources: [
      {
        resources: ["icons/icon48.png", "ocr.html", "tesseract/*"],
        matches: ["http://*/*", "https://*/*"]
      }
    ]
  }
});
