export const HISTORY_FETCH_LIMIT = 100000;
export const DEFAULT_HISTORY_DISPLAY_LIMIT = 20;
const TITLE_MATCH_PRIORITY = 0;
const NON_TITLE_MATCH_PRIORITY = 1;
const OTHER_RESULTS_GROUP_ID = "__other_results__";
export const ALL_RESULTS_GROUP_ID = "__all_results__";
const UNKNOWN_HOSTNAME = "(unknown)";
const EXCLUDED_URL_PREFIXES = ["doubao://history"];

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

function isExcludedHistoryUrl(rawUrl) {
  return EXCLUDED_URL_PREFIXES.some((prefix) => rawUrl.startsWith(prefix));
}

function getPrimaryDomainLabel(hostname) {
  const normalizedHostname = (hostname || "").toLowerCase();

  if (!normalizedHostname) {
    return "";
  }

  const hostnameParts = normalizedHostname.split(".").filter(Boolean);

  if (hostnameParts.length < 2) {
    return normalizedHostname;
  }

  return hostnameParts[hostnameParts.length - 2];
}

function getIconGroupKey(hostname) {
  const normalizedHostname = (hostname || "").toLowerCase();

  if (!normalizedHostname) {
    return UNKNOWN_HOSTNAME;
  }

  const hostnameParts = normalizedHostname.split(".").filter(Boolean);

  if (hostnameParts.length < 2) {
    return normalizedHostname;
  }

  return hostnameParts.slice(-2).join(".");
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

  const visitCountDiff = (right.visitCount ?? 0) - (left.visitCount ?? 0);

  if (visitCountDiff !== 0) {
    return visitCountDiff;
  }

  const lastVisitTimeDiff = (right.lastVisitTime ?? 0) - (left.lastVisitTime ?? 0);

  if (lastVisitTimeDiff !== 0) {
    return lastVisitTimeDiff;
  }

  return (left.url ?? "").localeCompare(right.url ?? "");
}

function compareDefaultHistoryItems(left, right) {
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

function buildGroupScore(group) {
  return {
    count: group.count,
    topItem: group.items[0]
  };
}

function compareHistoryGroups(left, right) {
  if (left.id === OTHER_RESULTS_GROUP_ID) {
    return 1;
  }

  if (right.id === OTHER_RESULTS_GROUP_ID) {
    return -1;
  }

  const leftScore = buildGroupScore(left);
  const rightScore = buildGroupScore(right);
  const countDiff = rightScore.count - leftScore.count;

  if (countDiff !== 0) {
    return countDiff;
  }

  return compareHistoryItems(leftScore.topItem, rightScore.topItem);
}

function selectRepresentativeItem(currentItem, nextItem, compareItems = compareHistoryItems) {
  return compareItems(currentItem, nextItem) <= 0 ? currentItem : nextItem;
}

function enrichMatchedItem(item, normalizedKeyword) {
  const normalizedUrl = normalizeUrl(item.url);

  if (!normalizedUrl) {
    return null;
  }

  if (isExcludedHistoryUrl(normalizedUrl)) {
    return null;
  }

  const hostname = getHostname(normalizedUrl);

  return {
    ...item,
    url: normalizedUrl,
    hostname,
    iconGroupKey: getIconGroupKey(hostname),
    iconGroupTitle: getPrimaryDomainLabel(hostname),
    matchPriority: getMatchPriority(item, normalizedKeyword)
  };
}

function dedupeByNormalizedUrl(items, compareItems = compareHistoryItems) {
  const uniqueItems = new Map();

  for (const item of items) {
    const existingItem = uniqueItems.get(item.url);

    if (!existingItem) {
      uniqueItems.set(item.url, item);
      continue;
    }

    uniqueItems.set(item.url, selectRepresentativeItem(existingItem, item, compareItems));
  }

  return Array.from(uniqueItems.values());
}

function dedupeByDomainAndTitle(items, compareItems = compareHistoryItems) {
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

    uniqueItems.set(dedupeKey, selectRepresentativeItem(existingItem, item, compareItems));
  }

  return Array.from(uniqueItems.values());
}

function enrichAndDedupeItems(items, normalizedKeyword, compareItems = compareHistoryItems) {
  const matchedItems = [];

  for (const item of items) {
    const enrichedItem = enrichMatchedItem(item, normalizedKeyword);

    if (!enrichedItem) {
      continue;
    }

    matchedItems.push(enrichedItem);
  }

  const dedupedByUrl = dedupeByNormalizedUrl(matchedItems, compareItems);
  return dedupeByDomainAndTitle(dedupedByUrl, compareItems);
}

function buildSiteGroups(items) {
  const groups = new Map();

  for (const item of items) {
    const groupKey = item.iconGroupKey || item.hostname || UNKNOWN_HOSTNAME;
    const groupTitle = item.iconGroupTitle || item.hostname || UNKNOWN_HOSTNAME;
    const group = groups.get(groupKey) ?? {
      id: groupKey,
      title: groupTitle,
      hostname: item.hostname || UNKNOWN_HOSTNAME,
      items: []
    };

    group.items.push(item);
    groups.set(groupKey, group);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    count: group.items.length
  }));
}

function getPromotedGroupThreshold(totalItems) {
  return Math.max(2, Math.min(4, Math.ceil(totalItems * 0.12)));
}

export function groupHistoryItemsBySite(items) {
  if (items.length === 0) {
    return [];
  }

  const siteGroups = buildSiteGroups(items).sort(compareHistoryGroups);
  const promotedGroupThreshold = getPromotedGroupThreshold(items.length);
  const promotedGroups = [];
  const otherItems = [];

  for (const group of siteGroups) {
    const shouldPromote =
      group.hostname !== UNKNOWN_HOSTNAME &&
      group.count >= promotedGroupThreshold &&
      promotedGroups.length < 3;

    if (shouldPromote) {
      promotedGroups.push(group);
      continue;
    }

    otherItems.push(...group.items);
  }

  if (promotedGroups.length === 0) {
    return [
      {
        id: ALL_RESULTS_GROUP_ID,
        title: "全部结果",
        hostname: "",
        count: items.length,
        items
      }
    ];
  }

  if (otherItems.length > 0) {
    promotedGroups.push({
      id: OTHER_RESULTS_GROUP_ID,
      title: "其他结果",
      hostname: "",
      count: otherItems.length,
      items: otherItems
    });
  }

  return promotedGroups.sort(compareHistoryGroups);
}

export function buildDefaultHistoryItems(items, limit = DEFAULT_HISTORY_DISPLAY_LIMIT) {
  return enrichAndDedupeItems(items, "", compareDefaultHistoryItems)
    .sort(compareDefaultHistoryItems)
    .slice(0, limit);
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

  const dedupedByDomainAndTitle = dedupeByDomainAndTitle(
    dedupeByNormalizedUrl(matchedItems, compareHistoryItems),
    compareHistoryItems
  );
  return dedupedByDomainAndTitle.sort(compareHistoryItems);
}
