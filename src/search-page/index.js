import {
  buildDefaultHistoryItems,
  ALL_RESULTS_GROUP_ID,
  groupHistoryItemsBySite,
  parseSearchInput,
  searchHistoryItems
} from "../historySearch.js";
import { INITIAL_STATUS, LOADING_STATUS, SEARCH_ERROR_STATUS } from "./constants.js";
import { renderPage } from "./render.js";
import { fetchHistoryItems } from "./services/historyService.js";
import { openHistoryResult } from "./services/navigationService.js";
import {
  buildQuickFilters,
  filterGroupsByActiveFilterId,
  getQuickFilterByShortcut,
  resolveActiveQuickFilterId
} from "./services/quickFilterService.js";
import {
  NO_SELECTION,
  getDefaultSelectionIndex,
  moveSelectionIndex
} from "./services/selectionService.js";

const state = {
  query: "",
  visibleItems: [],
  allGroups: [],
  visibleGroups: [],
  quickFilters: [],
  showQuickFilterShortcuts: false,
  activeFilterId: "",
  statusMessage: INITIAL_STATUS,
  statusTone: "default",
  resultCount: 0,
  selectedIndex: NO_SELECTION
};
let searchTimer = null;
let activeSearchToken = 0;

function getView() {
  return {
    searchForm: document.querySelector("#search-form"),
    searchInput: document.querySelector("#search-input"),
    statusCard: document.querySelector("#status-card"),
    quickFiltersPanel: document.querySelector("#quick-filters-panel"),
    resultsPanel: document.querySelector("#results-panel")
  };
}

function buildEmptyStateMessage(query) {
  const { keyword, domainFilter } = parseSearchInput(query);

  if (!keyword && !domainFilter) {
    return INITIAL_STATUS;
  }

  return "没有找到匹配的历史记录，试试缩短关键词。";
}

function getVisibleItemCount(groups) {
  return groups.reduce((count, group) => count + group.items.length, 0);
}

function buildStatusMessage(totalCount, visibleCount, activeFilterId, quickFilters, prefix) {
  if (!activeFilterId || activeFilterId === ALL_RESULTS_GROUP_ID) {
    return prefix(totalCount);
  }

  const activeFilter = quickFilters.find((filter) => filter.id === activeFilterId);

  if (!activeFilter) {
    return prefix(totalCount);
  }

  return `${prefix(totalCount)} 当前筛选：${activeFilter.title}，显示 ${visibleCount} 条。`;
}

function buildGroupedState(items, groups, previousFilterId, statusTone, buildBaseMessage) {
  const quickFilters = buildQuickFilters(groups, items);
  const activeFilterId = resolveActiveQuickFilterId(previousFilterId, quickFilters);
  const visibleGroups = filterGroupsByActiveFilterId(groups, activeFilterId);
  const visibleItemCount = getVisibleItemCount(visibleGroups);

  return {
    visibleItems: items,
    allGroups: groups,
    visibleGroups,
    quickFilters,
    activeFilterId,
    statusMessage: buildStatusMessage(items.length, visibleItemCount, activeFilterId, quickFilters, buildBaseMessage),
    statusTone,
    resultCount: visibleItemCount,
    selectedIndex: getDefaultSelectionIndex(visibleItemCount)
  };
}

function buildUngroupedState(items, statusTone, statusMessage) {
  const visibleGroups = items.length === 0
    ? []
    : [
        {
          id: ALL_RESULTS_GROUP_ID,
          title: "全部结果",
          hostname: "",
          count: items.length,
          items
        }
      ];

  return {
    visibleItems: items,
    allGroups: visibleGroups,
    visibleGroups,
    quickFilters: [],
    activeFilterId: "",
    statusMessage,
    statusTone,
    resultCount: items.length,
    selectedIndex: getDefaultSelectionIndex(items.length)
  };
}

