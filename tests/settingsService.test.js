import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  loadSearchPageSettings,
  saveSearchPageSettings
} from "../src/search-page/services/settingsService.js";

function createLocalStorageMock(initialValue = null) {
  const storage = new Map();

  if (initialValue !== null) {
    storage.set(SETTINGS_STORAGE_KEY, initialValue);
  }

  return {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, value);
    }
  };
}

test("loadSearchPageSettings falls back to defaults for missing or invalid data", () => {
  global.window = {
    localStorage: createLocalStorageMock("{not-json}")
  };

  assert.deepEqual(loadSearchPageSettings(), DEFAULT_SETTINGS);

  global.window = {
    localStorage: createLocalStorageMock()
  };

  assert.deepEqual(loadSearchPageSettings(), DEFAULT_SETTINGS);
  delete global.window;
});

test("saveSearchPageSettings sanitizes persisted domain priorities", () => {
  const localStorage = createLocalStorageMock();
  global.window = { localStorage };

  const { settings, success } = saveSearchPageSettings({
    domainPriorities: [" LarkOffice.com ", "foo", "larkoffice.com", "bytedance.net"]
  });

  assert.equal(success, true);
  assert.deepEqual(settings.domainPriorities, ["larkoffice.com", "bytedance.net"]);
  assert.deepEqual(loadSearchPageSettings().domainPriorities, ["larkoffice.com", "bytedance.net"]);

  delete global.window;
});
