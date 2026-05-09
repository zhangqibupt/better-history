import test from "node:test";
import assert from "node:assert/strict";

import { buildHighlightParts } from "../src/search-page/utils/highlight.js";

test("buildHighlightParts highlights each search token independently", () => {
  const parts = buildHighlightParts("AA project notes /bb/path", "aa bb");

  assert.deepEqual(parts, [
    { text: "AA", highlighted: true },
    { text: " project notes /", highlighted: false },
    { text: "bb", highlighted: true },
    { text: "/path", highlighted: false }
  ]);
});

test("buildHighlightParts returns plain text when keyword is empty", () => {
  assert.deepEqual(buildHighlightParts("Project docs", ""), [
    { text: "Project docs", highlighted: false }
  ]);
});
