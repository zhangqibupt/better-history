import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDefaultHistoryRequest,
  buildPrimaryHistorySearchRequest,
  buildSupplementaryHistorySearchRequest,
  DEFAULT_HISTORY_PREFETCH_LIMIT,
  fetchHistoryItems,
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

test("buildPrimaryHistorySearchRequest uses the longest token for multi-term recall", () => {
  assert.deepEqual(buildPrimaryHistorySearchRequest("aa bbbb cc"), {
    text: "bbbb",
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
  assert.equal(shouldSupplementHistoryResults("aa bb", new Array(25).fill({})), true);
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

test("fetchHistoryItems filters browser internal pages from default recall", async () => {
  globalThis.chrome = {
    history: {
      async search() {
        return [
          { title: "扩展程序", url: "chrome://extensions/" },
          { title: "新标签页", url: "chrome://newtab/" },
          { title: "Team wiki", url: "https://example.com/wiki" }
        ];
      }
    }
  };

  const items = await fetchHistoryItems("");

  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://example.com/wiki");
});

test("fetchHistoryItems filters extension pages after merged recall", async () => {
  let callCount = 0;

  globalThis.chrome = {
    history: {
      async search(request) {
        callCount += 1;

        if (callCount === 1) {
          assert.equal(request.text, "扩展");
          return [
            { title: "扩展程序", url: "chrome://extensions/" },
            { title: "Chrome 扩展文档", url: "https://example.com/extensions-docs" }
          ];
        }

        return [
          { title: "Better History", url: "chrome-extension://abcdefghijklmnop/src/search-page/index.html" },
          { title: "扩展教程", url: "https://example.com/extensions-guide" }
        ];
      }
    }
  };

  const items = await fetchHistoryItems("扩展");

  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((item) => item.url),
    [
      "https://example.com/extensions-docs",
      "https://example.com/extensions-guide"
    ]
  );
});

test("fetchHistoryItems filters scheme-less internal urls from browser history", async () => {
  globalThis.chrome = {
    history: {
      async search() {
        return [
          { title: "扩展程序", url: "extensions" },
          { title: "扩展程序 - Better History", url: "extensions?id=gncjebifeofipkjjekijjkkfgphjkaen" },
          { title: "Team wiki", url: "https://example.com/wiki" }
        ];
      }
    }
  };

  const items = await fetchHistoryItems("");

  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://example.com/wiki");
});
