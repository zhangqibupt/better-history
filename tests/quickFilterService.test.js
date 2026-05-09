import test from "node:test";
import assert from "node:assert/strict";

import { ALL_RESULTS_GROUP_ID } from "../src/historySearch.js";
import {
  buildQuickFilters,
  filterGroupsByActiveFilterId,
  getQuickFilterByShortcut,
  resolveActiveQuickFilterId,
  shouldRenderQuickFilters
} from "../src/search-page/services/quickFilterService.js";

function createGroup(id, title, count) {
  return {
    id,
    title,
    count,
    items: Array.from({ length: count }, (_, index) => ({
      title: `${title} ${index}`,
      url: `https://${id}/${index}`
    }))
  };
}

test("shouldRenderQuickFilters only enables the strip when there are multiple groups", () => {
  assert.equal(shouldRenderQuickFilters([]), false);
  assert.equal(shouldRenderQuickFilters([createGroup("a", "A", 2)]), false);
  assert.equal(shouldRenderQuickFilters([createGroup("a", "A", 2), createGroup("b", "B", 3)]), true);
});

test("buildQuickFilters prepends the all-results filter and assigns shortcuts", () => {
  const groups = [createGroup("larkoffice.com", "larkoffice", 4), createGroup("bytedance.net", "bytedance", 2)];
  const filters = buildQuickFilters(groups, [...groups[0].items, ...groups[1].items]);

  assert.equal(filters.length, 3);
  assert.equal(filters[0].id, ALL_RESULTS_GROUP_ID);
  assert.equal(filters[0].title, "全部结果");
  assert.equal(filters[0].shortcut, "1");
  assert.equal(filters[1].shortcut, "2");
  assert.equal(filters[2].shortcut, "3");
});

test("resolveActiveQuickFilterId keeps a still-valid filter and falls back to all results otherwise", () => {
  const groups = [createGroup("larkoffice.com", "larkoffice", 4), createGroup("bytedance.net", "bytedance", 2)];
  const filters = buildQuickFilters(groups, [...groups[0].items, ...groups[1].items]);

  assert.equal(resolveActiveQuickFilterId("larkoffice.com", filters), "larkoffice.com");
  assert.equal(resolveActiveQuickFilterId("missing-filter", filters), ALL_RESULTS_GROUP_ID);
  assert.equal(resolveActiveQuickFilterId("", filters), ALL_RESULTS_GROUP_ID);
  assert.equal(resolveActiveQuickFilterId("larkoffice.com", []), "");
});

test("filterGroupsByActiveFilterId narrows down to the selected group", () => {
  const groups = [createGroup("larkoffice.com", "larkoffice", 4), createGroup("bytedance.net", "bytedance", 2)];

  assert.equal(filterGroupsByActiveFilterId(groups, ALL_RESULTS_GROUP_ID).length, 2);
  assert.equal(filterGroupsByActiveFilterId(groups, "larkoffice.com").length, 1);
  assert.equal(filterGroupsByActiveFilterId(groups, "larkoffice.com")[0].id, "larkoffice.com");
});

test("getQuickFilterByShortcut resolves the visible numeric mapping", () => {
  const groups = [createGroup("larkoffice.com", "larkoffice", 4), createGroup("bytedance.net", "bytedance", 2)];
  const filters = buildQuickFilters(groups, [...groups[0].items, ...groups[1].items]);

  assert.equal(getQuickFilterByShortcut(filters, "1")?.id, ALL_RESULTS_GROUP_ID);
  assert.equal(getQuickFilterByShortcut(filters, "2")?.id, "larkoffice.com");
  assert.equal(getQuickFilterByShortcut(filters, "9"), null);
});
