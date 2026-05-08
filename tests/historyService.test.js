import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDefaultHistoryRequest,
  buildPrimaryHistorySearchRequest,
  buildSupplementaryHistorySearchRequest,
  DEFAULT_HISTORY_PREFETCH_LIMIT,
  mergeHistoryItems,
  PRIMARY_HISTORY_SEARCH_LIMIT,
  shouldSupplementHistoryResults,
  SUPPLEMENTARY_HISTORY_SEARCH_LIMIT
} from "../src/search-page/services/historyService.js";

test("buildPrimaryHistorySearchRequest uses keyword-driven browser recall", () => {
  assert.deepEqual(buildPrimaryHistorySearchRequest("lrm site:larkoffice.com"), {
    text: "lrm",
    startTime: 0,
    maxResults: PRIMARY_HISTORY_SEARCH_LIMIT
  });
});

test("buildDefaultHistoryRequest prefetches recent history for empty query", () => {
  assert.deepEqual(buildDefaultHistoryRequest(), {
    text: "",
    startTime: 0,
    maxResults: DEFAULT_HISTORY_PREFETCH_LIMIT
  });
});

test("buildSupplementaryHistorySearchRequest limits fallback recall window", () => {
  const now = 2_000_000_000_000;
  const request = buildSupplementaryHistorySearchRequest(now);

  assert.equal(request.text, "");
  assert.equal(request.maxResults, SUPPLEMENTARY_HISTORY_SEARCH_LIMIT);
  assert.ok(request.startTime < now);
});

test("shouldSupplementHistoryResults only enables fallback when needed", () => {
  assert.equal(shouldSupplementHistoryResults("", []), false);
  assert.equal(shouldSupplementHistoryResults("lrm", new Array(25).fill({})), false);
  assert.equal(shouldSupplementHistoryResults("lrm", new Array(5).fill({})), true);
  assert.equal(shouldSupplementHistoryResults("site:larkoffice.com", []), true);
});

test("mergeHistoryItems dedupes primary and supplementary batches by url", () => {
  const mergedItems = mergeHistoryItems(
    [
      { url: "https://example.com/a", title: "A" },
      { url: "https://example.com/b", title: "B" }
    ],
    [
      { url: "https://example.com/b", title: "B copy" },
      { url: "https://example.com/c", title: "C" }
    ]
  );

  assert.equal(mergedItems.length, 3);
  assert.equal(mergedItems[0].title, "A");
  assert.equal(mergedItems[1].title, "B");
  assert.equal(mergedItems[2].title, "C");
});
