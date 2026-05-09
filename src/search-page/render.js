import { parseSearchInput } from "../historySearch.js";
import { appendHighlightedText } from "./utils/highlight.js";
import { buildFallbackIconUrl, buildFaviconUrl, markFaviconFailed } from "./utils/favicon.js";
import { formatDisplayUrl } from "./utils/formatters.js";

function createElement(tagName, className) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  return element;
}

function applyFavicon(image, item) {
  const fallbackUrl = buildFallbackIconUrl(item);
  const faviconUrl = buildFaviconUrl(item);

  if (!faviconUrl) {
    image.src = fallbackUrl;
    return;
  }

  image.src = faviconUrl;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener(
    "error",
    () => {
      if (image.dataset.fallbackApplied === "true") {
        return;
      }

      image.dataset.fallbackApplied = "true";
      markFaviconFailed(item);
      image.src = fallbackUrl;
    },
    { once: true }
  );
}

function renderResultsSummary(view, state) {
  const { keyword, domainFilter } = parseSearchInput(state.query);
  const hasSearchQuery = Boolean(keyword || domainFilter);

  view.resultsTitle.textContent = hasSearchQuery ? "搜索结果" : "最近访问";
  view.resultsCountText.textContent = `${state.resultCount} 条`;
}

function createQuickFilterIcon(filter) {
  if (!filter.representativeItem) {
    const fallbackIcon = createElement("span", "quick-filter-icon quick-filter-icon-all");
    fallbackIcon.textContent = "全";
    fallbackIcon.setAttribute("aria-hidden", "true");
    return fallbackIcon;
  }

  const icon = createElement("img", "quick-filter-icon");
  applyFavicon(icon, filter.representativeItem);
  return icon;
}

function createQuickFilterButton(filter, actions, isActive, showShortcut) {
  const button = createElement("button", "quick-filter-button");
  button.type = "button";
  button.dataset.active = isActive ? "true" : "false";
  button.dataset.showShortcut = showShortcut ? "true" : "false";
  button.setAttribute("aria-pressed", isActive ? "true" : "false");
  button.title = `${filter.title}（${filter.count} 条）`;
  button.addEventListener("mousedown", (event) => {
    // Keep the search input focused while toggling filters with the mouse.
    event.preventDefault();
  });
  button.addEventListener("click", () => {
    actions.onSelectQuickFilter(filter.id);
  });

  const label = createElement("span", "quick-filter-label");
  label.textContent = filter.title;

  button.append(createQuickFilterIcon(filter), label);

  if (filter.shortcut) {
    const shortcut = createElement("span", "quick-filter-shortcut");
    shortcut.textContent = filter.shortcut;
    shortcut.setAttribute("aria-hidden", "true");
    button.append(shortcut);
  }

  return button;
}

function renderQuickFilters(view, state, actions) {
  view.quickFiltersPanel.replaceChildren();

  if (state.quickFilters.length === 0) {
    view.quickFiltersPanel.hidden = true;
    return;
  }

  view.quickFiltersPanel.hidden = false;
  view.quickFiltersPanel.setAttribute("role", "toolbar");
  view.quickFiltersPanel.setAttribute("aria-label", "站点快捷筛选");

  const buttons = state.quickFilters.map((filter) =>
    createQuickFilterButton(
      filter,
      actions,
      filter.id === state.activeFilterId,
      state.showQuickFilterShortcuts
    )
  );
  view.quickFiltersPanel.append(...buttons);
}

function createResultUrl(item, keyword) {
  const resultUrl = createElement("span", "result-url");
  appendHighlightedText(resultUrl, formatDisplayUrl(item.url), keyword);
  resultUrl.title = item.url || "";
  return resultUrl;
}

function getResultRowId(index) {
  return `result-option-${index}`;
}

function createResultRow(item, keyword, actions, index, isSelected) {
  const button = createElement("button", "result-row");
  button.type = "button";
  button.id = getResultRowId(index);
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", isSelected ? "true" : "false");
  button.setAttribute("aria-label", `${item.title?.trim() || "Untitled page"} ${item.url || ""}`);
  button.dataset.selected = isSelected ? "true" : "false";
  button.tabIndex = -1;
  button.title = `${item.title?.trim() || "Untitled page"}\n${item.url || ""}`;
  button.addEventListener("mousedown", (event) => {
    // Keep the search input focused while still allowing mouse click to open the result.
    event.preventDefault();
  });
  button.addEventListener("click", () => {
    actions.onOpenResult(index, item.url);
  });

  const icon = createElement("img", "result-icon");
  applyFavicon(icon, item);

  const title = createElement("span", "result-title");
  appendHighlightedText(title, item.title?.trim() || "Untitled page", keyword);
  title.title = item.title?.trim() || "Untitled page";

  button.append(icon, title, createResultUrl(item, keyword));
  return button;
}

function renderResults(view, state, actions) {
  view.resultsPanel.replaceChildren();
  view.resultsPanel.setAttribute("role", "listbox");
  view.resultsPanel.setAttribute("aria-label", "搜索结果");

  if (state.visibleGroups.length === 0) {
    view.resultsPanel.removeAttribute("aria-activedescendant");
    return;
  }

  const { keyword } = parseSearchInput(state.query);
  let rowIndex = 0;
  const rows = state.visibleGroups.flatMap((group) =>
    group.items.map((item) => {
      const currentIndex = rowIndex++;
      return createResultRow(item, keyword, actions, currentIndex, currentIndex === state.selectedIndex);
    })
  );

  if (state.selectedIndex >= 0) {
    view.resultsPanel.setAttribute("aria-activedescendant", getResultRowId(state.selectedIndex));
  } else {
    view.resultsPanel.removeAttribute("aria-activedescendant");
  }

  view.resultsPanel.append(...rows);
}

export function renderPage(view, state, actions) {
  renderResultsSummary(view, state);
  renderQuickFilters(view, state, actions);
  renderResults(view, state, actions);
}