function buildResultState(query, rawItems, previousFilterId = "") {
  const { keyword, domainFilter } = parseSearchInput(query);

  if (!keyword && !domainFilter) {
    const defaultItems = buildDefaultHistoryItems(rawItems);

    if (defaultItems.length === 0) {
      return {
        visibleItems: [],
        allGroups: [],
        visibleGroups: [],
        quickFilters: [],
        activeFilterId: "",
        statusMessage: INITIAL_STATUS,
        statusTone: "default",
        resultCount: 0,
        selectedIndex: NO_SELECTION
      };
    }

    return buildUngroupedState(
      defaultItems,
      "default",
      `最近访问的 ${defaultItems.length} 条记录，已按上次访问时间排序。`
    );
  }

  const visibleItems = searchHistoryItems(rawItems, query);

  if (visibleItems.length === 0) {
    return {
      visibleItems,
      allGroups: [],
      visibleGroups: [],
      quickFilters: [],
      activeFilterId: "",
      statusMessage: buildEmptyStateMessage(query),
      statusTone: "default",
      resultCount: 0,
      selectedIndex: NO_SELECTION
    };
  }

  return buildGroupedState(
    visibleItems,
    groupHistoryItemsBySite(visibleItems),
    previousFilterId,
    "success",
    (count) => `找到 ${count} 条结果。`
  );
}

function getRenderedItems() {
  return state.visibleGroups.flatMap((group) => group.items);
}

function getSelectedItem() {
  const renderedItems = getRenderedItems();
  return renderedItems[state.selectedIndex] || null;
}

function focusSearchInput(view, options = {}) {
  if (!view.searchInput || document.visibilityState === "hidden") {
    return;
  }

  view.searchInput.focus({ preventScroll: true });

  if (!options.moveCaretToEnd || typeof view.searchInput.setSelectionRange !== "function") {
    return;
  }

  const caretIndex = view.searchInput.value.length;
  view.searchInput.setSelectionRange(caretIndex, caretIndex);
}

function scrollSelectedRowIntoView(view) {
  const selectedRow = view.resultsPanel.querySelector('[data-selected="true"]');

  if (!selectedRow) {
    return;
  }

  selectedRow.scrollIntoView({
    block: "center",
    inline: "nearest"
  });
}

async function performOpenResult(view, url, options) {
  try {
    await openHistoryResult(url, options);
  } catch (error) {
    console.error("Failed to open history result.", { url, error, options });
    state.statusMessage = "打开页面失败，请稍后重试。";
    state.statusTone = "error";
    syncView(view);
  }
}

function applyActiveFilter(view, filterId, options = {}) {
  if (state.quickFilters.length === 0) {
    return;
  }

  const nextFilterId = resolveActiveQuickFilterId(filterId, state.quickFilters);

  if (!nextFilterId) {
    return;
  }

  state.activeFilterId = nextFilterId;
  state.visibleGroups = filterGroupsByActiveFilterId(state.allGroups, nextFilterId);
  state.resultCount = getVisibleItemCount(state.visibleGroups);
  state.selectedIndex = getDefaultSelectionIndex(state.resultCount);
  state.statusMessage = buildStatusMessage(
    state.visibleItems.length,
    state.resultCount,
    state.activeFilterId,
    state.quickFilters,
    (count) =>
      state.statusTone === "success"
        ? `找到 ${count} 条结果。`
        : `最近访问的 ${count} 条记录，已按上次访问时间排序。`
  );
  syncView(view, options);
}

function setQuickFilterShortcutVisibility(view, isVisible) {
  if (state.showQuickFilterShortcuts === isVisible) {
    return;
  }

  state.showQuickFilterShortcuts = isVisible;
  syncView(view);
}

function syncView(view, options = {}) {
  renderPage(view, state, {
    onSelectQuickFilter(filterId) {
      applyActiveFilter(view, filterId, { scrollSelectionIntoView: true });
      focusSearchInput(view, { moveCaretToEnd: true });
    },
    async onOpenResult(index, url) {
      state.selectedIndex = index;
      syncView(view);
      await performOpenResult(view, url, { openInNewTab: true });
    }
  });

  if (options.scrollSelectionIntoView) {
    requestAnimationFrame(() => {
      scrollSelectedRowIntoView(view);
    });
  }
}

