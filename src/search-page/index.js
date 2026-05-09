import {
  buildDefaultHistoryItems,
  groupHistoryItemsBySite,
  parseSearchInput,
  searchHistoryItems
} from "../historySearch.js";
import { INITIAL_STATUS, LOADING_STATUS, SEARCH_ERROR_STATUS } from "./constants.js";
import { renderPage } from "./render.js";
import { fetchHistoryItems } from "./services/historyService.js";
import { openHistoryResult } from "./services/navigationService.js";
import {
  NO_SELECTION,
  getDefaultSelectionIndex,
  moveSelectionIndex
} from "./services/selectionService.js";

const state = {
  query: "",
  visibleItems: [],
  visibleGroups: [],
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

function buildResultState(query, rawItems) {
  const { keyword, domainFilter } = parseSearchInput(query);

  if (!keyword && !domainFilter) {
    const defaultItems = buildDefaultHistoryItems(rawItems);

    return {
      visibleItems: defaultItems,
      visibleGroups: defaultItems.length > 0 ? groupHistoryItemsBySite(defaultItems) : [],
      statusMessage:
        defaultItems.length > 0
          ? `最近访问的 ${defaultItems.length} 条记录，已按相似图标来源自动聚集排序。`
          : INITIAL_STATUS,
      statusTone: "default",
      resultCount: defaultItems.length,
      selectedIndex: getDefaultSelectionIndex(defaultItems.length)
    };
  }

  const visibleItems = searchHistoryItems(rawItems, query);

  if (visibleItems.length === 0) {
    return {
      visibleItems,
      visibleGroups: [],
      statusMessage: buildEmptyStateMessage(query),
      statusTone: "default",
      resultCount: 0,
      selectedIndex: NO_SELECTION
    };
  }

  const visibleGroups = groupHistoryItemsBySite(visibleItems);
  const statusMessage =
    visibleGroups.length > 1
      ? `找到 ${visibleItems.length} 条结果。`
      : `找到 ${visibleItems.length} 条结果。`;

  return {
    visibleItems,
    visibleGroups,
    statusMessage,
    statusTone: "success",
    resultCount: visibleItems.length,
    selectedIndex: getDefaultSelectionIndex(visibleItems.length)
  };
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

function syncView(view, options = {}) {
  renderPage(view, state, {
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
  Object.assign(state, buildResultState(state.query, rawItems));
  syncView(view);
}

async function runSearch(view, query) {
  const searchToken = ++activeSearchToken;
  const { keyword, domainFilter } = parseSearchInput(query);

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
    state.visibleGroups = [];
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
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
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

  window.addEventListener("focus", () => {
    requestAnimationFrame(() => {
      focusSearchInput(view, { moveCaretToEnd: true });
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
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
