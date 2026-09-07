import assert from "node:assert/strict";
import { test } from "node:test";
import { dropGlobalAlways, rememberSiteTranslate, shouldStartTranslated, siteKey } from "./site-translate.ts";

test("dropGlobalAlways removes the catch-all always-translate flag", () => {
  assert.deepEqual(dropGlobalAlways(["*", "example.com"]), ["example.com"]);
});

test("siteKey ignores path and treats www as the same site", () => {
  assert.equal(siteKey("x.com"), "x.com");
  assert.equal(siteKey("WWW.X.COM"), "x.com");
  assert.equal(siteKey("www.x.com"), "x.com");
});

test("a toggle on x.com applies to every path on that host", () => {
  const saved = rememberSiteTranslate({}, "www.x.com", true);
  assert.equal(shouldStartTranslated("x.com", saved), true);
  assert.equal(shouldStartTranslated("www.x.com", saved), true);
});

test("shouldStartTranslated is off when this host was last turned off", () => {
  assert.equal(shouldStartTranslated("x.com", { "x.com": false }), false);
});

test("shouldStartTranslated is on when this host was last turned on", () => {
  assert.equal(shouldStartTranslated("x.com", { "x.com": true }), true);
});

test("shouldStartTranslated stays off for unknown hosts", () => {
  assert.equal(shouldStartTranslated("x.com", {}), false);
});

test("rememberSiteTranslate writes that host without dropping others", () => {
  const next = rememberSiteTranslate({ "a.com": true }, "b.com", false);
  assert.equal(next["a.com"], true);
  assert.equal(next["b.com"], false);
});
