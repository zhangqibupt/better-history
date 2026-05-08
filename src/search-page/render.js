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

function renderStatus(view, state) {
  view.statusCard.textContent = state.statusMessage;
  view.statusCard.dataset.tone = state.statusTone;
}

function createResultUrl(item, keyword) {
  const resultUrl = createElement("span", "result-url");
  appendHighlightedText(resultUrl, formatDisplayUrl(item.url), keyword);
  resultUrl.title = item.url || "";
  return resultUrl;
}

function createResultRow(item, keyword, actions) {
  const button = createElement("button", "result-row");
  button.type = "button";
  button.title = `${item.title?.trim() || "Untitled page"}\n${item.url || ""}`;
  button.addEventListener("click", () => {
    actions.onOpenResult(item.url);
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

  if (state.visibleItems.length === 0) {
    return;
  }

  const { keyword } = parseSearchInput(state.query);
  const rows = state.visibleItems.map((item) => createResultRow(item, keyword, actions));
  view.resultsPanel.append(...rows);
}

export function renderPage(view, state, actions) {
  renderStatus(view, state);
  renderResults(view, state, actions);
}
