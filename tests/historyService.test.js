import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  buildDefaultHistoryRequest,
  buildPrimaryHistorySearchRequest,
  buildSupplementaryHistorySearchRequest,
  DEFAULT_HISTORY_PREFETCH_LIMIT,
  fetchHistoryItems,
  HISTORY_DEBUG_FLAG,
  mergeHistoryItems,
  PRIMARY_HISTORY_SEARCH_LIMIT,
  resetHistoryServiceCaches,
  shouldSupplementHistoryResults,
  SUPPLEMENTARY_HISTORY_SEARCH_LIMIT
} from "../src/search-page/services/historyService.js";

beforeEach(() => {
  resetHistoryServiceCaches();
  delete globalThis.chrome;
  delete globalThis[HISTORY_DEBUG_FLAG];
});

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

test("fetchHistoryItems reuses cached results for the same query", async () => {
  let callCount = 0;

  globalThis.chrome = {
    history: {
      async search() {
        callCount += 1;
        return [{ title: "Team wiki", url: "https://example.com/wiki" }];
      }
    }
  };

  const firstItems = await fetchHistoryItems("");
  const secondItems = await fetchHistoryItems("");

  assert.equal(callCount, 1);
  assert.equal(firstItems[0].url, "https://example.com/wiki");
  assert.equal(secondItems[0].url, "https://example.com/wiki");
});

test("fetchHistoryItems reuses supplementary recall across different queries", async () => {
  const requests = [];

  globalThis.chrome = {
    history: {
      async search(request) {
        requests.push(request);

        if (request.text) {
          return [{ title: `${request.text} doc`, url: `https://example.com/${request.text}` }];
        }

        return [{ title: "Shared fallback doc", url: "https://example.com/shared-fallback" }];
      }
    }
  };

  await fetchHistoryItems("alpha beta");
  await fetchHistoryItems("gamma delta");

  assert.equal(requests.filter((request) => request.text === "").length, 1);
  assert.equal(requests.filter((request) => request.text !== "").length, 2);
});

test("fetchHistoryItems only publishes debug payload when explicitly enabled", async () => {
  globalThis.chrome = {
    history: {
      async search() {
        return [{ title: "Team wiki", url: "https://example.com/wiki" }];
      }
    }
  };

  await fetchHistoryItems("");
  assert.equal(globalThis.__BETTER_HISTORY_DEBUG__, undefined);

  globalThis[HISTORY_DEBUG_FLAG] = true;
  await fetchHistoryItems("wiki");

  assert.equal(globalThis.__BETTER_HISTORY_DEBUG__.filteredCount, 1);
  assert.equal(globalThis.__BETTER_HISTORY_DEBUG__.keptItems[0].url, "https://example.com/wiki");
});
