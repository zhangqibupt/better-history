import {
  buildDefaultHistoryItems,
  ALL_RESULTS_GROUP_ID,
  groupHistoryItemsBySite,
  parseSearchInput,
  searchHistoryItems
} from "../historySearch.js";
import { getResultRowId, renderPage, renderQuickFilters } from "./render.js";
import { fetchHistoryItems } from "./services/historyService.js";
import { openHistoryResult } from "./services/navigationService.js";
import { reorderGroupsByDomainPriority, validateDomainPriority } from "./services/domainPriorityService.js";
import {
  buildQuickFilters,
  filterGroupsByActiveFilterId,
  getQuickFilterByShortcut,
  resolveActiveQuickFilterId
} from "./services/quickFilterService.js";
import { DEFAULT_SETTINGS, loadSearchPageSettings, saveSearchPageSettings } from "./services/settingsService.js";
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
  settings: { ...DEFAULT_SETTINGS },
  draftSettings: { ...DEFAULT_SETTINGS },
  settingsDialogOpen: false,
  settingsFeedback: {
    tone: "",
    message: ""
  },
  resultCount: 0,
  selectedIndex: NO_SELECTION
};
let searchTimer = null;
let activeSearchToken = 0;
const DEBUG_BUILD_TAG = "history-filter-debug-20260510-01";

function getView() {
  return {
    searchForm: document.querySelector("#search-form"),
    searchInput: document.querySelector("#search-input"),
    settingsButton: document.querySelector("#settings-button"),
    settingsDialog: document.querySelector("#settings-dialog"),
    settingsCloseButton: document.querySelector("#settings-close-button"),
    settingsSaveButton: document.querySelector("#settings-save-button"),
    settingsResetButton: document.querySelector("#settings-reset-button"),
    domainPriorityForm: document.querySelector("#domain-priority-form"),
    domainPriorityInput: document.querySelector("#domain-priority-input"),
    domainPriorityFeedback: document.querySelector("#domain-priority-feedback"),
    domainPriorityList: document.querySelector("#domain-priority-list"),
    quickFiltersPanel: document.querySelector("#quick-filters-panel"),
    resultsPanel: document.querySelector("#results-panel"),
    resultsTitle: document.querySelector("#results-title"),
    resultsCountText: document.querySelector("#results-count-text")
  };
}

function getVisibleItemCount(groups) {
  return groups.reduce((count, group) => count + group.items.length, 0);
}

function buildGroupedState(items, groups, previousFilterId, prioritizedDomains) {
  const orderedGroups = reorderGroupsByDomainPriority(groups, prioritizedDomains);
  const quickFilters = buildQuickFilters(orderedGroups, items);
  const activeFilterId = resolveActiveQuickFilterId(previousFilterId, quickFilters);
  const visibleGroups = filterGroupsByActiveFilterId(orderedGroups, activeFilterId);
  const visibleItemCount = getVisibleItemCount(visibleGroups);

  return {
    visibleItems: items,
    allGroups: orderedGroups,
    visibleGroups,
    quickFilters,
    activeFilterId,
    resultCount: visibleItemCount,
    selectedIndex: getDefaultSelectionIndex(visibleItemCount)
  };
}

function buildUngroupedState(items) {
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
    resultCount: items.length,
    selectedIndex: getDefaultSelectionIndex(items.length)
  };
}

