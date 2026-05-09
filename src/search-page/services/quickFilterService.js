import { ALL_RESULTS_GROUP_ID } from "../../historySearch.js";

export const MAX_QUICK_FILTER_SHORTCUTS = 9;

export function shouldRenderQuickFilters(groups) {
  return groups.length > 1;
}

export function buildQuickFilters(groups, allItems) {
  if (!shouldRenderQuickFilters(groups)) {
    return [];
  }

  const filters = [
    {
      id: ALL_RESULTS_GROUP_ID,
      title: "全部结果",
      count: allItems.length,
      representativeItem: null
    },
    ...groups.map((group) => ({
      id: group.id,
      title: group.title,
      count: group.count,
      representativeItem: group.items[0] ?? null
    }))
  ];

  return filters.map((filter, index) => ({
    ...filter,
    shortcut: index < MAX_QUICK_FILTER_SHORTCUTS ? String(index + 1) : ""
  }));
}

export function resolveActiveQuickFilterId(previousFilterId, quickFilters) {
  if (quickFilters.length === 0) {
    return "";
  }

  if (previousFilterId && quickFilters.some((filter) => filter.id === previousFilterId)) {
    return previousFilterId;
  }

  return ALL_RESULTS_GROUP_ID;
}

export function filterGroupsByActiveFilterId(groups, activeFilterId) {
  if (!activeFilterId || activeFilterId === ALL_RESULTS_GROUP_ID) {
    return groups;
  }

  return groups.filter((group) => group.id === activeFilterId);
}

export function getQuickFilterByShortcut(quickFilters, shortcut) {
  if (!shortcut) {
    return null;
  }

  return quickFilters.find((filter) => filter.shortcut === shortcut) ?? null;
}
