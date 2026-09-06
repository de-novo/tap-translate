import assert from "node:assert/strict";
import { test } from "node:test";
import { rememberSiteTranslate, shouldStartTranslated } from "./site-translate.ts";

test("shouldStartTranslated is off when this host was last turned off", () => {
  assert.equal(shouldStartTranslated("x.com", { "x.com": false }, ["*"]), false);
});

test("shouldStartTranslated is on when this host was last turned on", () => {
  assert.equal(shouldStartTranslated("x.com", { "x.com": true }, []), true);
});

test("shouldStartTranslated follows always-translate only when the host is unknown", () => {
  assert.equal(shouldStartTranslated("x.com", {}, ["*"]), true);
  assert.equal(shouldStartTranslated("x.com", {}, []), false);
});

test("rememberSiteTranslate writes that host without dropping others", () => {
  const next = rememberSiteTranslate({ "a.com": true }, "b.com", false);
  assert.equal(next["a.com"], true);
  assert.equal(next["b.com"], false);
});