function buildResultState(query, rawItems, previousFilterId = "", settings = DEFAULT_SETTINGS) {
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
        resultCount: 0,
        selectedIndex: NO_SELECTION
      };
    }

    return buildUngroupedState(defaultItems);
  }

  const visibleItems = searchHistoryItems(rawItems, query);

  if (visibleItems.length === 0) {
    return {
      visibleItems,
      allGroups: [],
      visibleGroups: [],
      quickFilters: [],
      activeFilterId: "",
      resultCount: 0,
      selectedIndex: NO_SELECTION
    };
  }

  return buildGroupedState(
    visibleItems,
    groupHistoryItemsBySite(visibleItems, {
      domainPriorities: settings.domainPriorities
    }),
    previousFilterId,
    settings.domainPriorities
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

function focusDomainPriorityInput(view) {
  if (!state.settingsDialogOpen || !view.domainPriorityInput) {
    return;
  }

  view.domainPriorityInput.focus({ preventScroll: true });
}

function scrollSelectedRowIntoView(view) {
  const selectedRow = view.resultsPanel.querySelector('[data-selected="true"]');

  if (!selectedRow) {
    return;
  }

  const stickyBottom = view.searchForm?.getBoundingClientRect().bottom ?? 0;
  const topBoundary = stickyBottom + 20;
  const bottomBoundary = window.innerHeight - 72;
  const selectedRect = selectedRow.getBoundingClientRect();

  if (selectedRect.bottom > bottomBoundary) {
    window.scrollBy({
      top: selectedRect.bottom - bottomBoundary,
      behavior: "auto"
    });
    return;
  }

  if (selectedRect.top < topBoundary) {
    window.scrollBy({
      top: selectedRect.top - topBoundary,
      behavior: "auto"
    });
  }
}

function setResultRowSelectionState(row, isSelected) {
  if (!row) {
    return;
  }

  row.dataset.selected = isSelected ? "true" : "false";
  row.setAttribute("aria-selected", isSelected ? "true" : "false");
}

function updateSelectedResultRow(view, previousIndex, nextIndex) {
  if (view.resultsPanel.childElementCount !== state.resultCount) {
    return false;
  }

  const previousRow =
    previousIndex === NO_SELECTION ? null : document.getElementById(getResultRowId(previousIndex));
  const nextRow =
    nextIndex === NO_SELECTION ? null : document.getElementById(getResultRowId(nextIndex));

  if (previousIndex !== NO_SELECTION && !previousRow) {
    return false;
  }

  if (nextIndex !== NO_SELECTION && !nextRow) {
    return false;
  }

  setResultRowSelectionState(previousRow, false);
  setResultRowSelectionState(nextRow, true);

  if (nextIndex === NO_SELECTION) {
    view.resultsPanel.removeAttribute("aria-activedescendant");
    return true;
  }

  view.resultsPanel.setAttribute("aria-activedescendant", getResultRowId(nextIndex));
  return true;
}

function updateSelectedIndex(view, nextIndex, options = {}) {
  if (state.selectedIndex === nextIndex) {
    return;
  }

  const previousIndex = state.selectedIndex;
  state.selectedIndex = nextIndex;

  if (!updateSelectedResultRow(view, previousIndex, nextIndex)) {
    syncView(view, options);
    return;
  }

  if (options.scrollSelectionIntoView) {
    requestAnimationFrame(() => {
      scrollSelectedRowIntoView(view);
    });
  }
}

async function performOpenResult(url, options) {
  try {
    await openHistoryResult(url, options);
  } catch (error) {
    console.error("Failed to open history result.", { url, error, options });
  }
}

function setSettingsFeedback(tone, message) {
  state.settingsFeedback = { tone, message };
}

function replaceDraftSettings(nextDraftSettings) {
  state.draftSettings = {
    ...DEFAULT_SETTINGS,
    ...nextDraftSettings
  };
}

function openSettingsDialog(view) {
  replaceDraftSettings(state.settings);
  state.settingsDialogOpen = true;
  setSettingsFeedback("", "");
  if (view.domainPriorityInput) {
    view.domainPriorityInput.value = "";
  }
  syncView(view);
  requestAnimationFrame(() => {
    focusDomainPriorityInput(view);
  });
}

function closeSettingsDialog(view, options = {}) {
  state.settingsDialogOpen = false;
  setSettingsFeedback("", "");
  if (view.domainPriorityInput) {
    view.domainPriorityInput.value = "";
  }
  syncView(view);
  requestAnimationFrame(() => {
    if (options.restoreFocusToSettingsButton) {
      view.settingsButton?.focus({ preventScroll: true });
      return;
    }

    focusSearchInput(view, { moveCaretToEnd: true });
  });
}

function moveDraftDomainPriority(fromIndex, toIndex) {
  const nextDomainPriorities = [...state.draftSettings.domainPriorities];
  const [movedDomain] = nextDomainPriorities.splice(fromIndex, 1);

  if (!movedDomain) {
    return;
  }

  nextDomainPriorities.splice(toIndex, 0, movedDomain);
  replaceDraftSettings({
    ...state.draftSettings,
    domainPriorities: nextDomainPriorities
  });
}

function removeDraftDomainPriority(index) {
  replaceDraftSettings({
    ...state.draftSettings,
    domainPriorities: state.draftSettings.domainPriorities.filter((_, currentIndex) => currentIndex !== index)
  });
}

function addDraftDomainPriority(view) {
  const validation = validateDomainPriority(
    view.domainPriorityInput?.value ?? "",
    state.draftSettings.domainPriorities
  );

  if (!validation.isValid) {
    setSettingsFeedback("error", validation.message);
    syncView(view);
    focusDomainPriorityInput(view);
    return;
  }

  replaceDraftSettings({
    ...state.draftSettings,
    domainPriorities: [...state.draftSettings.domainPriorities, validation.normalizedDomain]
  });
  setSettingsFeedback("success", `已添加 ${validation.normalizedDomain}`);
  syncView(view);

  if (view.domainPriorityInput) {
    view.domainPriorityInput.value = "";
  }

  focusDomainPriorityInput(view);
}

async function saveSettingsAndRefresh(view) {
  const { settings, success } = saveSearchPageSettings(state.draftSettings);

  if (!success) {
    setSettingsFeedback("error", "保存失败，请检查浏览器是否允许本地存储。");
    syncView(view);
    return;
  }

  state.settings = settings;
  setSettingsFeedback("success", "设置已保存。");
  closeSettingsDialog(view);
  await runSearch(view, state.query);
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
  syncView(view, options);
}

function setQuickFilterShortcutVisibility(view, isVisible) {
  if (state.showQuickFilterShortcuts === isVisible) {
    return;
  }

  state.showQuickFilterShortcuts = isVisible;
  renderQuickFilters(view, state, buildRenderActions(view));
}

function buildRenderActions(view) {
  return {
    onOpenSettings() {
      openSettingsDialog(view);
    },
    onCloseSettings() {
      closeSettingsDialog(view, { restoreFocusToSettingsButton: true });
    },
    onResetSettings() {
      replaceDraftSettings(DEFAULT_SETTINGS);
      setSettingsFeedback("success", "已恢复默认优先级。");
      syncView(view);
      focusDomainPriorityInput(view);
    },
    onSaveSettings() {
      void saveSettingsAndRefresh(view);
    },
    onAddDomainPriority() {
      addDraftDomainPriority(view);
    },
    onMoveDomainPriorityUp(index) {
      moveDraftDomainPriority(index, Math.max(0, index - 1));
      setSettingsFeedback("", "");
      syncView(view);
    },
    onMoveDomainPriorityDown(index) {
      moveDraftDomainPriority(
        index,
        Math.min(state.draftSettings.domainPriorities.length - 1, index + 1)
      );
      setSettingsFeedback("", "");
      syncView(view);
    },
    onRemoveDomainPriority(index) {
      removeDraftDomainPriority(index);
      setSettingsFeedback("", "");
      syncView(view);
      focusDomainPriorityInput(view);
    },
    onSelectQuickFilter(filterId) {
      applyActiveFilter(view, filterId, { scrollSelectionIntoView: true });
      focusSearchInput(view, { moveCaretToEnd: true });
    },
    async onOpenResult(index, url) {
      updateSelectedIndex(view, index);
      await performOpenResult(url, { openInNewTab: true });
    }
  };
}

function syncView(view, options = {}) {
  renderPage(view, state, buildRenderActions(view));

  if (options.scrollSelectionIntoView) {
    requestAnimationFrame(() => {
      scrollSelectedRowIntoView(view);
    });
  }
}

function applySearchState(view, rawItems) {
  Object.assign(state, buildResultState(state.query, rawItems, state.activeFilterId, state.settings));
  syncView(view);
}

async function runSearch(view, query) {
  const searchToken = ++activeSearchToken;

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
    updateSelectedIndex(
      view,
      moveSelectionIndex(
      state.selectedIndex,
      renderedItems.length,
      event.key === "ArrowDown" ? 1 : -1
      ),
      { scrollSelectionIntoView: true }
    );
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

  await performOpenResult(selectedItem.url, { openInNewTab: event.shiftKey });
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

  view.settingsButton.addEventListener("click", () => {
    openSettingsDialog(view);
  });

  view.settingsCloseButton.addEventListener("click", () => {
    closeSettingsDialog(view, { restoreFocusToSettingsButton: true });
  });

  view.settingsSaveButton.addEventListener("click", () => {
    void saveSettingsAndRefresh(view);
  });

  view.settingsResetButton.addEventListener("click", () => {
    replaceDraftSettings(DEFAULT_SETTINGS);
    setSettingsFeedback("success", "已恢复默认优先级。");
    syncView(view);
    focusDomainPriorityInput(view);
  });

  view.domainPriorityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addDraftDomainPriority(view);
  });

  view.settingsDialog.addEventListener("click", (event) => {
    if (event.target === view.settingsDialog) {
      closeSettingsDialog(view, { restoreFocusToSettingsButton: true });
    }
  });

  window.addEventListener("keydown", (event) => {
    if (state.settingsDialogOpen && event.key === "Escape") {
      event.preventDefault();
      closeSettingsDialog(view, { restoreFocusToSettingsButton: true });
      return;
    }

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
      if (state.settingsDialogOpen) {
        focusDomainPriorityInput(view);
        return;
      }

      focusSearchInput(view, { moveCaretToEnd: true });
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      setQuickFilterShortcutVisibility(view, false);
      return;
    }

    requestAnimationFrame(() => {
      if (state.settingsDialogOpen) {
        focusDomainPriorityInput(view);
        return;
      }

      focusSearchInput(view, { moveCaretToEnd: true });
    });
  });
}

function init() {
  const view = getView();
  globalThis.__BETTER_HISTORY_BUILD__ = DEBUG_BUILD_TAG;
  state.settings = loadSearchPageSettings();
  replaceDraftSettings(state.settings);
  bindEvents(view);
  syncView(view);
  runSearch(view, state.query);
  focusSearchInput(view, { moveCaretToEnd: true });
}

document.addEventListener("DOMContentLoaded", init);
