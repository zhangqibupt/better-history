import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeUrl,
  parseSearchInput,
  searchHistoryItems
} from "../src/historySearch.js";

test("normalizeUrl removes hash while keeping query parameters", () => {
  assert.equal(
    normalizeUrl("https://example.com/docs?id=1#section-2"),
    "https://example.com/docs?id=1"
  );
});

test("parseSearchInput extracts keyword and domain filter", () => {
  assert.deepEqual(parseSearchInput("lrm site:larkoffice.com"), {
    keyword: "lrm",
    domainFilter: "larkoffice.com"
  });

  assert.deepEqual(parseSearchInput("domain:example.com"), {
    keyword: "",
    domainFilter: "example.com"
  });
});

test("searchHistoryItems matches both title and url case-insensitively", () => {
  const items = [
    {
      title: "Chrome Extensions Guide",
      url: "https://developer.chrome.com/docs/extensions",
      visitCount: 2
    },
    {
      title: "Unrelated page",
      url: "https://example.com/history-search",
      visitCount: 8
    }
  ];

  const byTitle = searchHistoryItems(items, "extensions");
  const byUrl = searchHistoryItems(items, "HISTORY-SEARCH");

  assert.equal(byTitle.length, 1);
  assert.equal(byTitle[0].title, "Chrome Extensions Guide");
  assert.equal(byUrl.length, 1);
  assert.equal(byUrl[0].title, "Unrelated page");
});

test("searchHistoryItems prefers title matches, then recent visits, then visit count", () => {
  const items = [
    {
      title: "Result from title",
      url: "https://example.com/docs",
      visitCount: 1,
      lastVisitTime: 10
    },
    {
      title: "Other page",
      url: "https://example.com/result-query-ranked",
      visitCount: 9,
      lastVisitTime: 20
    },
    {
      title: "Result from title newer",
      url: "https://example.com/title-new",
      visitCount: 2,
      lastVisitTime: 30
    }
  ];

  const results = searchHistoryItems(items, "result");

  assert.equal(results.length, 3);
  assert.equal(results[0].url, "https://example.com/title-new");
  assert.equal(results[1].url, "https://example.com/docs");
  assert.equal(results[2].url, "https://example.com/result-query-ranked");
});

test("searchHistoryItems dedupes same title within the same hostname", () => {
  const items = [
    {
      title: "Team Doc",
      url: "https://docs.example.com/page-a",
      visitCount: 2,
      lastVisitTime: 10
    },
    {
      title: "Team Doc",
      url: "https://docs.example.com/page-b",
      visitCount: 5,
      lastVisitTime: 20
    },
    {
      title: "Team Doc",
      url: "https://other.example.com/page-c",
      visitCount: 9,
      lastVisitTime: 30
    }
  ];

  const results = searchHistoryItems(items, "team");

  assert.equal(results.length, 2);
  assert.equal(results[0].url, "https://other.example.com/page-c");
  assert.equal(results[1].url, "https://docs.example.com/page-b");
});

test("searchHistoryItems supports explicit and UI-driven domain filtering", () => {
  const items = [
    {
      title: "LRM kickoff",
      url: "https://bytedance.larkoffice.com/doc/1",
      visitCount: 3,
      lastVisitTime: 10
    },
    {
      title: "LRM service",
      url: "https://ml-ttp-us.bytelink.net/service/1",
      visitCount: 8,
      lastVisitTime: 20
    },
    {
      title: "Weekly digest",
      url: "https://bytedance.larkoffice.com/doc/2",
      visitCount: 1,
      lastVisitTime: 40
    }
  ];

  const byQueryFilter = searchHistoryItems(items, "lrm site:larkoffice.com");
  const byUiFilter = searchHistoryItems(items, "lrm", {
    domainFilter: "larkoffice.com"
  });
  const byDomainOnly = searchHistoryItems(items, "domain:larkoffice.com");

  assert.equal(byQueryFilter.length, 1);
  assert.equal(byQueryFilter[0].hostname, "bytedance.larkoffice.com");
  assert.equal(byUiFilter.length, 1);
  assert.equal(byUiFilter[0].hostname, "bytedance.larkoffice.com");
  assert.equal(byDomainOnly.length, 2);
  assert.equal(byDomainOnly[0].url, "https://bytedance.larkoffice.com/doc/2");
});
