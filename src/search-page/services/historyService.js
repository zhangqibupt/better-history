import { filterExcludedHistoryItems, parseSearchInput } from "../../historySearch.js";

export const DEFAULT_HISTORY_PREFETCH_LIMIT = 50;
export const PRIMARY_HISTORY_SEARCH_LIMIT = 500;
export const SUPPLEMENTARY_HISTORY_SEARCH_LIMIT = 1500;
export const SUPPLEMENTARY_RESULT_THRESHOLD = 20;
const SUPPLEMENTARY_LOOKBACK_MS = 1000 * 60 * 60 * 24 * 365 * 2;
const DEBUG_BUILD_TAG = "history-filter-debug-20260510-01";

function publishHistoryDebug(query, rawItems, filteredItems) {
  const excludedItems = rawItems.filter((item) => !filteredItems.includes(item));
  const debugPayload = {
    buildTag: DEBUG_BUILD_TAG,
    query,
    rawCount: rawItems.length,
    filteredCount: filteredItems.length,
    excludedCount: excludedItems.length,
    excludedItems: excludedItems.map((item) => ({
      title: item?.title ?? "",
      url: item?.url ?? ""
    })),
    keptItems: filteredItems.map((item) => ({
      title: item?.title ?? "",
      url: item?.url ?? ""
    }))
  };

  globalThis.__BETTER_HISTORY_DEBUG__ = debugPayload;
  console.info("[Better History][debug]", debugPayload);
}

export function buildDefaultHistoryRequest() {
  return {
    text: "",
    startTime: 0,
    maxResults: DEFAULT_HISTORY_PREFETCH_LIMIT
  };
}

export function buildPrimaryHistorySearchRequest(rawQuery) {
  const { keywordTokens } = parseSearchInput(rawQuery);
  const primaryKeyword = keywordTokens.reduce((longestToken, token) => {
    if (token.length > longestToken.length) {
      return token;
    }

    return longestToken;
  }, "");

  return {
    text: primaryKeyword,
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
  const { keywordTokens, domainFilter } = parseSearchInput(rawQuery);

  if (keywordTokens.length === 0 && !domainFilter) {
    return false;
  }

  if (keywordTokens.length === 0 && domainFilter) {
    return true;
  }

  if (keywordTokens.length > 1) {
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
  const { keywordTokens, domainFilter } = parseSearchInput(rawQuery);

  if (keywordTokens.length === 0 && !domainFilter) {
    const recentItems = await chrome.history.search(buildDefaultHistoryRequest());
    const filteredItems = filterExcludedHistoryItems(recentItems);
    publishHistoryDebug(rawQuery, recentItems, filteredItems);
    return filteredItems;
  }

  const primaryRequest = buildPrimaryHistorySearchRequest(rawQuery);
  const primaryItems = primaryRequest.text
    ? await chrome.history.search(primaryRequest)
    : [];

  if (!shouldSupplementHistoryResults(rawQuery, primaryItems)) {
    const filteredItems = filterExcludedHistoryItems(primaryItems);
    publishHistoryDebug(rawQuery, primaryItems, filteredItems);
    return filteredItems;
  }

  const supplementaryItems = await chrome.history.search(buildSupplementaryHistorySearchRequest());
  const mergedItems = mergeHistoryItems(primaryItems, supplementaryItems);
  const filteredItems = filterExcludedHistoryItems(mergedItems);
  publishHistoryDebug(rawQuery, mergedItems, filteredItems);
  return filteredItems;
}
