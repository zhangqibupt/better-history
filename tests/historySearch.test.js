import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDefaultHistoryItems,
  DEFAULT_HISTORY_DISPLAY_LIMIT,
  groupHistoryItemsBySite,
  normalizeUrl,
  parseSearchInput,
  searchHistoryItems
} from "../src/historySearch.js";
import { reorderGroupsByDomainPriority } from "../src/search-page/services/domainPriorityService.js";

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

test("searchHistoryItems prefers title matches, then visit count, then recent visits", () => {
  const items = [
    {
      title: "Result from title",
      url: "https://example.com/docs",
      visitCount: 6,
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
  assert.equal(results[0].url, "https://example.com/docs");
  assert.equal(results[1].url, "https://example.com/title-new");
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
  assert.equal(byDomainOnly[0].url, "https://bytedance.larkoffice.com/doc/1");
});

test("searchHistoryItems excludes internal doubao history links", () => {
  const items = [
    {
      title: "历史记录",
      url: "doubao://history/?q=lrm",
      visitCount: 10,
      lastVisitTime: 100
    },
    {
      title: "LRM kickoff",
      url: "https://bytedance.larkoffice.com/doc/1",
      visitCount: 3,
      lastVisitTime: 10
    }
  ];

  const results = searchHistoryItems(items, "lrm");

  assert.equal(results.length, 1);
  assert.equal(results[0].url, "https://bytedance.larkoffice.com/doc/1");
});

test("groupHistoryItemsBySite promotes frequent hostnames and keeps other results collapsed", () => {
  const items = [
    {
      title: "A1",
      url: "https://bytedance.sg.larkoffice.com/doc-1",
      hostname: "bytedance.sg.larkoffice.com",
      iconGroupKey: "larkoffice.com",
      iconGroupTitle: "larkoffice",
      visitCount: 8,
      lastVisitTime: 50
    },
    {
      title: "A2",
      url: "https://bytedance.larkoffice.com/doc-2",
      hostname: "bytedance.larkoffice.com",
      iconGroupKey: "larkoffice.com",
      iconGroupTitle: "larkoffice",
      visitCount: 7,
      lastVisitTime: 40
    },
    {
      title: "B1",
      url: "https://cloud.bytedance.net/doc-1",
      hostname: "cloud.bytedance.net",
      iconGroupKey: "bytedance.net",
      iconGroupTitle: "bytedance",
      visitCount: 6,
      lastVisitTime: 30
    },
    {
      title: "B2",
      url: "https://cloud-ttp-us.bytedance.net/doc-2",
      hostname: "cloud-ttp-us.bytedance.net",
      iconGroupKey: "bytedance.net",
      iconGroupTitle: "bytedance",
      visitCount: 5,
      lastVisitTime: 20
    },
    {
      title: "C1",
      url: "https://c.example.com/doc-1",
      hostname: "c.example.com",
      visitCount: 4,
      lastVisitTime: 10
    }
  ];

  const groups = groupHistoryItemsBySite(items);

  assert.equal(groups.length, 3);
  assert.equal(groups[0].title, "larkoffice");
  assert.equal(groups[0].count, 2);
  assert.equal(groups[1].title, "bytedance");
  assert.equal(groups[2].title, "其他结果");
  assert.equal(groups[2].count, 1);
  assert.equal(groups[2].items[0].hostname, "c.example.com");
});

test("groupHistoryItemsBySite falls back to a single all-results group when no site is dominant", () => {
  const items = [
    {
      title: "A1",
      url: "https://a.example.com/doc-1",
      hostname: "a.example.com",
      visitCount: 8,
      lastVisitTime: 50
    },
    {
      title: "B1",
      url: "https://b.example.com/doc-1",
      hostname: "b.example.com",
      visitCount: 7,
      lastVisitTime: 40
    },
    {
      title: "C1",
      url: "https://c.example.com/doc-1",
      hostname: "c.example.com",
      visitCount: 6,
      lastVisitTime: 30
    }
  ];

  const groups = groupHistoryItemsBySite(items);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, "全部结果");
  assert.equal(groups[0].count, 3);
});

test("groupHistoryItemsBySite promotes prioritized domains even when they do not meet the default threshold", () => {
  const items = [
    {
      title: "Aeolus",
      url: "https://aeolus-va.tiktok-row.net/pages/dataQuery?appId=1",
      hostname: "aeolus-va.tiktok-row.net",
      iconGroupKey: "tiktok-row.net",
      iconGroupTitle: "tiktok-row",
      visitCount: 3,
      lastVisitTime: 100
    },
    {
      title: "Lark 1",
      url: "https://foo.larkoffice.com/doc-1",
      hostname: "foo.larkoffice.com",
      iconGroupKey: "larkoffice.com",
      iconGroupTitle: "larkoffice",
      visitCount: 9,
      lastVisitTime: 90
    },
    {
      title: "Lark 2",
      url: "https://bar.larkoffice.com/doc-2",
      hostname: "bar.larkoffice.com",
      iconGroupKey: "larkoffice.com",
      iconGroupTitle: "larkoffice",
      visitCount: 8,
      lastVisitTime: 80
    },
    {
      title: "Example 1",
      url: "https://example.com/doc-1",
      hostname: "example.com",
      iconGroupKey: "example.com",
      iconGroupTitle: "example",
      visitCount: 7,
      lastVisitTime: 70
    }
  ];

  const groups = groupHistoryItemsBySite(items, {
    domainPriorities: ["tiktok-row.net"]
  });

  assert.equal(groups.length, 3);
  assert.equal(groups.some((group) => group.id === "tiktok-row.net"), true);
  assert.equal(groups.some((group) => group.title === "其他结果"), true);

  const reorderedGroups = reorderGroupsByDomainPriority(groups, ["tiktok-row.net"]);

  assert.equal(reorderedGroups[0].id, "tiktok-row.net");
  assert.equal(reorderedGroups[0].count, 1);
  assert.equal(reorderedGroups[1].id, "larkoffice.com");
  assert.equal(reorderedGroups[2].title, "其他结果");
});

test("buildDefaultHistoryItems keeps latest unique items and sorts by last visit time", () => {
  const items = [
    {
      title: "历史记录",
      url: "doubao://history/?q=lrm",
      lastVisitTime: 999
    },
    {
      title: "Keep newest",
      url: "https://a.example.com/newest",
      lastVisitTime: 900
    },
    {
      title: "Shared title",
      url: "https://docs.example.com/a",
      visitCount: 9,
      lastVisitTime: 700
    },
    {
      title: "Shared title",
      url: "https://docs.example.com/b",
      visitCount: 1,
      lastVisitTime: 800
    },
    {
      title: "Older",
      url: "https://b.example.com/older",
      lastVisitTime: 600
    }
  ];

  const defaultItems = buildDefaultHistoryItems(items, 2);

  assert.equal(defaultItems.length, 2);
  assert.equal(defaultItems[0].title, "Keep newest");
  assert.equal(defaultItems[1].url, "https://docs.example.com/b");
});

test("buildDefaultHistoryItems prefers the most recent item over higher visit count", () => {
  const items = [
    {
      title: "Weekly doc",
      url: "https://docs.example.com/older",
      visitCount: 20,
      lastVisitTime: 100
    },
    {
      title: "Weekly doc",
      url: "https://docs.example.com/newer",
      visitCount: 1,
      lastVisitTime: 300
    },
    {
      title: "Reference",
      url: "https://example.com/reference",
      visitCount: 3,
      lastVisitTime: 200
    }
  ];

  const defaultItems = buildDefaultHistoryItems(items, 3);

  assert.equal(defaultItems.length, 2);
  assert.equal(defaultItems[0].url, "https://docs.example.com/newer");
  assert.equal(defaultItems[1].url, "https://example.com/reference");
});

test("buildDefaultHistoryItems uses the shared default display limit", () => {
  const items = Array.from({ length: DEFAULT_HISTORY_DISPLAY_LIMIT + 5 }, (_, index) => ({
    title: `Item ${index}`,
    url: `https://example.com/${index}`,
    lastVisitTime: DEFAULT_HISTORY_DISPLAY_LIMIT + 5 - index
  }));

  const defaultItems = buildDefaultHistoryItems(items);

  assert.equal(defaultItems.length, DEFAULT_HISTORY_DISPLAY_LIMIT);
});
