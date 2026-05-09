import { sanitizeDomainPriorities } from "./domainPriorityService.js";

export const SETTINGS_STORAGE_KEY = "betterHistory.searchPageSettings.v1";
export const DEFAULT_SETTINGS = Object.freeze({
  domainPriorities: []
});

function safeParseJson(rawText) {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function safeReadFromLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteToLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function buildSettingsFromUnknown(rawSettings) {
  const domainPriorities = sanitizeDomainPriorities(rawSettings?.domainPriorities);

  return {
    ...DEFAULT_SETTINGS,
    domainPriorities
  };
}

export function loadSearchPageSettings() {
  const rawValue = safeReadFromLocalStorage(SETTINGS_STORAGE_KEY);
  const parsedValue = safeParseJson(rawValue);

  if (!parsedValue) {
    return { ...DEFAULT_SETTINGS };
  }

  return buildSettingsFromUnknown(parsedValue);
}

export function saveSearchPageSettings(nextSettings) {
  const resolvedSettings = buildSettingsFromUnknown(nextSettings);
  const success = safeWriteToLocalStorage(SETTINGS_STORAGE_KEY, JSON.stringify(resolvedSettings));
  return { settings: resolvedSettings, success };
}
