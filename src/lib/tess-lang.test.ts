import assert from "node:assert/strict";
import { test } from "node:test";
import { imageTessLang, tessLang } from "./tess-lang.ts";

test("tessLang maps Korean and falls back to English", () => {
  assert.equal(tessLang("ko"), "kor");
  assert.equal(tessLang("en"), "eng");
  assert.equal(tessLang("auto"), "eng");
});

test("imageTessLang keeps Korean even when the page is English", () => {
  const langs = imageTessLang("en").split("+");
  assert.ok(langs.includes("eng"));
  assert.ok(langs.includes("kor"));
});

test("imageTessLang keeps English when the page is Korean", () => {
  const langs = imageTessLang("ko").split("+");
  assert.ok(langs.includes("kor"));
  assert.ok(langs.includes("eng"));
});
