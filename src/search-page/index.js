import { parseSearchInput, searchHistoryItems } from "../historySearch.js";
import { INITIAL_STATUS, LOADING_STATUS, SEARCH_ERROR_STATUS } from "./constants.js";
import { renderPage } from "./render.js";
import { fetchHistoryItems } from "./services/historyService.js";
import { openHistoryResult } from "./services/navigationService.js";

const state = {
  query: "",
  visibleItems: [],
  statusMessage: INITIAL_STATUS,
  statusTone: "default",
  resultCount: 0
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
  const visibleItems = searchHistoryItems(rawItems, query);

  if (visibleItems.length === 0) {
    return {
      visibleItems,
      statusMessage: buildEmptyStateMessage(query),
      statusTone: "default",
      resultCount: 0
    };
  }

  const statusMessage = `找到 ${visibleItems.length} 条结果。`;

  return {
    visibleItems,
    statusMessage,
    statusTone: "success",
    resultCount: visibleItems.length
  };
}

function syncView(view) {
  renderPage(view, state, {
    async onOpenResult(url) {
      try {
        await openHistoryResult(url);
      } catch (error) {
        console.error("Failed to open history result.", { url, error });
        state.statusMessage = "打开页面失败，请稍后重试。";
        state.statusTone = "error";
        syncView(view);
      }
    }
  });
}

function applySearchState(view, rawItems) {
  Object.assign(state, buildResultState(state.query, rawItems));
  syncView(view);
}

async function runSearch(view, query) {
  const searchToken = ++activeSearchToken;
  const { keyword, domainFilter } = parseSearchInput(query);

  if (!keyword && !domainFilter) {
    state.visibleItems = [];
    state.statusMessage = INITIAL_STATUS;
    state.statusTone = "default";
    state.resultCount = 0;
    syncView(view);
    return;
  }

  state.statusMessage = LOADING_STATUS;
  state.statusTone = "default";
  state.resultCount = 0;
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
    state.resultCount = 0;
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
}

function init() {
  const view = getView();
  bindEvents(view);
  syncView(view);
  view.searchInput.focus();
}

document.addEventListener("DOMContentLoaded", init);
