export const HISTORY_FETCH_LIMIT = 100000;
const TITLE_MATCH_PRIORITY = 0;
const NON_TITLE_MATCH_PRIORITY = 1;

export function normalizeQuery(query) {
  return (query ?? "").trim().toLowerCase();
}

function normalizeDomainFilter(domainFilter) {
  return normalizeQuery(domainFilter).replace(/^\.+|\.+$/g, "");
}

export function normalizeUrl(rawUrl) {
  if (!rawUrl) {
    return "";
  }

  try {
    const parsedUrl = new URL(rawUrl);
    parsedUrl.hash = "";
    return parsedUrl.href;
  } catch {
    return rawUrl.split("#")[0];
  }
}

export function getHostname(rawUrl) {
  if (!rawUrl) {
    return "";
  }

  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeTitle(rawTitle) {
  return (rawTitle ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseSearchInput(rawQuery) {
  const normalizedQuery = normalizeQuery(rawQuery);

  if (!normalizedQuery) {
    return { keyword: "", domainFilter: "" };
  }

  const matchedDomainToken = normalizedQuery.match(/(?:^|\s)(?:site|domain):([^\s]+)/);
  const domainFilter = normalizeDomainFilter(matchedDomainToken?.[1] ?? "");
  const keyword = normalizedQuery.replace(/(?:^|\s)(?:site|domain):([^\s]+)/g, " ").trim();
  return { keyword, domainFilter };
}

export function matchesDomain(hostname, domainFilter) {
  const normalizedDomainFilter = normalizeDomainFilter(domainFilter);

  if (!normalizedDomainFilter) {
    return true;
  }

  return hostname === normalizedDomainFilter || hostname.endsWith(`.${normalizedDomainFilter}`);
}

function matchesKeyword(item, normalizedKeyword) {
  if (!normalizedKeyword) {
    return true;
  }

  const title = (item.title ?? "").toLowerCase();
  const url = (item.url ?? "").toLowerCase();
  return title.includes(normalizedKeyword) || url.includes(normalizedKeyword);
}

function getMatchPriority(item, normalizedKeyword) {
  if (!normalizedKeyword) {
    return NON_TITLE_MATCH_PRIORITY;
  }

  const title = (item.title ?? "").toLowerCase();
  return title.includes(normalizedKeyword) ? TITLE_MATCH_PRIORITY : NON_TITLE_MATCH_PRIORITY;
}

function compareHistoryItems(left, right) {
  const matchPriorityDiff =
    (left.matchPriority ?? NON_TITLE_MATCH_PRIORITY) -
    (right.matchPriority ?? NON_TITLE_MATCH_PRIORITY);

  if (matchPriorityDiff !== 0) {
    return matchPriorityDiff;
  }

  const lastVisitTimeDiff = (right.lastVisitTime ?? 0) - (left.lastVisitTime ?? 0);

  if (lastVisitTimeDiff !== 0) {
    return lastVisitTimeDiff;
  }

  const visitCountDiff = (right.visitCount ?? 0) - (left.visitCount ?? 0);

  if (visitCountDiff !== 0) {
    return visitCountDiff;
  }

  return (left.url ?? "").localeCompare(right.url ?? "");
}

function selectRepresentativeItem(currentItem, nextItem) {
  return compareHistoryItems(currentItem, nextItem) <= 0 ? currentItem : nextItem;
}

function enrichMatchedItem(item, normalizedKeyword) {
  const normalizedUrl = normalizeUrl(item.url);

  if (!normalizedUrl) {
    return null;
  }

  return {
    ...item,
    url: normalizedUrl,
    hostname: getHostname(normalizedUrl),
    matchPriority: getMatchPriority(item, normalizedKeyword)
  };
}

function dedupeByNormalizedUrl(items) {
  const uniqueItems = new Map();

  for (const item of items) {
    const existingItem = uniqueItems.get(item.url);

    if (!existingItem) {
      uniqueItems.set(item.url, item);
      continue;
    }

    uniqueItems.set(item.url, selectRepresentativeItem(existingItem, item));
  }

  return Array.from(uniqueItems.values());
}

function dedupeByDomainAndTitle(items) {
  const uniqueItems = new Map();

  for (const item of items) {
    const normalizedItemTitle = normalizeTitle(item.title);

    if (!item.hostname || !normalizedItemTitle) {
      uniqueItems.set(item.url, item);
      continue;
    }

    const dedupeKey = `${item.hostname}::${normalizedItemTitle}`;
    const existingItem = uniqueItems.get(dedupeKey);

    if (!existingItem) {
      uniqueItems.set(dedupeKey, item);
      continue;
    }

    uniqueItems.set(dedupeKey, selectRepresentativeItem(existingItem, item));
  }

  return Array.from(uniqueItems.values());
}

export function searchHistoryItems(items, query, options = {}) {
  const { keyword, domainFilter } = parseSearchInput(query);
  const activeDomainFilter = normalizeDomainFilter(options.domainFilter || domainFilter);

  if (!keyword && !activeDomainFilter) {
    return [];
  }

  const matchedItems = [];

  for (const item of items) {
    if (!matchesKeyword(item, keyword)) {
      continue;
    }

    const enrichedItem = enrichMatchedItem(item, keyword);

    if (!enrichedItem || !matchesDomain(enrichedItem.hostname, activeDomainFilter)) {
      continue;
    }

    matchedItems.push(enrichedItem);
  }

  const dedupedByUrl = dedupeByNormalizedUrl(matchedItems);
  const dedupedByDomainAndTitle = dedupeByDomainAndTitle(dedupedByUrl);
  return dedupedByDomainAndTitle.sort(compareHistoryItems);
}
