import { parseSearchInput } from "../../historySearch.js";

export const PRIMARY_HISTORY_SEARCH_LIMIT = 500;
export const SUPPLEMENTARY_HISTORY_SEARCH_LIMIT = 1500;
export const SUPPLEMENTARY_RESULT_THRESHOLD = 20;
const SUPPLEMENTARY_LOOKBACK_MS = 1000 * 60 * 60 * 24 * 365 * 2;

export function buildPrimaryHistorySearchRequest(rawQuery) {
  const { keyword } = parseSearchInput(rawQuery);
  return {
    text: keyword,
    startTime: 0,
    maxResults: PRIMARY_HISTORY_SEARCH_LIMIT
  };
}

export function buildSupplementaryHistorySearchRequest(now = Date.now()) {
  return {
    text: "",
    startTime: now - SUPPLEMENTARY_LOOKBACK_MS,
    maxResults: SUPPLEMENTARY_HISTORY_SEARCH_LIMIT
  };
}

export function shouldSupplementHistoryResults(rawQuery, primaryItems) {
  const { keyword, domainFilter } = parseSearchInput(rawQuery);

  if (!keyword && !domainFilter) {
    return false;
  }

  if (!keyword && domainFilter) {
    return true;
  }

  return primaryItems.length < SUPPLEMENTARY_RESULT_THRESHOLD;
}

export function mergeHistoryItems(primaryItems, supplementaryItems) {
  const mergedItems = new Map();

  for (const item of [...primaryItems, ...supplementaryItems]) {
    const itemKey = item.url || `${item.id || "unknown"}-${item.lastVisitTime || 0}`;

    if (!mergedItems.has(itemKey)) {
      mergedItems.set(itemKey, item);
    }
  }

  return Array.from(mergedItems.values());
}

export async function fetchHistoryItems(rawQuery) {
  const primaryRequest = buildPrimaryHistorySearchRequest(rawQuery);
  const primaryItems = primaryRequest.text
    ? await chrome.history.search(primaryRequest)
    : [];

  if (!shouldSupplementHistoryResults(rawQuery, primaryItems)) {
    return primaryItems;
  }

  const supplementaryItems = await chrome.history.search(buildSupplementaryHistorySearchRequest());
  return mergeHistoryItems(primaryItems, supplementaryItems);
}