function applySearchState(view, rawItems) {
  Object.assign(state, buildResultState(state.query, rawItems, state.activeFilterId));
  syncView(view);
}

async function runSearch(view, query) {
  const searchToken = ++activeSearchToken;

  state.statusMessage = LOADING_STATUS;
  state.statusTone = "default";
  state.resultCount = 0;
  state.selectedIndex = NO_SELECTION;
  syncView(view);

  try {
    const rawItems = await fetchHistoryItems(query);

    if (searchToken !== activeSearchToken) {
      return;
    }

    applySearchState(view, rawItems);
  } catch (error) {
    if (searchToken !== activeSearchToken) {
      return;
    }

    console.error("Failed to load browsing history.", { error });
    state.statusMessage = SEARCH_ERROR_STATUS;
    state.statusTone = "error";
    state.visibleItems = [];
    state.allGroups = [];
    state.visibleGroups = [];
    state.quickFilters = [];
    state.activeFilterId = "";
    state.resultCount = 0;
    state.selectedIndex = NO_SELECTION;
    syncView(view);
  }
}

function scheduleSearch(view, immediate = false) {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }

  const run = () => {
    searchTimer = null;
    runSearch(view, state.query);
  };

  if (immediate) {
    run();
    return;
  }

  searchTimer = setTimeout(run, 150);
}

async function flushPendingSearch(view) {
  if (!searchTimer) {
    return;
  }

  clearTimeout(searchTimer);
  searchTimer = null;
  await runSearch(view, state.query);
}

async function handleSearchInputKeydown(view, event) {
  if (event.isComposing || event.metaKey) {
    return;
  }

  const quickFilter = event.ctrlKey && !event.altKey
    ? getQuickFilterByShortcut(state.quickFilters, event.key)
    : null;

  if (quickFilter) {
    event.preventDefault();
    applyActiveFilter(view, quickFilter.id, { scrollSelectionIntoView: true });
    return;
  }

  if (event.altKey || event.ctrlKey) {
    return;
  }

  const renderedItems = getRenderedItems();

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (renderedItems.length === 0) {
      return;
    }

    event.preventDefault();
    state.selectedIndex = moveSelectionIndex(
      state.selectedIndex,
      renderedItems.length,
      event.key === "ArrowDown" ? 1 : -1
    );
    syncView(view, { scrollSelectionIntoView: true });
    return;
  }

  if (event.key !== "Enter") {
    return;
  }

  if (!getSelectedItem() && !searchTimer) {
    return;
  }

  event.preventDefault();
  await flushPendingSearch(view);

  const selectedItem = getSelectedItem();

  if (!selectedItem) {
    return;
  }

  await performOpenResult(view, selectedItem.url, { openInNewTab: event.shiftKey });
}

function bindEvents(view) {
  view.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.query = view.searchInput.value;
    scheduleSearch(view, true);
  });

  view.searchInput.addEventListener("input", () => {
    state.query = view.searchInput.value;
    scheduleSearch(view);
  });

  view.searchInput.addEventListener("keydown", (event) => {
    void handleSearchInputKeydown(view, event);
  });

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.altKey) {
      return;
    }

    if (event.key === "Control" || event.ctrlKey) {
      setQuickFilterShortcutVisibility(view, true);
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "Control" || !event.ctrlKey) {
      setQuickFilterShortcutVisibility(view, false);
    }
  });

  window.addEventListener("blur", () => {
    setQuickFilterShortcutVisibility(view, false);
  });

  window.addEventListener("focus", () => {
    requestAnimationFrame(() => {
      focusSearchInput(view, { moveCaretToEnd: true });
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      setQuickFilterShortcutVisibility(view, false);
      return;
    }

    requestAnimationFrame(() => {
      focusSearchInput(view, { moveCaretToEnd: true });
    });
  });
}

function init() {
  const view = getView();
  bindEvents(view);
  syncView(view);
  runSearch(view, state.query);
  focusSearchInput(view, { moveCaretToEnd: true });
}

document.addEventListener("DOMContentLoaded", init);
